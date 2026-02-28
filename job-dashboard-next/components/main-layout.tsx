'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useJobs } from '@/hooks/use-jobs'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { FilterPanel } from '@/components/filter-panel'
import { DashboardMetrics } from '@/components/dashboard-metrics'
import { ApplicationsChart } from '@/components/applications-chart'
import { JobsTable } from '@/components/jobs-table'
import { ReviewPanel } from '@/components/review-panel'
import { StatusPieChart } from '@/components/status-pie-chart'
import { CompanyChart } from '@/components/company-chart'
import { FunnelChart } from '@/components/funnel-chart'
import { BreakdownBarChart } from '@/components/breakdown-bar-chart'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SyncStatus {
  mode: string
  started_at: string
  last_updated: string
  emails_fetched: number
  emails_classified: number
  emails_skipped: number
  jobs_created: number
  errors: number
  rate_limits_hit: number
  is_running: boolean
  process_alive: boolean
  last_error: string
  groq_requests_total: number
  groq_requests_this_minute: number
  groq_minute_started: string
  active_key_index: number
  key_requests_total: number[]
  key_rate_limited: boolean[]
  tokens_used_session: number
  tokens_used_today: number
  tokens_day_limit: number
}
interface LogEntry { timestamp: string; level: string; message: string; data?: Record<string, unknown> }
interface GroqLimits {
  limits: { requests_per_minute: number; tokens_per_minute: number; tokens_per_day: number; requests_per_day: number }
  throttle_config: { min_delay_ms: number; effective_rpm: number; backoff_strategy: string; max_retries: number }
}
interface ResumeState { emails_processed: number }

// ─── Groq countdown hook ─────────────────────────────────────────────────────
function useGroqCountdown(minuteStarted: string | undefined) {
  const [sec, setSec] = useState(60)
  useEffect(() => {
    const tick = () => {
      if (!minuteStarted) { setSec(60); return }
      const elapsed = Math.floor((Date.now() - new Date(minuteStarted).getTime()) / 1000)
      setSec(Math.max(0, 60 - elapsed))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [minuteStarted])
  return sec
}

// ─── Full Monitor view ────────────────────────────────────────────────────────
function MonitorView() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [groqLimits, setGroqLimits] = useState<GroqLimits | null>(null)
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [keyMsg, setKeyMsg] = useState('')
  const [keyLoading, setKeyLoading] = useState(false)
  const [controlMsg, setControlMsg] = useState('')
  const [controlLoading, setControlLoading] = useState(false)
  const [otherCount, setOtherCount] = useState<number | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; changed: number; current: string } | null>(null)
  const [bulkMsg, setBulkMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const processAlive = status?.process_alive ?? false

  const fetchStatus = useCallback(async () => {
    try {
      const [sr, rr] = await Promise.all([
        fetch('/api/sync-status'),
        fetch('/api/resume-state'),
      ])
      setStatus(await sr.json())
      setResumeState(await rr.json())
    } catch { /* ignore */ }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?tail=200')
      const data = await res.json()
      setLogs(data.lines ?? [])
      setLogTotal(data.total ?? 0)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus(); fetchLogs()
    fetch('/api/groq-limits').then(r => r.json()).then(setGroqLimits).catch(() => { })
    fetch('/api/reclassify-bulk').then(r => r.json()).then(d => setOtherCount(d.count ?? null)).catch(() => { })
    const s = setInterval(fetchStatus, 2000)
    const l = setInterval(fetchLogs, 3000)
    return () => { clearInterval(s); clearInterval(l) }
  }, [fetchStatus, fetchLogs])

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  async function handleStart(mode: 'backfill' | 'sync') {
    setControlLoading(true); setControlMsg('')
    try {
      const res = await fetch('/api/backfill/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const d = await res.json()
      setControlMsg(d.success ? `✅ ${d.message}` : `❌ ${d.error ?? 'Failed'}`)
      fetchStatus()
    } catch (e: unknown) { setControlMsg(`❌ ${String(e)}`) }
    setControlLoading(false)
  }

  async function handleStop() {
    setControlLoading(true); setControlMsg('')
    try {
      const res = await fetch('/api/backfill/stop', { method: 'POST' })
      const d = await res.json()
      setControlMsg(d.success ? `✅ ${d.message}` : `❌ ${d.error ?? 'Failed'}`)
      fetchStatus()
    } catch (e: unknown) { setControlMsg(`❌ ${String(e)}`) }
    setControlLoading(false)
  }

  async function handleBulkReclassify() {
    setBulkRunning(true); setBulkMsg(''); setBulkProgress(null)
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const res = await fetch('/api/reclassify-bulk', { method: 'POST' })
      if (!res.ok || !res.body) {
        setBulkMsg(`❌ Request failed: ${res.status}`)
        setBulkRunning(false)
        return
      }
      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const d = JSON.parse(line.slice(5).trim())
            if (d.type === 'progress' || d.type === 'start') {
              setBulkProgress({ done: d.done ?? 0, total: d.total ?? 0, changed: d.changed ?? 0, current: d.current ?? '' })
            } else if (d.type === 'done') {
              setBulkProgress({ done: d.done, total: d.total, changed: d.changed, current: '' })
              setBulkMsg(`✅ Done — ${d.changed} of ${d.total} jobs reclassified`)
              setOtherCount((d.total - d.changed))
            } else if (d.type === 'error') {
              setBulkMsg(`❌ ${d.message}`)
            }
          } catch { /* ignore parse error */ }
        }
      }
    } catch (e: unknown) { setBulkMsg(`❌ ${String(e)}`) }
    finally { reader?.cancel() }
    setBulkRunning(false)
  }

  async function handleUpdateKey() {
    if (!apiKey.trim()) return
    setKeyLoading(true); setKeyMsg('')
    try {
      const res = await fetch('/api/update-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) })
      const d = await res.json()
      setKeyMsg(d.success ? `✅ ${d.message}` : `❌ ${d.error ?? 'Failed'}`)
      if (d.success) setApiKey('')
    } catch (e: unknown) { setKeyMsg(`❌ ${String(e)}`) }
    setKeyLoading(false)
  }

  const countdown = useGroqCountdown(status?.groq_minute_started)
  const elapsed = status?.started_at
    ? Math.round((new Date(status.last_updated ?? Date.now()).getTime() - new Date(status.started_at).getTime()) / 1000)
    : 0
  const elapsedStr = elapsed > 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`
  const keyLabels = ['Key 1', 'Key 2', 'Key 3']
  const activeIdx = status?.active_key_index ?? 0
  const keyTotals = status?.key_requests_total ?? [0, 0, 0]
  const keyLimited = status?.key_rate_limited ?? [false, false, false]

  const card = (label: string, value: string | number, accent: string) => (
    <div key={label} className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-[#919191] text-xs uppercase tracking-wider">{label}</span>
      <span className="font-bold text-2xl" style={{ color: accent }}>{value}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">System Monitor</h1>
          <p className="text-[#919191] text-sm">Live backfill progress, API usage & controls</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${processAlive ? 'bg-[#86efac]/10 text-[#86efac] border border-[#86efac]/30'
            : status?.is_running ? 'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30'
              : 'bg-[#333] text-[#919191]'
          }`}>
          {processAlive ? '● RUNNING' : status?.is_running ? '● SYNCING' : '○ IDLE'}
        </span>
      </div>

      {/* Backfill Controls */}
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-white font-bold text-sm">Backfill Controls</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => handleStart('backfill')}
            disabled={controlLoading || processAlive}
            className="bg-[#86efac]/10 hover:bg-[#86efac]/20 border border-[#86efac]/30 text-[#86efac] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Start Backfill
          </button>
          <button
            onClick={() => handleStart('sync')}
            disabled={controlLoading || processAlive}
            className="bg-[#60a5fa]/10 hover:bg-[#60a5fa]/20 border border-[#60a5fa]/30 text-[#60a5fa] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔄 Start Sync
          </button>
          <button
            onClick={handleStop}
            disabled={controlLoading || !processAlive}
            className="bg-[#F87171]/10 hover:bg-[#F87171]/20 border border-[#F87171]/30 text-[#F87171] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ⏹ Stop
          </button>
          {resumeState && (
            <span className="text-[#919191] text-xs ml-2">
              📍 Resume available: {resumeState.emails_processed} emails processed
            </span>
          )}
        </div>
        {controlMsg && (
          <p className={`text-sm ${controlMsg.startsWith('✅') ? 'text-[#86efac]' : 'text-[#F87171]'}`}>{controlMsg}</p>
        )}
      </div>

      {/* Bulk Reclassify */}
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">🔁 Bulk Reclassify OTHER Jobs</h2>
            <p className="text-[#919191] text-xs mt-0.5">
              {otherCount !== null ? `${otherCount} jobs currently marked OTHER/MISCELLANEOUS` : 'Loading count…'}
            </p>
          </div>
          <button
            onClick={handleBulkReclassify}
            disabled={bulkRunning || otherCount === null || otherCount === 0}
            className="bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 border border-[#a78bfa]/30 text-[#a78bfa] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {bulkRunning ? '⏳ Running…' : '▶ Start'}
          </button>
        </div>

        {bulkProgress && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-[#919191]">
              <span className="truncate max-w-[60%] text-[#666]">{bulkProgress.current}</span>
              <span>
                <b className="text-white font-mono">{bulkProgress.done}</b>
                <span className="mx-1">/</span>
                <b className="text-white font-mono">{bulkProgress.total}</b>
                <span className="mx-2 text-[#86efac] font-mono">+{bulkProgress.changed} changed</span>
              </span>
            </div>
            <div className="bg-[#1A1A1A] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#a78bfa] transition-[width]"
                style={{ width: bulkProgress.total ? `${(bulkProgress.done / bulkProgress.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {bulkMsg && (
          <p className={`text-sm ${bulkMsg.startsWith('✅') ? 'text-[#86efac]' : 'text-[#F87171]'}`}>{bulkMsg}</p>
        )}
      </div>

      {/* Progress metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {card('Emails Fetched', status?.emails_fetched ?? 0, '#60a5fa')}
        {card('Classified', status?.emails_classified ?? 0, '#86efac')}
        {card('Skipped', status?.emails_skipped ?? 0, '#919191')}
        {card('Jobs Created', status?.jobs_created ?? 0, '#fbbf24')}
        {card('Errors', status?.errors ?? 0, '#F87171')}
        {card('Elapsed', elapsedStr, '#a78bfa')}
      </div>

      {/* Groq API Usage */}
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">⚡ Groq API Usage</h2>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[#919191] text-xs uppercase tracking-wider">Resets in</p>
              <p className={`font-mono font-bold text-lg ${countdown < 10 ? 'text-[#F87171]' : countdown < 30 ? 'text-[#fbbf24]' : 'text-[#86efac]'}`}>
                {String(countdown).padStart(2, '0')}s
              </p>
            </div>
            <div>
              <p className="text-[#919191] text-xs uppercase tracking-wider">Total Requests</p>
              <p className="font-mono font-bold text-lg text-white">{status?.groq_requests_total ?? 0}</p>
            </div>
            <div>
              <p className="text-[#919191] text-xs uppercase tracking-wider">Rate Limits</p>
              <p className={`font-mono font-bold text-lg ${(status?.rate_limits_hit ?? 0) > 0 ? 'text-[#F87171]' : 'text-white'}`}>
                {status?.rate_limits_hit ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Daily token budget */}
        {(() => {
          const used = status?.tokens_used_today ?? 0
          const limit = status?.tokens_day_limit ?? 100000
          const session = status?.tokens_used_session ?? 0
          const pct = Math.min(100, (used / limit) * 100)
          const barColor = pct >= 90 ? '#F87171' : pct >= 70 ? '#fbbf24' : '#86efac'
          return (
            <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-[#919191] uppercase tracking-wider font-medium">Daily Token Budget</span>
                <div className="flex gap-4 text-[#919191]">
                  <span>Session: <b className="text-white font-mono">{session.toLocaleString()}</b></span>
                  <b className="font-mono" style={{ color: barColor }}>{used.toLocaleString()} / {limit.toLocaleString()}</b>
                  <b style={{ color: barColor }}>{pct.toFixed(1)}%</b>
                </div>
              </div>
              <div className="bg-black rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-[width,background-color]" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
              {pct >= 90 && <p className="text-[#F87171] text-xs font-medium">⚠ Approaching daily limit</p>}
            </div>
          )
        })()}

        {/* Per-key bars */}
        <div className="flex flex-col gap-4">
          {keyLabels.map((label, i) => {
            const isActive = i === activeIdx && processAlive
            const isLimited = keyLimited[i]
            const reqsMin = isActive ? (status?.groq_requests_this_minute ?? 0) : 0
            const total = keyTotals[i] ?? 0
            const pct = Math.min(100, (reqsMin / 30) * 100)
            const barColor = isLimited ? '#F87171' : pct > 80 ? '#fbbf24' : '#86efac'
            return (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-[#555]'}`}>{label}</span>
                    {isActive && <span className="text-xs bg-[#86efac]/10 border border-[#86efac]/30 text-[#86efac] px-2 py-0.5 rounded-full">ACTIVE</span>}
                    {isLimited && <span className="text-xs bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] px-2 py-0.5 rounded-full">RATE LIMITED</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-[#919191]">
                    <span>This min: <b className="text-white font-mono">{isActive ? `${reqsMin}/30` : '—'}</b></span>
                    <span>Total: <b className={`font-mono ${total > 0 ? 'text-white' : 'text-[#555]'}`}>{total}</b></span>
                  </div>
                </div>
                <div className="bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden" style={{ opacity: isActive ? 1 : 0.3 }}>
                  <div className="h-full rounded-full transition-[width,background-color]" style={{ width: isActive ? `${pct}%` : '0%', backgroundColor: barColor }} />
                </div>
              </div>
            )
          })}
        </div>

        {status?.last_error && (
          <div className="bg-[#F87171]/10 border border-[#F87171]/30 rounded-xl px-4 py-3 text-[#F87171] text-sm">
            ⚠ Last Error: {status.last_error}
          </div>
        )}
      </div>

      {/* API Key */}
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-3">
        <h2 className="text-white font-bold text-sm">🔑 Update Groq API Key</h2>
        <p className="text-[#919191] text-xs">Backend hot-reloads within ~10s — no restart needed.</p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUpdateKey()}
            placeholder="gsk_..."
            className="flex-1 bg-[#1A1A1A] border border-[#333] focus:border-[#86efac] text-white font-mono text-sm rounded-xl px-4 py-2.5 outline-none transition-colors"
          />
          <button
            onClick={handleUpdateKey}
            disabled={keyLoading || !apiKey.trim()}
            className="bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 border border-[#a78bfa]/30 text-[#a78bfa] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
          >
            {keyLoading ? '...' : 'Update'}
          </button>
        </div>
        {keyMsg && <p className={`text-sm ${keyMsg.startsWith('✅') ? 'text-[#86efac]' : 'text-[#F87171]'}`}>{keyMsg}</p>}
      </div>

      {/* Live Logs */}
      <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">📋 Live Logs <span className="text-[#919191] font-normal text-xs ml-1">({logTotal} total)</span></h2>
          <label className="flex items-center gap-2 text-[#919191] text-xs cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="accent-[#86efac]" />
            Auto-scroll
          </label>
        </div>
        <div
          ref={logRef}
          className="bg-black rounded-xl p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="text-[#555] text-center pt-12">No logs. Start backfill above to begin.</p>
          ) : logs.map((entry, i) => (
            <div key={i} className="flex gap-3 border-b border-[#111] py-1">
              <span className="text-[#555] shrink-0">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'}</span>
              <span className={`shrink-0 font-bold w-10 ${entry.level === 'ERROR' ? 'text-[#F87171]'
                  : entry.level === 'WARN' ? 'text-[#fbbf24]'
                    : entry.level === 'DEBUG' ? 'text-[#a78bfa]'
                      : 'text-[#60a5fa]'
                }`}>{entry.level}</span>
              <span className="text-[#ccc]">
                {entry.message}
                {entry.data && <span className="text-[#555] ml-2">{JSON.stringify(entry.data)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Groq Tier Limits */}
      {groqLimits && (
        <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-white font-bold text-sm">📊 Groq Free Tier Limits</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ['Requests / Minute', groqLimits.limits.requests_per_minute],
              ['Tokens / Minute', groqLimits.limits.tokens_per_minute.toLocaleString()],
              ['Requests / Day', groqLimits.limits.requests_per_day.toLocaleString()],
              ['Throttle Delay', `${groqLimits.throttle_config.min_delay_ms}ms (${groqLimits.throttle_config.effective_rpm} rpm)`],
              ['Backoff Strategy', groqLimits.throttle_config.backoff_strategy],
              ['Max Retries', groqLimits.throttle_config.max_retries],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-[#1A1A1A] rounded-xl p-3">
                <p className="text-[#919191] text-xs mb-1">{k}</p>
                <p className="text-white text-sm font-medium">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export function MainLayout() {
  const [active, setActive] = useState('dashboard')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const {
    jobs, timeline, emails, loading, error,
    filters, setFilters, filterOptions,
    updateJobStatus, updateNotes, updateEmailCategory, reclassifyEmail,
  } = useJobs()

  function handleCardFilter(status: string | null) {
    setStatusFilter(status)
    if (status) {
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  function renderContent() {
    if (error) {
      return (
        <div className="flex items-center justify-center h-64 text-[#919191]">
          <div className="text-center">
            <p className="text-[#F87171] font-medium mb-1">Failed to load data</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )
    }

    switch (active) {
      case 'dashboard':
        return (
          <div className="flex flex-col gap-6">
            <FilterPanel filters={filters} setFilters={setFilters} filterOptions={filterOptions} />
            <DashboardMetrics
              jobs={jobs}
              loading={loading}
              activeFilter={statusFilter}
              onFilter={handleCardFilter}
            />
            <ApplicationsChart timeline={timeline} loading={loading} />
            <div ref={tableRef}>
              <JobsTable
                jobs={jobs}
                loading={loading}
                onUpdateStatus={updateJobStatus}
                onUpdateNotes={updateNotes}
                onReclassify={reclassifyEmail}
                activeStatusFilter={statusFilter}
                onClearFilter={() => setStatusFilter(null)}
              />
            </div>
          </div>
        )

      case 'analytics': {
        const total = jobs.length
        const interviewed = jobs.filter(j => j.current_status === 'INTERVIEW').length
        const offered = jobs.filter(j => j.current_status === 'OFFER').length
        const rejected = jobs.filter(j => j.current_status === 'REJECTED').length
        const ghosted = jobs.filter(j => j.current_status === 'GHOSTED').length
        const active = jobs.filter(j => !['REJECTED', 'GHOSTED', 'OTHER', 'MISCELLANEOUS'].includes(j.current_status)).length

        const pct = (n: number) => total ? `${((n / total) * 100).toFixed(1)}%` : '—'

        const workModeData = ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN']
          .map(m => ({ name: m.charAt(0) + m.slice(1).toLowerCase(), count: jobs.filter(j => j.work_mode === m).length }))
          .filter(d => d.count > 0)

        const jobTypeData = ['INTERNSHIP', 'FULL_TIME', 'CONTRACT', 'UNKNOWN']
          .map(t => ({ name: t === 'FULL_TIME' ? 'Full-time' : t.charAt(0) + t.slice(1).toLowerCase(), count: jobs.filter(j => j.job_type === t).length }))
          .filter(d => d.count > 0)

        const platformData = Object.entries(
          jobs.reduce<Record<string, number>>((acc, j) => {
            const p = j.source_platform || 'unknown'
            acc[p] = (acc[p] ?? 0) + 1
            return acc
          }, {})
        )
          .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)

        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-white font-bold text-xl mb-1">Analytics</h1>
              <p className="text-[#919191] text-sm">Visual breakdown of your job search pipeline</p>
            </div>

            {/* Conversion stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: 'Total Tracked', value: total, accent: '#e7e7e7' },
                { label: 'Interview Rate', value: pct(interviewed), accent: '#60a5fa' },
                { label: 'Offer Rate', value: pct(offered), accent: '#86efac' },
                { label: 'Ghosted', value: ghosted, accent: '#9ca3af' },
                { label: 'Active Pipeline', value: active, accent: '#fbbf24' },
              ] as { label: string; value: string | number; accent: string }[]).map(({ label, value, accent }) => (
                <div key={label} className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-[#919191] text-xs uppercase tracking-wider">{label}</span>
                  <span className="font-bold text-2xl" style={{ color: accent }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Charts row 1: funnel + status pie + company */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FunnelChart jobs={jobs} loading={loading} />
              <StatusPieChart jobs={jobs} loading={loading} />
              <CompanyChart jobs={jobs} loading={loading} />
            </div>

            {/* Charts row 2: work mode + job type + platform */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <BreakdownBarChart title="Work Mode" data={workModeData} loading={loading} color="#60a5fa" />
              <BreakdownBarChart title="Job Type" data={jobTypeData} loading={loading} color="#a78bfa" />
              <BreakdownBarChart title="Platform" data={platformData} loading={loading} />
            </div>
          </div>
        )
      }

      case 'review':
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-white font-bold text-xl mb-1">Review</h1>
              <p className="text-[#919191] text-sm">Emails the AI classified with low confidence — classify them manually</p>
            </div>
            {emails.length === 0 && !loading ? (
              <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
                <div className="text-3xl">✅</div>
                <p className="text-white font-medium">All clear!</p>
                <p className="text-[#919191] text-sm">No uncertain classifications to review right now.</p>
              </div>
            ) : (
              <ReviewPanel emails={emails} onClassify={updateEmailCategory} />
            )}
          </div>
        )

      case 'monitor':
        return <MonitorView />

      default:
        return null
    }
  }

  return (
    <div className="relative h-screen w-full bg-black text-white overflow-hidden">
      <Header />
      <div className="h-full overflow-y-auto no-scrollbar">
        <main className="flex gap-6 p-4 md:p-6 pt-20 md:pt-24 pb-24 md:pb-6 min-h-full">
          <Sidebar active={active} setActive={id => { setActive(id); setStatusFilter(null) }} />
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {renderContent()}
            <div className="flex items-center justify-end gap-2 mt-4 pb-6">
              <div className="w-[13px] h-[13px] rounded-full bg-[#86efac]" />
              <span className="text-sm text-[#919191]">Live</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
