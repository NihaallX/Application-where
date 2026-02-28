"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, ArrowRight, Mail, Filter, BarChart3, ChevronRight } from "lucide-react"
import { AppLogo } from "@/components/app-logo"

interface Props {
  forwardingEmail: string
  userId: string
}

export function OnboardingClient({ forwardingEmail, userId }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const copy = () => {
    navigator.clipboard.writeText(forwardingEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const complete = async () => {
    setCompleting(true)
    await fetch("/api/onboarding/complete", { method: "POST" })
    router.push("/dashboard")
  }

  const steps = [
    {
      icon: <Mail className="w-4 h-4" />,
      title: "Copy your forwarding address",
      desc: "This is your personal email address. Any job email forwarded here gets classified automatically.",
      action: (
        <div className="mt-5">
          <div className="flex items-center gap-2 p-3 bg-[#1A1A1A] rounded-xl border border-[#333]">
            <code className="flex-1 text-sm font-mono text-[#E7E7E7] truncate">{forwardingEmail}</code>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#86efac] text-[#080808] px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity shrink-0"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-[#555] mt-2">Keep this address private — anyone with it can send emails to your account.</p>
        </div>
      ),
    },
    {
      icon: <Filter className="w-4 h-4" />,
      title: "Add a Gmail forwarding rule",
      desc: "This tells Gmail to automatically forward job-related emails to your appwhere address. Takes 30 seconds.",
      action: (
        <div className="mt-5 space-y-3">
          <ol className="space-y-3">
            {[
              <>Open Gmail  click the <strong className="text-[#E7E7E7]">Settings gear</strong>  <strong className="text-[#E7E7E7]">See all settings</strong></>,
              <>Go to <strong className="text-[#E7E7E7]">Filters and Blocked Addresses</strong>  click <strong className="text-[#E7E7E7]">Create a new filter</strong></>,
              <>In <strong className="text-[#E7E7E7]">From</strong>, paste: <code className="bg-[#1A1A1A] border border-[#333] text-[#86efac] px-1.5 py-0.5 rounded text-xs">jobs OR careers OR recruiting OR noreply@</code></>,
              <>Click <strong className="text-[#E7E7E7]">Create filter</strong>  tick <strong className="text-[#E7E7E7]">Forward it to</strong>  paste your address  <strong className="text-[#E7E7E7]">Create filter</strong></>,
            ].map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-[#919191]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#1A1A1A] border border-[#333] text-xs font-bold flex items-center justify-center text-[#555]">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[#555] pt-1 border-t border-[#1F1F1F]">
            Using Outlook or another provider? Use their forwarding rules — the address works with any email client.
          </p>
        </div>
      ),
    },
    {
      icon: <BarChart3 className="w-4 h-4" />,
      title: "You&#39;re all set",
      desc: "New job emails will appear in your dashboard within minutes of arriving in your inbox.",
      action: (
        <div className="mt-5 p-4 bg-[#86efac]/5 border border-[#86efac]/20 rounded-xl text-sm text-[#86efac]">
          <p className="font-semibold mb-2">What happens next</p>
          <ul className="space-y-1.5 text-[#86efac]/80 text-xs">
            <li> Job emails you forward get classified by AI (confirmation, interview, offer, rejection)</li>
            <li> Your dashboard shows a live funnel of your applications</li>
            <li> Low-confidence emails surface in the Review tab for you to correct</li>
            <li> No manual input ever required</li>
          </ul>
        </div>
      ),
    },
  ]

  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <AppLogo className="inline-block mb-4" />
          <h1 className="text-xl font-bold text-white mb-1.5">Welcome! Let&#39;s get you set up.</h1>
          <p className="text-[#919191] text-sm">Takes about 2 minutes. No technical knowledge needed.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i <= currentStep ? "2rem" : "1rem",
                backgroundColor: i <= currentStep ? "#86efac" : "#222",
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center text-[#86efac]">
              {steps[currentStep].icon}
            </div>
            <span className="text-xs text-[#555] font-bold uppercase tracking-widest">Step {currentStep + 1} of {steps.length}</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">{steps[currentStep].title}</h2>
          <p className="text-sm text-[#919191]">{steps[currentStep].desc}</p>
          {steps[currentStep].action}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="text-sm text-[#555] hover:text-[#919191] disabled:opacity-0 transition-colors"
          >
             Back
          </button>

          {isLastStep ? (
            <button
              onClick={complete}
              disabled={completing}
              className="flex items-center gap-2 bg-[#86efac] text-[#080808] font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {completing ? "Opening dashboard" : <>Go to my dashboard <ArrowRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-2 bg-[#86efac] text-[#080808] font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Skip */}
        <p className="text-center mt-4 text-xs text-[#555]">
          Already set this up?{" "}
          <button onClick={complete} className="text-[#919191] underline hover:text-[#E7E7E7] transition-colors">
            Skip to dashboard
          </button>
        </p>

      </div>
    </div>
  )
}