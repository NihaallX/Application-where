import { auth } from "@clerk/nextjs/server"
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sql = neon(process.env.DATABASE_URL!)
  await sql`UPDATE users SET onboarding_complete = true WHERE clerk_id = ${userId}`

  return NextResponse.json({ ok: true })
}