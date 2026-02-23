// Singleton to hold the backfill child process across Next.js API route calls
import { ChildProcess } from 'child_process'

declare global {
  // eslint-disable-next-line no-var
  var __backfillProcess: ChildProcess | null
}

if (!global.__backfillProcess) {
  global.__backfillProcess = null
}

export function getProcess(): ChildProcess | null {
  return global.__backfillProcess
}

export function setProcess(p: ChildProcess | null) {
  global.__backfillProcess = p
}

export function isAlive(): boolean {
  return global.__backfillProcess !== null && !global.__backfillProcess.killed
}
