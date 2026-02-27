"use client"

import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import {
  Area, AreaChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts"
import type { TimelinePoint } from '@/hooks/use-jobs'

interface Props {
  timeline: TimelinePoint[]
  loading: boolean
}

type Period = '1W' | '1M' | '3M' | 'ALL'

function formatLabel(dateStr: string, showYear: boolean): string {
  const d = new Date(dateStr)
  if (showYear) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' })
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function ApplicationsChart({ timeline, loading }: Props) {
  const [period, setPeriod] = useState<Period>('ALL')

  const chartData = useMemo(() => {
    if (!timeline.length) return []
    const now = new Date()
    const cutoffDays: Record<Period, number> = { '1W': 7, '1M': 30, '3M': 90, ALL: 99999 }
    const days = cutoffDays[period]
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)

    const filtered = timeline.filter(p => new Date(p.date) >= cutoff)
    const years = new Set(filtered.map(p => new Date(p.date).getUTCFullYear()))
    const showYear = years.size > 1

    return filtered.map(p => ({
      date: formatLabel(p.date, showYear),
      rawDate: p.date,
      count: Number(p.count),
    }))
  }, [timeline, period])

  const maxCount = Math.max(...chartData.map(d => d.count), 1)
  const yMax = Math.ceil(maxCount * 1.2)

  const interval = Math.max(0, Math.floor(chartData.length / 8) - 1)

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-[#0D0D0D] rounded-2xl animate-pulse">
        <div className="h-6 bg-[#1A1A1A] rounded w-48" />
        <div className="h-[400px] bg-[#1A1A1A] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0D0D0D] rounded-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-medium text-white">Applications</h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1A1A1A] rounded-full border border-[#333]">
            <div className="w-2 h-2 rounded-full bg-[#86efac]" />
            <span className="text-sm font-medium text-white">Timeline</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#1A1A1A] rounded-lg p-1">
            {(['1W', '1M', '3M', 'ALL'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  p === period
                    ? 'bg-[#2A2A2A] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="p-2 text-gray-400 hover:text-white bg-[#1A1A1A] rounded-lg transition-colors">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#86efac" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#666', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={interval}
            />
            <YAxis
              domain={[0, yMax]}
              orientation="left"
              tick={{ fill: '#666', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#1A1A1A] border border-[#333] px-3 py-2 rounded-lg shadow-xl">
                      <p className="text-white font-medium text-sm">
                        {payload[0].value} application{Number(payload[0].value) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {new Date(payload[0].payload.rawDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#86efac"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorApps)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
