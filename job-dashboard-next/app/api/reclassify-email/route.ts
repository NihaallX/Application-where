import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getDbUserId } from '@/lib/auth-db';

const PROMPT = `You are a job email classifier. Analyze the email and return ONLY a valid JSON object.
{
  "category": "APPLIED_CONFIRMATION | REJECTED | INTERVIEW | OFFER | RECRUITER_OUTREACH | APPLICATION_VIEWED | OTHER",
  "company": "company name",
  "role": "job role/title",
  "confidence": 0.0 to 1.0
}
CRITICAL: category MUST be exactly one of those 7 values. INTERNSHIP is NOT a valid category.`;

export async function POST(req: NextRequest) {
  try {
    const dbUserId = await getDbUserId();
    if (!dbUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);

    // Get latest email for this job — scoped to user
    const emails = await sql`
      SELECT subject, body_preview, category
      FROM emails WHERE job_id = ${jobId} AND user_id = ${dbUserId}
      ORDER BY email_date DESC LIMIT 1
    `;
    if (!emails.length) return NextResponse.json({ error: 'No email found' }, { status: 404 });

    const { subject, body_preview } = emails[0];
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Subject: ${subject}\n\nBody:\n${body_preview}` },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'Empty LLM response' }, { status: 500 });

    const parsed = JSON.parse(content);
    const valid = ['APPLIED_CONFIRMATION','REJECTED','INTERVIEW','OFFER','RECRUITER_OUTREACH','APPLICATION_VIEWED','OTHER'];
    const category: string = valid.includes(parsed.category) ? parsed.category : 'OTHER';
    const company: string = parsed.company || '';

    // Update email — scoped to user
    await sql`UPDATE emails SET category = ${category}, confidence = 1.0 WHERE job_id = ${jobId} AND user_id = ${dbUserId}`;

    // Update job — scoped to user
    const updates: Promise<unknown>[] = [
      sql`UPDATE jobs SET current_status = ${category}, last_update_date = NOW() WHERE id = ${jobId} AND user_id = ${dbUserId}`,
    ];
    if (company && company !== 'Unknown') {
      updates.push(sql`UPDATE jobs SET company = ${company} WHERE id = ${jobId} AND user_id = ${dbUserId} AND company IN ('Unknown', 'unknown', 'Unknown Company')`);
    }
    await Promise.all(updates);

    return NextResponse.json({ category, company });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
