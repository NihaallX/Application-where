import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const RESUME_FILE = path.resolve(process.cwd(), '..', 'backend-job-sync', 'logs', 'resume-state.json')

export async function GET() {
  try {
    if (fs.existsSync(RESUME_FILE)) {
      return NextResponse.json(JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8')))
    }
    return NextResponse.json(null)
  } catch {
    return NextResponse.json(null)
  }
}
