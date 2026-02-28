import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { MainLayout } from "@/components/main-layout"

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Ensure user row exists; if brand new, send to onboarding
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT onboarding_complete FROM users WHERE clerk_id = ${userId} LIMIT 1`
  if (rows.length === 0 || !rows[0].onboarding_complete) {
    redirect("/onboarding")
  }

  return <MainLayout />
}