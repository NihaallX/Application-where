import { NextResponse } from 'next/server'
import { isAlive, getProcess } from '@/lib/backfill-process'

export async function GET() {
  return NextResponse.json({
    alive: isAlive(),
    pid: getProcess()?.pid ?? null,
  })
}
