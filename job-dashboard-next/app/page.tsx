import Link from "next/link"
import { AppLogo } from "@/components/app-logo"
import { ArrowRight, Mail, BarChart3, Search, Zap, Shield, Clock } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#E7E7E7]">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1F1F1F] bg-[#080808]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <AppLogo />
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm text-[#919191] hover:text-[#E7E7E7] transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="flex items-center gap-1.5 text-sm bg-[#86efac] text-[#080808] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-44 pb-28 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-[#86efac]/10 text-[#86efac] border border-[#86efac]/20 rounded-full px-3 py-1 mb-8 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-pulse" />
          Free during beta
        </div>
        <h1 className="text-5xl md:text-[62px] font-bold tracking-tight leading-tight mb-6 text-white">
          Your job search,<br />
          <span style={{ color: "#86efac" }}>finally organised.</span>
        </h1>
        <p className="text-lg text-[#919191] mb-10 max-w-xl mx-auto leading-relaxed">
          Forward your job emails to a personal address. AI classifies every confirmation, rejection, interview, and recruiter email. Your funnel, live — zero manual input.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#86efac] text-[#080808] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start tracking free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm text-[#919191] border border-[#333] hover:border-[#555] hover:text-[#E7E7E7] transition-colors"
          >
            Already have an account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-[#1F1F1F]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[#555] text-center mb-3 font-medium">How it works</p>
          <h2 className="text-2xl font-bold text-center text-white mb-2">Setup takes 2 minutes</h2>
          <p className="text-[#919191] text-center text-sm mb-12">One Gmail filter. Everything else is automatic.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                icon: <Mail className="w-4 h-4" />,
                title: "Get your address",
                desc: "Sign up and we give you a unique forwarding address — like you@appwhere.app.",
              },
              {
                step: "02",
                icon: <Search className="w-4 h-4" />,
                title: "Add one Gmail filter",
                desc: "From: jobs OR careers OR recruiting  Forward to your address. Takes 30 seconds.",
              },
              {
                step: "03",
                icon: <BarChart3 className="w-4 h-4" />,
                title: "Your dashboard fills up",
                desc: "Every confirmation, rejection, interview invite, and recruiter email lands in your funnel.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center text-[#86efac]">
                    {item.icon}
                  </div>
                  <span className="text-xs font-bold text-[#555] tracking-widest">{item.step}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-[#919191] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-[#1F1F1F]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[#555] text-center mb-3 font-medium">Features</p>
          <h2 className="text-2xl font-bold text-center text-white mb-12">Everything you need to stay on top</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Zap className="w-4 h-4" />, title: "AI classification", desc: "Groq LLM reads each email and tags it: confirmation, interview, rejection, offer, recruiter outreach.", accent: "#86efac" },
              { icon: <BarChart3 className="w-4 h-4" />, title: "Live funnel analytics", desc: "See your conversion rates — applied  viewed  interview  offer — at a glance.", accent: "#60a5fa" },
              { icon: <Search className="w-4 h-4" />, title: "Filter & search", desc: "Filter by company, job type, work mode, platform, or date range.", accent: "#a78bfa" },
              { icon: <Clock className="w-4 h-4" />, title: "Interview countdowns", desc: "Upcoming interviews are surfaced with a countdown on your dashboard.", accent: "#fbbf24" },
              { icon: <Shield className="w-4 h-4" />, title: "No inbox access", desc: "We never read your inbox directly. You forward emails — you stay in control.", accent: "#86efac" },
              { icon: <Mail className="w-4 h-4" />, title: "Works everywhere", desc: "Gmail, Outlook, Yahoo — anything that supports forwarding rules.", accent: "#60a5fa" },
            ].map((f) => (
              <div key={f.title} className="bg-[#0D0D0D] border border-[#222] hover:border-[#333] rounded-2xl p-5 transition-colors">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: f.accent + "18", border: `1px solid ${f.accent}30`, color: f.accent }}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-[#919191] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Status bar — social proof feeling */}
      <section className="py-10 px-6 border-t border-[#1F1F1F]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8">
          {[
            { label: "Emails classified", value: "100% automated" },
            { label: "Manual input required", value: "Zero" },
            { label: "LLM cost", value: "~$0 / month" },
            { label: "Setup time", value: "2 minutes" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-[#555] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[#1F1F1F]">
        <div className="max-w-xl mx-auto text-center bg-[#0D0D0D] border border-[#222] rounded-3xl p-10">
          <div className="w-10 h-10 rounded-2xl bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="w-5 h-5 text-[#86efac]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Start tracking your applications</h2>
          <p className="text-[#919191] text-sm mb-8">Free during beta. No card required. Works with any email provider.</p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#86efac] text-[#080808] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1F1F1F] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <AppLogo />
          <div className="flex items-center gap-6 text-sm text-[#555]">
            <Link href="/privacy" className="hover:text-[#919191] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#919191] transition-colors">Terms of Service</Link>
            <span> 2026 Application Where?</span>
          </div>
        </div>
      </footer>

    </div>
  )
}