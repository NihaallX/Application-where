import React, { useState } from 'react';
import { Job } from '../types';

interface Props {
    jobs: Job[];
    onEditJob: (job: Job) => void;
    activeStatusFilter: string | null;
    onClearFilter: () => void;
    onReclassify: (jobId: string) => Promise<{ category: string; company?: string } | null>;
}

const STATUS_LABELS: Record<string, string> = {
    INTERVIEW: 'Interviews',
    REJECTED: 'Rejections',
    OFFER: 'Offers',
    APPLIED_CONFIRMATION: 'Applied',
    APPLICATION_VIEWED: 'App Viewed',
    RECRUITER_OUTREACH: 'Recruiter Outreach',
    MISCELLANEOUS: 'Miscellaneous',
    OTHER: 'Other',
};

function interviewCountdown(interviewDate: string | null): string | null {
    if (!interviewDate) return null;
    const diffDays = Math.ceil((new Date(interviewDate).getTime() - Date.now()) / 86400000);
    if (diffDays < 0) return null;
    if (diffDays === 0) return '📅 Today';
    if (diffDays === 1) return '📅 Tomorrow';
    return `📅 ${diffDays}d`;
}

function exportToCSV(jobs: Job[]) {
    const headers = ['Company', 'Role', 'Status', 'Type', 'Mode', 'Platform', 'First Email', 'Notes'];
    const rows = jobs.map((j) => [
        j.company, j.role, j.current_status, j.job_type || '',
        j.work_mode || '', j.source_platform || '',
        new Date(j.first_email_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        (j.notes || '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export const JobsTable: React.FC<Props> = ({ jobs, onEditJob, activeStatusFilter, onClearFilter, onReclassify }) => {
    const [searchText, setSearchText] = useState('');
    const [reclassifying, setReclassifying] = useState<Record<string, boolean>>({});
    const [reclassifyMsg, setReclassifyMsg] = useState<Record<string, string>>({});

    const statusFiltered = activeStatusFilter
        ? jobs.filter((j) => j.current_status === activeStatusFilter)
        : jobs;

    const filtered = searchText
        ? statusFiltered.filter(
              (j) =>
                  j.company.toLowerCase().includes(searchText.toLowerCase()) ||
                  j.role.toLowerCase().includes(searchText.toLowerCase())
          )
        : statusFiltered;

    const title = activeStatusFilter
        ? `${STATUS_LABELS[activeStatusFilter] ?? activeStatusFilter} (${filtered.length})`
        : `All Jobs (${filtered.length}${jobs.length !== filtered.length ? ` of ${jobs.length}` : ''})`;

    const handleReclassify = async (job: Job) => {
        setReclassifying((prev) => ({ ...prev, [job.id]: true }));
        setReclassifyMsg((prev) => ({ ...prev, [job.id]: '' }));
        const result = await onReclassify(job.id);
        setReclassifying((prev) => ({ ...prev, [job.id]: false }));
        if (result) {
            setReclassifyMsg((prev) => ({ ...prev, [job.id]: `→ ${result.category}` }));
            setTimeout(() => setReclassifyMsg((prev) => ({ ...prev, [job.id]: '' })), 3000);
        }
    };

    if (jobs.length === 0) {
        return (
            <div className="review-panel">
                <h3>All Jobs</h3>
                <div className="empty-state">No jobs found. Run the backend backfill first.</div>
            </div>
        );
    }

    return (
        <div className="review-panel">
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, flex: 1, minWidth: 120 }}>{title}</h3>
                {activeStatusFilter && (
                    <button
                        onClick={onClearFilter}
                        style={{
                            background: 'rgba(67,97,238,0.15)', border: '1px solid #4361ee',
                            color: '#4361ee', borderRadius: 20, padding: '3px 12px',
                            fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font)',
                        }}
                    >
                        ✕ Clear filter
                    </button>
                )}
                <button
                    onClick={() => exportToCSV(filtered)}
                    style={{
                        background: 'rgba(6,214,160,0.12)', border: '1px solid #06d6a0',
                        color: '#06d6a0', borderRadius: 8, padding: '5px 14px',
                        fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600,
                    }}
                >
                    📥 Export CSV
                </button>
            </div>

            {/* Search bar */}
            <div style={{ marginBottom: 14 }}>
                <input
                    type="text"
                    placeholder="Search company or role..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{
                        width: '100%', background: '#1a1a2e', border: '1px solid #2a2a4a',
                        borderRadius: 8, padding: '8px 14px', color: '#e8e8f0',
                        fontFamily: 'var(--font)', fontSize: '0.88rem', outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="review-table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Mode</th>
                            <th>Platform</th>
                            <th>First Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((job) => {
                            const countdown = job.current_status === 'INTERVIEW' ? interviewCountdown(job.interview_date ?? null) : null;
                            const isReclassifiable = job.current_status === 'OTHER' || job.current_status === 'MISCELLANEOUS';
                            const isReclassifying = reclassifying[job.id];
                            const msg = reclassifyMsg[job.id];
                            return (
                                <tr key={job.id}>
                                    <td style={{ fontWeight: 600, color: '#e8e8f0' }}>
                                        {job.company}
                                        {job.notes && (
                                            <span title={job.notes} style={{ marginLeft: 6, cursor: 'default', opacity: 0.6 }}>💬</span>
                                        )}
                                    </td>
                                    <td>{job.role}</td>
                                    <td>
                                        <span className={`status-badge status-${job.current_status}`}>
                                            {job.current_status.replace(/_/g, ' ')}
                                        </span>
                                        {countdown && (
                                            <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#4361ee', fontWeight: 600 }}>
                                                {countdown}
                                            </span>
                                        )}
                                    </td>
                                    <td>{job.job_type?.replace(/_/g, ' ') || '—'}</td>
                                    <td>{job.work_mode || '—'}</td>
                                    <td>{job.source_platform || '—'}</td>
                                    <td>{new Date(job.first_email_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <button className="btn" onClick={() => onEditJob(job)} style={{ marginRight: 6 }}>
                                            {job.notes ? '📝 Edit' : 'Edit'}
                                        </button>
                                        {isReclassifiable && (
                                            <button
                                                className="btn"
                                                onClick={() => handleReclassify(job)}
                                                disabled={isReclassifying}
                                                style={{
                                                    background: 'rgba(247,37,133,0.1)', border: '1px solid #f72585',
                                                    color: '#f72585', fontSize: '0.78rem',
                                                }}
                                            >
                                                {isReclassifying ? '...' : msg || '🔄 Reclassify'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
