"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts'
import type { Job } from '@/hooks/use-jobs'

interface Props {
  jobs: Job[]
  loading?: boolean
}

const FUNNEL_COLOR = ['#86efac', '#60a5fa', '#4ADE80']

interface TooltipPayload {
  value: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2 text-sm">
      <p className="text-white font-medium">{label}</p>
      <p className="text-[#919191]">{payload[0].value} jobs</p>
    </div>
  )
}

export function FunnelChart({ jobs, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 animate-pulse flex flex-col gap-4">
        <div className="h-5 w-28 bg-[#1A1A1A] rounded" />
        <div className="h-48 bg-[#1A1A1A] rounded-xl" />
      </div>
    )
  }

  const applied = jobs.filter(j =>
    ['APPLIED_CONFIRMATION', 'APPLICATION_VIEWED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED'].includes(j.current_status)
  ).length
  const interviews = jobs.filter(j => ['INTERVIEW', 'OFFER'].includes(j.current_status)).length
  const offers = jobs.filter(j => j.current_status === 'OFFER').length

  const data = [
    { stage: 'Applied', count: applied },
    { stage: 'Interview', count: interviews },
    { stage: 'Offer', count: offers },
  ]

  const interviewRate = applied > 0 ? ((interviews / applied) * 100).toFixed(0) : '0'
  const offerRate = interviews > 0 ? ((offers / interviews) * 100).toFixed(0) : '0'

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">Pipeline Funnel</h2>
        <div className="flex gap-3 text-xs text-[#919191]">
          <span>Interview rate: <span className="text-[#60a5fa] font-medium">{interviewRate}%</span></span>
          <span>Offer rate: <span className="text-[#4ADE80] font-medium">{offerRate}%</span></span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="stage"
            tick={{ fill: '#919191', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={FUNNEL_COLOR[i]} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{ fill: '#919191', fontSize: '12px' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
