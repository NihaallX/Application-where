import { neon } from '@neondatabase/serverless'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const VALID = ['APPLIED_CONFIRMATION', 'REJECTED', 'INTERVIEW', 'OFFER', 'RECRUITER_OUTREACH', 'APPLICATION_VIEWED', 'OTHER']
const GROQ_TIMEOUT_MS = 30_000

const PROMPT = `You are a job email classifier. Analyze the email and return ONLY a valid JSON object.
{
  "category": "APPLIED_CONFIRMATION | REJECTED | INTERVIEW | OFFER | RECRUITER_OUTREACH | APPLICATION_VIEWED | OTHER",
  "company": "company name or empty string",
  "role": "job title or empty string",
  "confidence": 0.0 to 1.0
}
Rules:
- APPLIED_CONFIRMATION: application received/submitted confirmation
- REJECTED: rejection or application declined
- INTERVIEW: interview invite or scheduling
- OFFER: job offer
- RECRUITER_OUTREACH: recruiter reaching out proactively
- APPLICATION_VIEWED: employer viewed your profile/resume/application
- OTHER: newsletters, digests, unrelated, job alerts without specific application
CRITICAL: return ONLY the JSON object, nothing else.`

// ─── Round-robin key pool ─────────────────────────────────────────────────────
function buildPool() {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter(Boolean) as string[]
  const clients = keys.map(k => new Groq({ apiKey: k }))
  const lastCall: number[] = keys.map(() => 0)
  const limited: boolean[] = keys.map(() => false)
  const MIN_DELAY = 2200

  async function call(subject: string, body: string) {
    // pick least-recently-used non-limited key
    const available = keys.map((_, i) => i).filter(i => !limited[i])
    if (!available.length) throw new Error('ALL_EXHAUSTED')
    const idx = available.reduce((a, b) => lastCall[a] <= lastCall[b] ? a : b)

    const wait = MIN_DELAY - (Date.now() - lastCall[idx])
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastCall[idx] = Date.now()

    try {
      const res = await clients[idx].chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Subject: ${subject}\n\nBody:\n${body}` },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }, { timeout: GROQ_TIMEOUT_MS })
      return res.choices[0]?.message?.content ?? null
    } catch (err: any) {
      if (err?.status === 429) {
        limited[idx] = true
        // retry with another key
        return call(subject, body)
      }
      throw err
    }
  }

  return { call }
}

export async function POST(req: NextRequest) {
  // Optional auth gate — set BULK_SECRET in env to require a bearer token
  const secret = process.env.BULK_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const sql = neon(process.env.DATABASE_URL!)
  const pool = buildPool()

  const encoder = new TextEncoder()
  const send = (ctrl: ReadableStreamDefaultController, data: object) => {
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const jobs = await sql`
          SELECT id, company
          FROM jobs
          WHERE current_status IN ('OTHER', 'MISCELLANEOUS')
          ORDER BY created_at DESC
        `

        const total = jobs.length
        let done = 0, changed = 0

        send(controller, { type: 'start', total })

        for (const job of jobs) {
          // get best email for this job
          const [email] = await sql`
            SELECT subject, body_preview FROM emails
            WHERE job_id = ${job.id}
            ORDER BY email_date DESC LIMIT 1
          `
          if (!email) { done++; continue }

          let content: string | null = null
          try {
            content = await pool.call(email.subject ?? '', email.body_preview ?? '')
          } catch (err: any) {
            if (err?.message === 'ALL_EXHAUSTED') {
              send(controller, { type: 'error', message: 'All Groq keys exhausted — resume tomorrow', done, total, changed })
              controller.close()
              return
            }
            done++
            send(controller, { type: 'progress', done, total, changed, current: job.company ?? '…' })
            continue
          }

          done++

          if (!content) {
            send(controller, { type: 'progress', done, total, changed, current: job.company ?? '…' })
            continue
          }

          let parsed: any
          try { parsed = JSON.parse(content) } catch { parsed = {} }

          const category: string = VALID.includes(parsed.category) ? parsed.category : 'OTHER'
          const company: string = typeof parsed.company === 'string' ? parsed.company.trim() : ''
          const confidence: number = typeof parsed.confidence === 'number'
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0.8

          if (category !== 'OTHER' && category !== 'MISCELLANEOUS') {
            changed++
            const shouldUpdateCompany = Boolean(company) && !['unknown', 'unknown company', ''].includes(company.toLowerCase())
            // Neon HTTP driver: transaction() takes a sync fn returning an array of queries
            await sql.transaction((tx) => [
              shouldUpdateCompany
                ? tx`UPDATE jobs SET current_status = ${category}, last_update_date = NOW(), company = CASE WHEN company IN ('Unknown','unknown','Unknown Company','') THEN ${company} ELSE company END WHERE id = ${job.id}`
                : tx`UPDATE jobs SET current_status = ${category}, last_update_date = NOW() WHERE id = ${job.id}`,
              tx`UPDATE emails SET category = ${category}, confidence = ${confidence} WHERE job_id = ${job.id}`,
            ])
          }

          send(controller, { type: 'progress', done, total, changed, current: email.subject?.slice(0, 60) ?? '…' })
        }

        send(controller, { type: 'done', done, total, changed })
        controller.close()
      } catch (err: any) {
        send(controller, { type: 'error', message: err?.message ?? 'Unknown error', done: 0, total: 0, changed: 0 })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

// Simple GET to count how many OTHER jobs remain
export async function GET() {
  const sql = neon(process.env.DATABASE_URL!)
  const [row] = await sql`SELECT COUNT(*)::int as count FROM jobs WHERE current_status IN ('OTHER','MISCELLANEOUS')`
  return NextResponse.json({ count: row.count })
}
