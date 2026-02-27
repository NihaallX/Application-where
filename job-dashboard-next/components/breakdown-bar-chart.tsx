"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Entry { name: string; count: number }

interface Props {
  title: string
  data: Entry[]
  loading: boolean
  color?: string
}

const COLORS = ['#86efac', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6', '#34d399', '#fb923c']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#333] px-3 py-2 rounded-lg shadow-xl text-sm">
      <p className="text-white font-medium">{payload[0].payload.name}</p>
      <p className="text-[#919191]">{payload[0].value} jobs</p>
    </div>
  )
}

export function BreakdownBarChart({ title, data, loading, color }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4 animate-pulse">
        <div className="h-4 bg-[#1A1A1A] rounded w-32" />
        <div className="h-40 bg-[#1A1A1A] rounded-xl" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-white font-bold text-base">{title}</h2>
        <p className="text-[#555] text-sm text-center py-8">No data</p>
      </div>
    )
  }

  const chartHeight = Math.max(data.length * 38 + 16, 120)
  const maxLabelLen = Math.max(...data.map(d => d.name.length))
  const yAxisWidth = Math.min(Math.max(maxLabelLen * 7, 80), 160)

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
      <h2 className="text-white font-bold text-base">{title}</h2>
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
              <Cell key={i} fill={color ?? COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
