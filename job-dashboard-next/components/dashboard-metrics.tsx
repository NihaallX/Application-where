"use client"

import { Briefcase } from 'lucide-react'
import type { Job } from '@/hooks/use-jobs'

interface Props {
  jobs: Job[]
  loading: boolean
  activeFilter: string | null
  onFilter: (status: string | null) => void
}

export function DashboardMetrics({ jobs, loading, activeFilter, onFilter }: Props) {
  const total = jobs.length
  const applied  = jobs.filter(j => ['APPLIED_CONFIRMATION', 'APPLICATION_VIEWED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.current_status)).length
  const interviews = jobs.filter(j => j.current_status === 'INTERVIEW').length
  const offers = jobs.filter(j => j.current_status === 'OFFER').length
  const rejected = jobs.filter(j => j.current_status === 'REJECTED').length
  const recruiters = jobs.filter(j => j.current_status === 'RECRUITER_OUTREACH').length

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-[#0D0D0D] rounded-2xl animate-pulse">
        <div className="h-4 bg-[#1A1A1A] rounded w-32" />
        <div className="h-12 bg-[#1A1A1A] rounded w-48" />
      </div>
    )
  }

  const statCards = [
    { label: 'Interviews', value: interviews, color: 'text-[#60a5fa]', ring: 'ring-[#60a5fa]', filter: 'INTERVIEW' },
    { label: 'Offers', value: offers, color: 'text-[#86efac]', ring: 'ring-[#86efac]', filter: 'OFFER' },
    { label: 'Rejections', value: rejected, color: 'text-[#F87171]', ring: 'ring-[#F87171]', filter: 'REJECTED' },
    { label: 'Recruiters', value: recruiters, color: 'text-[#fbbf24]', ring: 'ring-[#fbbf24]', filter: 'RECRUITER_OUTREACH' },
  ]

  return (
    <div className="flex flex-col xl:flex-row gap-8 xl:items-center justify-between p-6 bg-[#0D0D0D] rounded-2xl">
      {/* Main applied count — clicking clears filter */}
      <button
        onClick={() => onFilter(null)}
        className={`flex flex-col gap-2 text-left transition-opacity ${activeFilter ? 'opacity-50 hover:opacity-75' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-2 text-gray-400">
          <Briefcase className="h-5 w-5" />
          <span className="text-lg">Applications Sent</span>
        </div>
        <div className="text-5xl md:text-4xl lg:text-5xl font-bold text-white">
          {applied.toLocaleString()}
        </div>
        <div className="text-[#919191] text-xs">
          {total.toLocaleString()} total tracked
        </div>
      </button>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 xl:gap-16">
        {statCards.map(card => {
          const isActive = activeFilter === card.filter
          return (
            <button
              key={card.label}
              onClick={() => onFilter(isActive ? null : card.filter)}
              className={`flex flex-col gap-1 text-left rounded-xl px-3 py-2 -mx-3 -my-2 transition-colors ${
                isActive
                  ? `ring-1 ${card.ring} bg-white/5`
                  : 'hover:bg-white/5'
              }`}
            >
              <span className="text-gray-400 text-sm">{card.label}</span>
              <span className={`text-2xl md:text-xl lg:text-2xl font-semibold ${card.color}`}>
                {card.value}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
