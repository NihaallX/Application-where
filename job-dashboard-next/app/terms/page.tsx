import Link from "next/link"
import { AppLogo } from "@/components/app-logo"

export const metadata = { title: "Terms of Service — Application Where?" }

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-[#555]">Last updated: February 28, 2026</p>
        </div>

        {[
          {
            title: "Acceptance",
            body: "By creating an account or using Application Where?, you agree to these terms. If you do not agree, do not use the service.",
          },
          {
            title: "The service",
            body: "Application Where? helps you track job applications by classifying forwarded emails with AI. The service is provided as-is during the beta period and may change at any time.",
          },
          {
            title: "Your account",
            body: null,
            list: [
              "You are responsible for keeping your account credentials secure.",
              "You are responsible for the emails you choose to forward to the service.",
              "Do not forward emails that contain sensitive personal data beyond your own job search activity.",
              "One account per person. Do not share accounts.",
            ],
          },
          {
            title: "Acceptable use",
            body: "You may not use the service to:",
            list: [
              "Forward spam, phishing emails, or content that violates any law.",
              "Attempt to reverse-engineer, overload, or interfere with the service.",
              "Use the service for any commercial purpose other than your own personal job search.",
            ],
          },
          {
            title: "AI classification accuracy",
            body: "Email classification is performed by an AI model and may be inaccurate. Application Where? makes no guarantee of classification accuracy. You are responsible for reviewing and correcting classifications in the Review panel.",
          },
          {
            title: "Beta period",
            body: "The service is currently in beta. Features may change or be removed. The service may be interrupted. We are not liable for any loss arising from beta-period interruptions.",
          },
          {
            title: "Termination",
            body: "We may suspend or terminate accounts that violate these terms. You may delete your account at any time.",
          },
          {
            title: "Limitation of liability",
            body: "To the maximum extent permitted by law, Application Where? is not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
          },
          {
            title: "Changes",
            body: "We may update these terms. Continued use after changes constitutes acceptance.",
          },
          {
            title: "Contact",
            body: "Questions? Email us at hello@appwhere.app.",
          },
        ].map((section) => (
          <div key={section.title} className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6">
            <h2 className="font-bold text-white mb-3">{section.title}</h2>
            {section.body && <p className="text-[#919191]">{section.body}</p>}
            {section.list && (
              <ul className="space-y-2 mt-2">
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