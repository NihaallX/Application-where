import Link from "next/link"

export const metadata = { title: "Privacy Policy — Application Where?" }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold">Application Where?</Link>
          <Link href="/sign-in" className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">Sign in</Link>
        </div>
      </nav>
      <article className="max-w-3xl mx-auto px-6 py-16 prose dark:prose-invert prose-sm sm:prose-base">
        <h1>Privacy Policy</h1>
        <p className="text-gray-500">Last updated: February 28, 2026</p>

        <h2>What we collect</h2>
        <p>When you sign up we collect your email address via Clerk (our authentication provider). When you forward emails to your unique address, we store the email content (subject, sender, body snippet) to classify it with AI and display it on your dashboard.</p>

        <h2>How we use your data</h2>
        <ul>
          <li>To classify job-related emails using the Groq AI API (llama-3.1-8b-instant).</li>
          <li>To display your job application history and analytics on your dashboard.</li>
          <li>We do not sell your data to third parties.</li>
          <li>We do not use your data to train AI models.</li>
        </ul>

        <h2>Email forwarding</h2>
        <p>We receive emails forwarded to your unique <code>@appwhere.app</code> address. We do not access your Gmail inbox directly. You control what gets forwarded by configuring your own email filters.</p>

        <h2>Data storage</h2>
        <p>Your data is stored in a NeonDB (Postgres) database hosted in the United States. We retain your data for as long as your account is active. You may request deletion at any time.</p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Clerk</strong> — authentication and identity management. <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer">Clerk Privacy Policy</a>.</li>
          <li><strong>Groq</strong> — AI classification of email content. Email content is sent to Groq for processing. <a href="https://groq.com/privacy-policy" target="_blank" rel="noopener noreferrer">Groq Privacy Policy</a>.</li>
          <li><strong>Vercel</strong> — hosting. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a>.</li>
          <li><strong>Mailgun</strong> — inbound email routing. <a href="https://www.mailgun.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">Mailgun Privacy Policy</a>.</li>
        </ul>

        <h2>Your rights</h2>
        <p>You can request a copy of your data, correction of inaccurate data, or deletion of your account and all associated data by emailing us. We will respond within 30 days.</p>

        <h2>Cookies</h2>
        <p>We use cookies only for authentication (managed by Clerk). We do not use tracking or advertising cookies.</p>

        <h2>Changes</h2>
        <p>We may update this policy. Continued use of the service after changes constitutes acceptance. We will note the date of the last update at the top of this page.</p>

        <h2>Contact</h2>
        <p>Questions? Email us at <a href="mailto:privacy@appwhere.app">privacy@appwhere.app</a>.</p>
      </article>
    </div>
  )
}