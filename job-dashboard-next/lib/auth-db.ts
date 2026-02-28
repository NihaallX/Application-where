import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

/**
 * Resolves the current Clerk session → DB integer user_id.
 * Returns null if unauthenticated or user row not found.
 */
export async function getDbUserId(): Promise<number | null> {
  const { userId } = await auth()
  if (!userId) return null
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT id FROM users WHERE clerk_id = ${userId} LIMIT 1`
  return (rows[0]?.id as number) ?? null
}
