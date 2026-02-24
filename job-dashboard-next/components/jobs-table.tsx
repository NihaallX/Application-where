"use client"

import { useState, useEffect } from 'react'
import { ChevronsUpDown, Search, Download, RotateCcw } from 'lucide-react'
import type { Job } from '@/hooks/use-jobs'
import { StatusEditor } from '@/components/status-editor'

interface Props {
  jobs: Job[]
  loading: boolean
  onUpdateStatus: (jobId: string, status: string) => Promise<void>
  onUpdateNotes: (jobId: string, notes: string) => Promise<void>
  onReclassify: (jobId: string) => Promise<{ category: string; company?: string } | null>
  activeStatusFilter?: string | null
  onClearFilter?: () => void
}

const STATUS_COLOR: Record<string, string> = {
  OFFER:                'text-[#4ADE80]',
  INTERVIEW:            'text-[#60a5fa]',
  APPLIED_CONFIRMATION: 'text-[#86efac]',
  APPLICATION_VIEWED:   'text-[#a78bfa]',
  REJECTED:             'text-[#F87171]',
  RECRUITER_OUTREACH:   'text-[#fbbf24]',
  OTHER:                'text-[#919191]',
  MISCELLANEOUS:        'text-[#919191]',
}

const STATUS_DOT: Record<string, string> = {
  OFFER:                'bg-[#4ADE80]',
  INTERVIEW:            'bg-[#60a5fa]',
  APPLIED_CONFIRMATION: 'bg-[#86efac]',
  APPLICATION_VIEWED:   'bg-[#a78bfa]',
  REJECTED:             'bg-[#F87171]',
  RECRUITER_OUTREACH:   'bg-[#fbbf24]',
  OTHER:                'bg-[#919191]',
  MISCELLANEOUS:        'bg-[#919191]',
}

const STATUS_LABEL: Record<string, string> = {
  OFFER:                'Offer',
  INTERVIEW:            'Interview',
  APPLIED_CONFIRMATION: 'Applied',
  APPLICATION_VIEWED:   'Viewed',
  REJECTED:             'Rejected',
  RECRUITER_OUTREACH:   'Recruiter',
  OTHER:                'Other',
  MISCELLANEOUS:        'Misc',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function getInterviewCountdown(dateStr: string | null): string | null {
  if (!dateStr) return null
  const now = new Date()
  const iv = new Date(dateStr)
  const diff = Math.ceil((iv.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff}d`
}

function exportCSV(jobs: Job[]) {
  const headers = ['Company','Role','Status','Job Type','Work Mode','Platform','Date','Interview Date','Notes']
  const rows = jobs.map(j => [
    j.company, j.role, j.current_status, j.job_type, j.work_mode,
    j.source_platform, j.last_update_date, j.interview_date ?? '',
    (j.notes ?? '').replace(/"/g, '""'),
  ].map(v => `"${v ?? ''}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jobs-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function JobsTable({ jobs, loading, onUpdateStatus, onUpdateNotes, onReclassify, activeStatusFilter, onClearFilter }: Props) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'company' | 'last_update_date'>('last_update_date')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [reclassifyFeedback, setReclassifyFeedback] = useState<Record<string, string>>({})
  const [reclassifyLoading, setReclassifyLoading] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const filtered = jobs
    .filter(j => {
      if (activeStatusFilter && j.current_status !== activeStatusFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (j.company ?? '').toLowerCase().includes(q) || (j.role ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortField === 'company') return (a.company ?? '').localeCompare(b.company ?? '')
      return new Date(b.last_update_date).getTime() - new Date(a.last_update_date).getTime()
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Reset to page 1 when filters/search change would be handled via key, instead clamp:
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 whenever search or status filter changes
  useEffect(() => { setPage(1) }, [search, activeStatusFilter])

  async function handleReclassify(e: React.MouseEvent, job: Job) {
    e.stopPropagation()
    setReclassifyLoading(prev => ({ ...prev, [job.id]: true }))
    const result = await onReclassify(job.id)
    setReclassifyLoading(prev => ({ ...prev, [job.id]: false }))
    if (result) {
      setReclassifyFeedback(prev => ({ ...prev, [job.id]: result.category }))
      setTimeout(() => setReclassifyFeedback(prev => { const n = { ...prev }; delete n[job.id]; return n }), 3000)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-[#1A1A1A] rounded-xl mb-3" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        {/* Header bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-[#919191] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search company or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-white text-sm outline-none placeholder-[#919191] w-full"
            />
          </div>
          {activeStatusFilter && (
            <button
              onClick={onClearFilter}
              className="flex items-center gap-1.5 text-xs bg-[#86efac]/10 border border-[#86efac]/30 text-[#86efac] hover:bg-[#86efac]/20 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {STATUS_LABEL[activeStatusFilter] ?? activeStatusFilter} ×
            </button>
          )}
          <span className="text-[#919191] text-sm whitespace-nowrap">
            {search || activeStatusFilter ? `${filtered.length} of ${jobs.length}` : `${jobs.length} jobs`}
          </span>
          <button
            onClick={() => exportCSV(filtered)}
            title="Export CSV"
            className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] hover:border-[#86efac] text-[#919191] hover:text-[#86efac] text-xs font-medium rounded-lg px-3 py-2 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-[#919191] text-sm">
                <th className="pb-4 text-left font-medium pl-2">
                  <button
                    onClick={() => { setSortField('company'); setPage(1) }}
                    className={`flex items-center gap-1 hover:text-white transition-colors ${sortField === 'company' ? 'text-white' : ''}`}
                  >
                    Company <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </th>
                <th className="pb-4 text-left font-medium">Role</th>
                <th className="pb-4 text-left font-medium">Status</th>
                <th className="pb-4 text-right font-medium">Type</th>
                <th className="pb-4 text-right font-medium pr-2">
                  <button
                    onClick={() => { setSortField('last_update_date'); setPage(1) }}
                    className={`flex items-center gap-1 ml-auto hover:text-white transition-colors ${sortField === 'last_update_date' ? 'text-white' : ''}`}
                  >
                    Date <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(job => {
                const color = STATUS_COLOR[job.current_status] ?? 'text-[#919191]'
                const dot = STATUS_DOT[job.current_status] ?? 'bg-[#919191]'
                const label = STATUS_LABEL[job.current_status] ?? job.current_status
                const countdown = getInterviewCountdown(job.interview_date)
                const isReclassifiable = job.current_status === 'OTHER' || job.current_status === 'MISCELLANEOUS'
                const feedback = reclassifyFeedback[job.id]
                const isReclassifying = reclassifyLoading[job.id]

                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="group hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 pl-2 rounded-l-xl">
                      <span className="font-bold text-white truncate max-w-[160px] block">
                        {job.company || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-[#919191] text-sm truncate max-w-[200px] block">
                        {job.role || '—'}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`flex items-center gap-1.5 ${color}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        {countdown && (
                          <span className="text-xs bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20 px-1.5 py-0.5 rounded-full">
                            📅 {countdown}
                          </span>
                        )}
                        {isReclassifiable && (
                          <button
                            onClick={e => handleReclassify(e, job)}
                            disabled={isReclassifying}
                            title="Reclassify via AI"
                            className="text-xs bg-[#1A1A1A] hover:bg-[#222] border border-[#333] hover:border-[#86efac] text-[#919191] hover:text-[#86efac] px-1.5 py-0.5 rounded-full transition-colors flex items-center gap-1 disabled:opacity-40"
                          >
                            <RotateCcw className={`h-3 w-3 ${isReclassifying ? 'animate-spin' : ''}`} />
                            {feedback ? feedback : 'Reclassify'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="text-[#919191] text-sm capitalize">
                        {job.job_type?.toLowerCase().replace(/_/g, ' ') ?? '—'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right text-[#919191] text-sm pr-2 rounded-r-xl">
                      {formatDate(job.last_update_date)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#919191]">
            No jobs found{search ? ` matching "${search}"` : ''}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-[#222]">
            <span className="text-[#919191] text-xs">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#333] text-[#919191] hover:text-white hover:border-[#555] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-[#919191] text-xs px-2">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#333] text-[#919191] hover:text-white hover:border-[#555] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <StatusEditor
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onUpdateStatus={onUpdateStatus}
        onUpdateNotes={onUpdateNotes}
      />
    </>
  )
}
