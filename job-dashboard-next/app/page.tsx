import Link from "next/link"
import { ArrowRight, Mail, BarChart3, Search, Zap, Shield, Clock } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-[Space_Grotesk]">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">Application Where?</span>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Free while in beta
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Your job search,<br />finally organised.
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Forward your job emails to a personal address. We read them, classify them with AI, and give you a live dashboard — no spreadsheets, no manual input.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Start tracking free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 px-6 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Already have an account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Setup takes 2 minutes</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-12">One Gmail filter. Everything else is automatic.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: <Mail className="w-5 h-5" />,
                title: "Get your address",
                desc: "Sign up and receive a unique forwarding address — like you@appwhere.app.",
              },
              {
                step: "2",
                icon: <Search className="w-5 h-5" />,
                title: "Add one Gmail filter",
                desc: 'Create a filter: "from:(jobs OR careers OR recruiting)  Forward to your address." Takes 30 seconds.',
              },
              {
                step: "3",
                icon: <BarChart3 className="w-5 h-5" />,
                title: "Watch your dashboard fill up",
                desc: "Every confirmation, rejection, interview invite, and recruiter outreach lands in your funnel automatically.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300">
                    {item.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step {item.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need to stay on top</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Zap className="w-4 h-4" />, title: "AI classification", desc: "Groq LLM reads each email and tags it: confirmation, interview, rejection, offer, recruiter outreach." },
              { icon: <BarChart3 className="w-4 h-4" />, title: "Live funnel analytics", desc: "See your conversion rates — applied  viewed  interview  offer — at a glance." },
              { icon: <Search className="w-4 h-4" />, title: "Filter & search", desc: "Filter by company, job type, work mode, platform, or date range." },
              { icon: <Clock className="w-4 h-4" />, title: "Interview countdowns", desc: "Upcoming interviews are surfaced with a countdown on your dashboard." },
              { icon: <Shield className="w-4 h-4" />, title: "No inbox access", desc: "We never read your inbox directly. You forward emails to us — you stay in control." },
              { icon: <Mail className="w-4 h-4" />, title: "Works everywhere", desc: "Gmail, Outlook, Yahoo — anything that supports forwarding rules." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 mb-3">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-xl mx-auto text-center bg-gray-900 dark:bg-gray-800 rounded-3xl p-10">
          <h2 className="text-3xl font-bold text-white mb-4">Start tracking your job search</h2>
          <p className="text-gray-400 mb-8">Free during beta. No card required.</p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span> 2026 Application Where?</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}