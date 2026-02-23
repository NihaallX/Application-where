import React, { useState, useRef } from 'react';
import { useJobs } from './hooks/useJobs';
import { MetricCards } from './components/MetricCards';
import { FunnelChart } from './components/FunnelChart';
import { TimelineChart } from './components/TimelineChart';
import { CompanyChart } from './components/CompanyChart';
import { StatusPieChart } from './components/StatusPieChart';
import { FilterPanel } from './components/FilterPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { StatusEditor } from './components/StatusEditor';
import { JobsTable } from './components/JobsTable';
import { MonitorPage } from './components/MonitorPage';
import { Job } from './types';

type Page = 'dashboard' | 'monitor';

function App() {
    const {
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
    } = useJobs();

    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [page, setPage] = useState<Page>('dashboard');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    const handleCardFilter = (status: string | null) => {
        setStatusFilter(status);
        setTimeout(() => {
            tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    return (
        <>
            {/* Navigation Bar */}
            <nav style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(15, 15, 26, 0.9)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #2a2a4a',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 0,
            }}>
                <div style={{
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    color: '#e8e8f0',
                    marginRight: 32,
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, #4361ee, #7209b7)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    JobTracker
                </div>
                <button
                    onClick={() => setPage('dashboard')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: page === 'dashboard' ? '#4361ee' : '#a0a0c0',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                        fontSize: '0.9rem',
                        fontWeight: page === 'dashboard' ? 600 : 400,
                        borderBottom: page === 'dashboard' ? '2px solid #4361ee' : '2px solid transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    📊 Dashboard
                </button>
                <button
                    onClick={() => setPage('monitor')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: page === 'monitor' ? '#4361ee' : '#a0a0c0',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                        fontSize: '0.9rem',
                        fontWeight: page === 'monitor' ? 600 : 400,
                        borderBottom: page === 'monitor' ? '2px solid #4361ee' : '2px solid transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    📡 Monitor
                </button>
            </nav>

            {/* Page Content */}
            {page === 'monitor' ? (
                <MonitorPage />
            ) : (
                <div className="dashboard">
                    {/* Header */}
                    <div className="dashboard-header">
                        <div>
                            <h1>Job Tracker</h1>
                            <div className="subtitle">Personal job application analytics dashboard</div>
                        </div>
                        <div className="sync-info">
                            {loading ? (
                                <span>Loading...</span>
                            ) : error ? (
                                <span style={{ color: '#ef233c' }}>⚠ {error}</span>
                            ) : (
                                <span>{jobs.length} jobs tracked</span>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading dashboard data...</div>
                    ) : (
                        <>
                            {/* Metrics */}
                            <MetricCards metrics={metrics} onFilter={handleCardFilter} activeFilter={statusFilter} />

                            {/* Filters */}
                            <FilterPanel filters={filters} setFilters={setFilters} filterOptions={filterOptions} />

                            {/* Charts */}
                            <div className="charts-grid">
                                <FunnelChart jobs={jobs} />
                                <StatusPieChart jobs={jobs} />
                                <TimelineChart jobs={jobs} />
                                <CompanyChart jobs={jobs} />
                            </div>

                            {/* Uncertain Emails Review */}
                            <ReviewPanel emails={emails} onUpdateCategory={updateEmailCategory} />

                            {/* Jobs Table */}
                            <div ref={tableRef}>
                                <JobsTable
                                    jobs={jobs}
                                    onEditJob={setEditingJob}
                                    activeStatusFilter={statusFilter}
                                    onClearFilter={() => setStatusFilter(null)}
                                    onReclassify={reclassifyEmail}
                                />
                            </div>

                            {/* Status Editor Modal */}
                            {editingJob && (
                                <StatusEditor
                                    job={editingJob}
                                    onClose={() => setEditingJob(null)}
                                    onUpdate={updateJobStatus}
                                    onUpdateNotes={updateNotes}
                                />
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}

export default App;
