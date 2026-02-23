import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isAlive } from '@/lib/backfill-process'

const STATUS_FILE = path.resolve(process.cwd(), '..', 'backend-job-sync', 'logs', 'sync-status.json')

export async function GET() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
      data.process_alive = isAlive()
      return NextResponse.json(data)
    }
    return NextResponse.json({ mode: 'idle', is_running: false, process_alive: false })
  } catch {
    return NextResponse.json({ mode: 'idle', is_running: false, process_alive: false })
  }
}
