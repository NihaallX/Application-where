'use client'

import { useJobs } from '@/hooks/use-jobs'
import { DashboardMetrics } from '@/components/dashboard-metrics'
import { ApplicationsChart } from '@/components/applications-chart'
import { JobsTable } from '@/components/jobs-table'
import { FilterPanel } from '@/components/filter-panel'
import { ReviewPanel } from '@/components/review-panel'
import { StatusPieChart } from '@/components/status-pie-chart'
import { CompanyChart } from '@/components/company-chart'
import { FunnelChart } from '@/components/funnel-chart'

export function DashboardClient() {
  const {
    jobs, timeline, emails, loading, error,
    filters, setFilters, filterOptions,
    updateJobStatus, updateNotes, updateEmailCategory, reclassifyEmail,
  } = useJobs()

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

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <FilterPanel filters={filters} setFilters={setFilters} filterOptions={filterOptions} />

      {/* Uncertain email review */}
      {emails.length > 0 && (
        <ReviewPanel emails={emails} onClassify={updateEmailCategory} />
      )}

      {/* Metrics */}
      <DashboardMetrics jobs={jobs} loading={loading} activeFilter={null} onFilter={() => {}} />

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FunnelChart jobs={jobs} loading={loading} />
        <StatusPieChart jobs={jobs} loading={loading} />
        <CompanyChart jobs={jobs} loading={loading} />
      </div>

      {/* Timeline area chart */}
      <ApplicationsChart timeline={timeline} loading={loading} />

      {/* Jobs table with status editor */}
      <JobsTable
        jobs={jobs}
        loading={loading}
        onUpdateStatus={updateJobStatus}
        onUpdateNotes={updateNotes}
        onReclassify={reclassifyEmail}
      />
    </div>
  )
}

