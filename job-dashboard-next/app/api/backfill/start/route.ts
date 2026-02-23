import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { isAlive, setProcess } from '@/lib/backfill-process'

const BACKEND_DIR = path.resolve(process.cwd(), '..', 'backend-job-sync')

export async function POST(req: Request) {
  if (isAlive()) {
    return NextResponse.json({ error: 'Backfill is already running' }, { status: 409 })
  }

  try {
    const body = await req.json()
    const mode = body.mode === 'sync' ? 'sync' : 'backfill'

    const proc = spawn('npm', ['run', mode], {
      cwd: BACKEND_DIR,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.on('data', d => process.stdout.write(`[backfill] ${d}`))
    proc.stderr?.on('data', d => process.stderr.write(`[backfill] ${d}`))
    proc.on('exit', () => setProcess(null))
    proc.on('error', () => setProcess(null))

    setProcess(proc)

    return NextResponse.json({ success: true, message: `Started ${mode}`, pid: proc.pid })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
