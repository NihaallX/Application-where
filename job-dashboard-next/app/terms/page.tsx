import Link from "next/link"

export const metadata = { title: "Terms of Service — Application Where?" }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold">Application Where?</Link>
          <Link href="/sign-in" className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">Sign in</Link>
        </div>
      </nav>
      <article className="max-w-3xl mx-auto px-6 py-16 prose dark:prose-invert prose-sm sm:prose-base">
        <h1>Terms of Service</h1>
        <p className="text-gray-500">Last updated: February 28, 2026</p>

        <h2>Acceptance</h2>
        <p>By creating an account or using Application Where?, you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>The service</h2>
        <p>Application Where? helps you track job applications by classifying forwarded emails with AI. The service is provided as-is during the beta period and may change at any time.</p>

        <h2>Your account</h2>
        <ul>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You are responsible for the emails you choose to forward to the service.</li>
          <li>Do not forward emails that contain sensitive personal data beyond your own job search activity.</li>
          <li>One account per person. Do not share accounts.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>You may not use the service to:</p>
        <ul>
          <li>Forward spam, phishing emails, or content that violates any law.</li>
          <li>Attempt to reverse-engineer, overload, or interfere with the service.</li>
          <li>Use the service for any commercial purpose other than your own personal job search.</li>
        </ul>

        <h2>AI classification accuracy</h2>
        <p>Email classification is performed by an AI model and may be inaccurate. Application Where? makes no guarantee of classification accuracy. You are responsible for reviewing and correcting classifications in the Review panel.</p>

        <h2>Beta period</h2>
        <p>The service is currently in beta. Features may change or be removed. The service may be interrupted. We are not liable for any loss arising from beta-period interruptions.</p>

        <h2>Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time.</p>

        <h2>Limitation of liability</h2>
        <p>To the maximum extent permitted by law, Application Where? is not liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

        <h2>Changes</h2>
        <p>We may update these terms. Continued use after changes constitutes acceptance.</p>

        <h2>Contact</h2>
        <p>Questions? Email us at <a href="mailto:hello@appwhere.app">hello@appwhere.app</a>.</p>
      </article>
    </div>
  )
}