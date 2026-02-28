import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { OnboardingClient } from "@/components/onboarding-client"

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? ""

  const sql = neon(process.env.DATABASE_URL!)

  // Upsert user row — safe to call multiple times
  const rows = await sql`
    INSERT INTO users (clerk_id, email, forwarding_address, onboarding_complete, plan, created_at)
    VALUES (
      ${userId},
      ${email},
      ${crypto.randomUUID()},
      false,
      'free',
      NOW()
    )
    ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email
    RETURNING forwarding_address, onboarding_complete
  `

  const { forwarding_address, onboarding_complete } = rows[0]

  // If already onboarded, send straight to dashboard
  if (onboarding_complete) redirect("/dashboard")

  const forwardingEmail = `${forwarding_address}@appwhere.app`

  return <OnboardingClient forwardingEmail={forwardingEmail} userId={userId} />
}