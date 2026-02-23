import React from 'react';
import { Filters } from '../types';

interface Props {
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    filterOptions: {
        companies: string[];
        jobTypes: string[];
        workModes: string[];
        platforms: string[];
    };
}

export const FilterPanel: React.FC<Props> = ({ filters, setFilters, filterOptions }) => {
    const update = (key: keyof Filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="filter-panel">
            <div className="filter-group">
                <label>Company</label>
                <select value={filters.company} onChange={(e) => update('company', e.target.value)}>
                    <option value="">All Companies</option>
                    {filterOptions.companies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label>Job Type</label>
                <select value={filters.job_type} onChange={(e) => update('job_type', e.target.value)}>
                    <option value="">All Types</option>
                    {filterOptions.jobTypes.map((t) => (
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label>Work Mode</label>
                <select value={filters.work_mode} onChange={(e) => update('work_mode', e.target.value)}>
                    <option value="">All Modes</option>
                    {filterOptions.workModes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label>Platform</label>
                <select value={filters.source_platform} onChange={(e) => update('source_platform', e.target.value)}>
                    <option value="">All Platforms</option>
                    {filterOptions.platforms.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
