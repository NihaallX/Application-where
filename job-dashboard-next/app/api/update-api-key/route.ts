import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const BACKEND_ENV = path.resolve(process.cwd(), '..', 'backend-job-sync', '.env')

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json()
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
    }

    if (!fs.existsSync(BACKEND_ENV)) {
      return NextResponse.json({ error: 'Backend .env not found' }, { status: 404 })
    }

    let content = fs.readFileSync(BACKEND_ENV, 'utf-8')
    if (content.includes('GROQ_API_KEY=')) {
      content = content.replace(/GROQ_API_KEY=.*/, `GROQ_API_KEY=${apiKey.trim()}`)
    } else {
      content += `\nGROQ_API_KEY=${apiKey.trim()}\n`
    }
    fs.writeFileSync(BACKEND_ENV, content)

    return NextResponse.json({ success: true, message: 'API key updated. Backend will hot-reload within ~10s.' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
