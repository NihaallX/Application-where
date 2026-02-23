'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Job {
  id: string
  company: string
  role: string
  current_status: string
  job_type: string
  work_mode: string
  first_email_date: string
  source_platform: string
  last_update_date: string
  interview_date: string | null
  created_at: string
  notes: string
}

export interface Email {
  id: string
  gmail_id: string
  job_id: string
  category: string
  confidence: number
  email_date: string
  subject: string
  body_preview: string
}

export interface TimelinePoint {
  date: string
  count: number
}

export interface Filters {
  company: string
  job_type: string
  work_mode: string
  source_platform: string
}

export function useJobs() {
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({
    company: '', job_type: '', work_mode: '', source_platform: '',
  })

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.company) params.set('company', filters.company)
      if (filters.job_type) params.set('job_type', filters.job_type)
      if (filters.work_mode) params.set('work_mode', filters.work_mode)
      if (filters.source_platform) params.set('source_platform', filters.source_platform)

      const res = await fetch(`/api/jobs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch jobs')
      const data = await res.json()
      setAllJobs(data.jobs ?? [])
      setTimeline(data.timeline ?? [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails?uncertain=true')
      if (!res.ok) return
      setEmails(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchJobs(); fetchEmails() }, [fetchJobs, fetchEmails])

  const updateJobStatus = async (jobId: string, status: string) => {
    await fetch('/api/update-job', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, status }),
    })
    await fetchJobs()
  }

  const updateNotes = async (jobId: string, notes: string) => {
    await fetch('/api/update-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, notes }),
    })
    await fetchJobs()
  }

  const updateEmailCategory = async (emailId: string, category: string) => {
    await fetch('/api/update-email', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, category }),
    })
    await Promise.all([fetchJobs(), fetchEmails()])
  }

  const reclassifyEmail = async (jobId: string): Promise<{ category: string; company?: string } | null> => {
    try {
      const res = await fetch('/api/reclassify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await fetchJobs()
      return data
    } catch (err: unknown) {
      console.error('Reclassify error:', err)
      return null
    }
  }

  // Filter options derived from all jobs (unfiltered)
  const filterOptions = {
    companies: [...new Set(allJobs.map(j => j.company))].filter(Boolean).sort(),
    jobTypes: [...new Set(allJobs.map(j => j.job_type))].filter(Boolean).sort(),
    workModes: [...new Set(allJobs.map(j => j.work_mode))].filter(Boolean).sort(),
    platforms: [...new Set(allJobs.map(j => j.source_platform))].filter(Boolean).sort(),
  }

  return {
    jobs: allJobs,
    timeline,
    emails,
    loading,
    error,
    filters,
    setFilters,
    filterOptions,
    updateJobStatus,
    updateNotes,
    updateEmailCategory,
    reclassifyEmail,
    refetch: fetchJobs,
  }
}

