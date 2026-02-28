"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, ArrowRight, Mail, Filter, BarChart3, ChevronRight } from "lucide-react"

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
      icon: <Mail className="w-5 h-5" />,
      title: "Copy your forwarding address",
      desc: "This is your personal email address. Any job email forwarded here gets classified automatically.",
      action: (
        <div className="mt-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <code className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{forwardingEmail}</code>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity shrink-0"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Keep this address private — anyone with it can send emails to your account.</p>
        </div>
      ),
    },
    {
      icon: <Filter className="w-5 h-5" />,
      title: "Add a Gmail forwarding rule",
      desc: "This tells Gmail to automatically forward job-related emails to your Application Where address.",
      action: (
        <div className="mt-4 space-y-3">
          <ol className="space-y-2.5">
            {[
              <>Open Gmail  click the <strong>Settings gear</strong>  <strong>See all settings</strong></>,
              <>Go to the <strong>Filters and Blocked Addresses</strong> tab  click <strong>Create a new filter</strong></>,
              <>In the <strong>From</strong> field, paste: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">jobs OR careers OR recruiting OR noreply@</code></>,
              <>Click <strong>Create filter</strong>  tick <strong>Forward it to</strong>  paste your address above  click <strong>Create filter</strong></>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold flex items-center justify-center text-gray-500">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
            Using Outlook or another provider? Use their forwarding rules — the address works with any email client.
          </p>
        </div>
      ),
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "You're all set",
      desc: "New job emails will start appearing in your dashboard within minutes of arriving in your inbox. No more spreadsheets.",
      action: (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-300">
          <p className="font-medium mb-1">What happens next</p>
          <ul className="space-y-1 text-green-700 dark:text-green-400">
            <li> Job emails you forward get classified by AI (confirmation, interview, offer, rejection)</li>
            <li> Your dashboard shows a live funnel of your applications</li>
            <li> Low-confidence emails surface in the Review tab for you to correct</li>
          </ul>
        </div>
      ),
    },
  ]

  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to Application Where? </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Let&#39;s get you set up in 2 minutes.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= currentStep ? "bg-gray-900 dark:bg-white w-8" : "bg-gray-200 dark:bg-gray-700 w-4"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300">
              {steps[currentStep].icon}
            </div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Step {currentStep + 1} of {steps.length}</span>
          </div>
          <h2 className="text-lg font-semibold mt-3 mb-1">{steps[currentStep].title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{steps[currentStep].desc}</p>
          {steps[currentStep].action}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-0 transition-colors"
          >
             Back
          </button>

          {isLastStep ? (
            <button
              onClick={complete}
              disabled={completing}
              className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {completing ? "Opening dashboard" : <>Go to my dashboard <ArrowRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Skip link */}
        <p className="text-center mt-4 text-xs text-gray-400">
          Already set this up?{" "}
          <button onClick={complete} className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Skip to dashboard
          </button>
        </p>

      </div>
    </div>
  )
}