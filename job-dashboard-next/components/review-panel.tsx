"use client"

import type { Email } from '@/hooks/use-jobs'

const CATEGORIES = [
  'APPLIED_CONFIRMATION',
  'APPLICATION_VIEWED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'GHOSTED',
  'RECRUITER_OUTREACH',
  'OTHER',
]

const CAT_LABEL: Record<string, string> = {
  APPLIED_CONFIRMATION: 'Applied Confirmation',
  APPLICATION_VIEWED: 'Application Viewed',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  GHOSTED: 'Ghosted',
  RECRUITER_OUTREACH: 'Recruiter Outreach',
  OTHER: 'Other',
}

interface Props {
  emails: Email[]
  onClassify: (emailId: string, category: string) => Promise<void>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function confidenceBadge(c: number) {
  const pct = Math.round(c * 100)
  const color = pct >= 40 ? 'text-[#fbbf24] bg-[#fbbf24]/10' : 'text-[#F87171] bg-[#F87171]/10'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  )
}

export function ReviewPanel({ emails, onClassify }: Props) {
  if (emails.length === 0) return null

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">
          Uncertain Classifications
          <span className="ml-2 text-xs font-normal bg-[#fbbf24]/10 text-[#fbbf24] px-2 py-0.5 rounded-full">
            {emails.length}
          </span>
        </h2>
        <p className="text-[#919191] text-xs">Confidence &lt; 50% — review manually</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#919191] text-xs">
              <th className="pb-3 text-left font-medium">Date</th>
              <th className="pb-3 text-left font-medium">Subject</th>
              <th className="pb-3 text-left font-medium">Confidence</th>
              <th className="pb-3 text-right font-medium">Classify as</th>
            </tr>
          </thead>
          <tbody>
            {emails.map(email => (
              <tr key={email.id} className="border-t border-[#1A1A1A] hover:bg-[#111] transition-colors">
                <td className="py-3 pr-4 text-[#919191] whitespace-nowrap">
                  {formatDate(email.email_date)}
                </td>
                <td className="py-3 pr-4 text-white max-w-xs truncate">
                  {email.subject || '(no subject)'}
                </td>
                <td className="py-3 pr-4">{confidenceBadge(email.confidence)}</td>
                <td className="py-3 text-right">
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) onClassify(email.id, e.target.value)
                    }}
                    className="bg-[#1A1A1A] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-[#86efac] transition-colors"
                  >
                    <option value="" disabled>Select…</option>
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
