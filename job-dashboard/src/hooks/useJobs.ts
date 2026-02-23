import { useState, useEffect, useCallback } from 'react';
import { Job, Email, Filters, Metrics } from '../types';

const API_BASE = '/api';

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Filters>({
        company: '',
        job_type: '',
        work_mode: '',
        source_platform: '',
    });

    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.company) params.set('company', filters.company);
            if (filters.job_type) params.set('job_type', filters.job_type);
            if (filters.work_mode) params.set('work_mode', filters.work_mode);
            if (filters.source_platform) params.set('source_platform', filters.source_platform);

            const res = await fetch(`${API_BASE}/jobs?${params}`);
            if (!res.ok) throw new Error('Failed to fetch jobs');
            const data = await res.json();
            setJobs(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const fetchEmails = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/emails?uncertain=true`);
            if (!res.ok) throw new Error('Failed to fetch emails');
            const data = await res.json();
            setEmails(data);
        } catch (err: any) {
            console.error('Failed to fetch emails:', err);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
        fetchEmails();
    }, [fetchJobs, fetchEmails]);

    const updateJobStatus = async (jobId: string, status: string) => {
        try {
            const res = await fetch(`${API_BASE}/update-job`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, status }),
            });
            if (!res.ok) throw new Error('Failed to update');
            await fetchJobs();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const updateNotes = async (jobId: string, notes: string) => {
        try {
            const res = await fetch(`${API_BASE}/update-notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, notes }),
            });
            if (!res.ok) throw new Error('Failed to update notes');
            await fetchJobs();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const reclassifyEmail = async (jobId: string): Promise<{ category: string; company?: string } | null> => {
        try {
            const res = await fetch(`${API_BASE}/reclassify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to reclassify');
            }
            const data = await res.json();
            await fetchJobs();
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    };

    const updateEmailCategory = async (emailId: string, category: string) => {
        try {
            const res = await fetch(`${API_BASE}/update-email`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailId, category }),
            });
            if (!res.ok) throw new Error('Failed to update');
            await fetchEmails();
            await fetchJobs();
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Compute metrics
    const metrics: Metrics = computeMetrics(jobs);

    // Unique values for filters
    const filterOptions = {
        companies: [...new Set(jobs.map((j) => j.company))].sort(),
        jobTypes: [...new Set(jobs.map((j) => j.job_type))].filter(Boolean).sort(),
        workModes: [...new Set(jobs.map((j) => j.work_mode))].filter(Boolean).sort(),
        platforms: [...new Set(jobs.map((j) => j.source_platform))].filter(Boolean).sort(),
    };

    return {
        jobs,
        emails,
        loading,
        error,
        filters,
        setFilters,
        filterOptions,
        metrics,
        updateJobStatus,
        updateEmailCategory,
        updateNotes,
        reclassifyEmail,
        refetch: fetchJobs,
    };
}

function computeMetrics(jobs: Job[]): Metrics {
    const applied = jobs.filter((j) => j.current_status === 'APPLIED_CONFIRMATION').length;
    const interviews = jobs.filter((j) => j.current_status === 'INTERVIEW').length;
    const rejections = jobs.filter((j) => j.current_status === 'REJECTED').length;
    const offers = jobs.filter((j) => j.current_status === 'OFFER').length;
    const viewed = jobs.filter((j) => j.current_status === 'APPLICATION_VIEWED').length;
    const total = jobs.length;

    const conversionRate = total > 0 ? ((interviews / total) * 100).toFixed(1) : '0';
    const offerRate = total > 0 ? ((offers / total) * 100).toFixed(1) : '0';

    return {
        totalApplications: total,
        totalInterviews: interviews,
        totalRejections: rejections,
        totalOffers: offers,
        totalViewed: viewed,
        conversionRate: `${conversionRate}%`,
        offerRate: `${offerRate}%`,
    };
}
