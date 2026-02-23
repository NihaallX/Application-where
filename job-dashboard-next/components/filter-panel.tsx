"use client"

import type { Filters } from '@/hooks/use-jobs'

interface FilterOptions {
  companies: string[]
  jobTypes: string[]
  workModes: string[]
  platforms: string[]
}

interface Props {
  filters: Filters
  setFilters: (f: Filters) => void
  filterOptions: FilterOptions
}

const selectClass =
  'bg-[#1A1A1A] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none hover:border-[#555] focus:border-[#86efac] transition-colors cursor-pointer'

export function FilterPanel({ filters, setFilters, filterOptions }: Props) {
  function update(key: keyof Filters, value: string) {
    setFilters({ ...filters, [key]: value })
  }

  const hasActive =
    filters.company || filters.job_type || filters.work_mode || filters.source_platform

  return (
    <div className="bg-[#0D0D0D] border border-[#222] rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <span className="text-[#919191] text-sm font-medium mr-1">Filter</span>

      <select
        className={selectClass}
        value={filters.company}
        onChange={e => update('company', e.target.value)}
      >
        <option value="">All Companies</option>
        {filterOptions.companies.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.job_type}
        onChange={e => update('job_type', e.target.value)}
      >
        <option value="">All Types</option>
        {filterOptions.jobTypes.map(t => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.work_mode}
        onChange={e => update('work_mode', e.target.value)}
      >
        <option value="">All Modes</option>
        {filterOptions.workModes.map(m => (
          <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.source_platform}
        onChange={e => update('source_platform', e.target.value)}
      >
        <option value="">All Platforms</option>
        {filterOptions.platforms.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {hasActive && (
        <button
          onClick={() =>
            setFilters({ company: '', job_type: '', work_mode: '', source_platform: '' })
          }
          className="text-xs text-[#F87171] hover:text-white transition-colors ml-1 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
