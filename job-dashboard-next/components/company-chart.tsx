"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { Job } from '@/hooks/use-jobs'

const BAR_COLORS = [
  '#86efac', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6',
  '#34d399', '#f87171', '#38bdf8', '#c084fc', '#fb923c',
]

interface Props {
  jobs: Job[]
  loading?: boolean
}

interface TooltipPayload {
  value: number
  payload: { fullName: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2 text-sm">
      <p className="text-white font-medium">{payload[0].payload.fullName}</p>
      <p className="text-[#919191]">{payload[0].value} applications</p>
    </div>
  )
}

export function CompanyChart({ jobs, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 animate-pulse flex flex-col gap-4">
        <div className="h-5 w-40 bg-[#1A1A1A] rounded" />
        <div className="h-48 bg-[#1A1A1A] rounded-xl" />
      </div>
    )
  }

  const counts: Record<string, number> = {}
  for (const job of jobs) {
    if (job.company) counts[job.company] = (counts[job.company] ?? 0) + 1
  }

  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      // Truncate long names so they don't overflow the axis
      name: name.length > 18 ? name.slice(0, 17) + '…' : name,
      fullName: name,
      count,
    }))

  // Dynamic height: 36px per bar + padding
  const chartHeight = data.length * 36 + 16
  // Dynamic left margin: base it on the longest label
  const maxLabelLen = Math.max(...data.map(d => d.name.length))
  const yAxisWidth = Math.min(Math.max(maxLabelLen * 7, 80), 160)

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
      <h2 className="text-white font-bold text-base">Top Companies</h2>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          barSize={14}
          margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#919191', fontSize: 11 }}
            width={yAxisWidth}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}

          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
