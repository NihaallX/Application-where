import { NextResponse } from 'next/server'
import { isAlive, getProcess } from '@/lib/backfill-process'

export async function POST() {
  if (!isAlive()) {
    return NextResponse.json({ error: 'No backfill process is running' }, { status: 404 })
  }
  try {
    getProcess()!.kill('SIGINT')
    return NextResponse.json({ success: true, message: 'Stop signal sent. Process will save progress and exit.' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
