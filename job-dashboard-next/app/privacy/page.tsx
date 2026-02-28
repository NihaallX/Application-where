import Link from "next/link"
import { AppLogo } from "@/components/app-logo"

export const metadata = { title: "Privacy Policy — Application Where?" }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#E7E7E7]">
      <nav className="border-b border-[#1F1F1F] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/"><AppLogo /></Link>
          <Link href="/sign-in" className="text-sm text-[#919191] hover:text-[#E7E7E7] transition-colors">Sign in</Link>
        </div>
      </nav>
      <article className="max-w-3xl mx-auto px-6 py-16 space-y-8 text-sm leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-[#555]">Last updated: February 28, 2026</p>
        </div>

        {[
          {
            title: "What we collect",
            body: "When you sign up we collect your email address via Clerk (our authentication provider). When you forward emails to your unique address, we store the email content (subject, sender, body snippet) to classify it with AI and display it on your dashboard.",
          },
          {
            title: "How we use your data",
            body: null,
            list: [
              "To classify job-related emails using the Groq AI API (llama-3.1-8b-instant).",
              "To display your job application history and analytics on your dashboard.",
              "We do not sell your data to third parties.",
              "We do not use your data to train AI models.",
            ],
          },
          {
            title: "Email forwarding",
            body: "We receive emails forwarded to your unique @appwhere.app address. We do not access your Gmail inbox directly. You control what gets forwarded by configuring your own email filters.",
          },
          {
            title: "Data storage",
            body: "Your data is stored in a NeonDB (Postgres) database hosted in the United States. We retain your data for as long as your account is active. You may request deletion at any time.",
          },
          {
            title: "Third-party services",
            body: null,
            list: [
              "Clerk — authentication and identity management.",
              "Groq — AI classification of email content. Email content is sent to Groq for processing.",
              "Vercel — hosting and edge functions.",
              "Mailgun — inbound email routing.",
            ],
          },
          {
            title: "Your rights",
            body: "You can request a copy of your data, correction of inaccurate data, or deletion of your account and all associated data by emailing privacy@appwhere.app. We will respond within 30 days.",
          },
          {
            title: "Cookies",
            body: "We use cookies only for authentication (managed by Clerk). We do not use tracking or advertising cookies.",
          },
          {
            title: "Changes",
            body: "We may update this policy. Continued use of the service after changes constitutes acceptance. The date at the top of this page reflects the latest revision.",
          },
          {
            title: "Contact",
            body: "Questions? Email us at privacy@appwhere.app.",
          },
        ].map((section) => (
          <div key={section.title} className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6">
            <h2 className="font-bold text-white mb-3">{section.title}</h2>
            {section.body && <p className="text-[#919191]">{section.body}</p>}
            {section.list && (
              <ul className="space-y-2">
                {section.list.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[#919191]">
                    <span className="text-[#86efac] shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </article>
    </div>
  )
}