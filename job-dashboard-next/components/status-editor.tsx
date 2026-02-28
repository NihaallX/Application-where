"use client"

import { useState, useEffect } from 'react'
import { X, Calendar } from 'lucide-react'
import type { Job } from '@/hooks/use-jobs'

const STATUSES = [
  'APPLIED_CONFIRMATION',
  'APPLICATION_VIEWED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'GHOSTED',
  'RECRUITER_OUTREACH',
  'OTHER',
  'MISCELLANEOUS',
]

const STATUS_LABEL: Record<string, string> = {
  APPLIED_CONFIRMATION: 'Applied Confirmation',
  APPLICATION_VIEWED: 'Application Viewed',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  GHOSTED: 'Ghosted',
  RECRUITER_OUTREACH: 'Recruiter Outreach',
  OTHER: 'Other',
  MISCELLANEOUS: 'Miscellaneous',
}

interface Props {
  job: Job | null
  onClose: () => void
  onUpdateStatus: (jobId: string, status: string) => Promise<void>
  onUpdateNotes: (jobId: string, notes: string) => Promise<void>
}

function getInterviewCountdown(dateStr: string | null): { text: string; urgent: boolean } | null {
  if (!dateStr) return null
  const now = new Date()
  const ivDate = new Date(dateStr)
  const diff = Math.ceil((ivDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return { text: 'Interview is TODAY!', urgent: true }
  if (diff === 1) return { text: 'Interview is TOMORROW!', urgent: true }
  return { text: `Interview in ${diff} day${diff === 1 ? '' : 's'}`, urgent: diff <= 3 }
}

export function StatusEditor({ job, onClose, onUpdateStatus, onUpdateNotes }: Props) {
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (job) {
      setStatus(job.current_status)
      setNotes(job.notes ?? '')
    }
  }, [job])

  if (!job) return null

  const countdown = getInterviewCountdown(job.interview_date)

  async function handleSave() {
    if (!job) return
    setSaving(true)
    try {
      const promises: Promise<void>[] = []
      if (status !== job.current_status) {
        promises.push(onUpdateStatus(job.id, status))
      }
      if (notes !== (job.notes ?? '')) {
        promises.push(onUpdateNotes(job.id, notes))
      }
      await Promise.all(promises)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#0D0D0D] border border-[#333] rounded-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{job.company}</h2>
            <p className="text-[#919191] text-sm mt-0.5">{job.role}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#919191] hover:text-white transition-colors mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interview countdown banner */}
        {countdown && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${countdown.urgent
                ? 'bg-[#60a5fa]/10 border border-[#60a5fa]/30 text-[#60a5fa]'
                : 'bg-[#1A1A1A] border border-[#333] text-[#aaa]'
              }`}
          >
            <Calendar className="h-4 w-4 flex-shrink-0" />
            {countdown.text}
          </div>
        )}

        {/* Status dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#919191] text-xs font-medium uppercase tracking-wider">
            Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-[#1A1A1A] border border-[#333] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#86efac] transition-colors"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#919191] text-xs font-medium uppercase tracking-wider">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Add notes about this application..."
            className="bg-[#1A1A1A] border border-[#333] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#86efac] transition-colors resize-none placeholder-[#555]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-transparent border border-[#333] hover:border-[#555] text-[#919191] hover:text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#86efac] hover:bg-[#6ee09b] text-black text-sm font-bold rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
