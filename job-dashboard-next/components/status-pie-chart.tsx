"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Job } from '@/hooks/use-jobs'

const STATUS_COLOR: Record<string, string> = {
  OFFER: '#4ADE80',
  INTERVIEW: '#60a5fa',
  APPLIED_CONFIRMATION: '#86efac',
  APPLICATION_VIEWED: '#a78bfa',
  REJECTED: '#F87171',
  GHOSTED: '#9ca3af',
  RECRUITER_OUTREACH: '#fbbf24',
  OTHER: '#919191',
  MISCELLANEOUS: '#6b7280',
}

const STATUS_LABEL: Record<string, string> = {
  OFFER: 'Offer',
  INTERVIEW: 'Interview',
  APPLIED_CONFIRMATION: 'Applied',
  APPLICATION_VIEWED: 'Viewed',
  REJECTED: 'Rejected',
  GHOSTED: 'Ghosted',
  RECRUITER_OUTREACH: 'Recruiter',
  OTHER: 'Other',
  MISCELLANEOUS: 'Misc',
}

interface Props {
  jobs: Job[]
  loading?: boolean
}

interface TooltipPayload {
  name: string
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2 text-sm">
      <p className="text-white font-medium">{name}</p>
      <p className="text-[#919191]">{value} jobs</p>
    </div>
  )
}

export function StatusPieChart({ jobs, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 animate-pulse flex flex-col gap-4">
        <div className="h-5 w-32 bg-[#1A1A1A] rounded" />
        <div className="h-48 bg-[#1A1A1A] rounded-xl" />
      </div>
    )
  }

  const counts: Record<string, number> = {}
  for (const job of jobs) {
    const s = job.current_status ?? 'OTHER'
    counts[s] = (counts[s] ?? 0) + 1
  }

  const data = Object.entries(counts)
    .map(([status, value]) => ({
      name: STATUS_LABEL[status] ?? status,
      value,
      color: STATUS_COLOR[status] ?? '#919191',
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
      <h2 className="text-white font-bold text-base">Status Breakdown</h2>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full shrink-0"
              style={{ width: 8, height: 8, backgroundColor: entry.color }}
            />
            <span className="text-[#919191] text-xs font-medium leading-none">
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
