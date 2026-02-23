import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Job } from '../types';

interface Props {
    jobs: Job[];
}

export const TimelineChart: React.FC<Props> = ({ jobs }) => {
    const dayCounts = new Map<string, number>();
    jobs.forEach((job) => {
        // Parse the ISO string and use local date parts to avoid UTC-offset day shifts
        const date = new Date(job.first_email_date);
        // Use local year/month/day so IST users see the correct date
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    });

    const data = Array.from(dayCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => {
            const [y, m, d] = day.split('-').map(Number);
            // "29 Jan", "01 Feb" — unambiguous day + month label
            const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return { day: label, count };
        });

    if (data.length === 0) {
        return (
            <div className="chart-card">
                <h3>Application Timeline</h3>
                <div className="empty-state">No timeline data yet</div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Application Timeline</h3>
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4361ee" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4361ee" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="day" stroke="#6a6a8a" fontSize={11} interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
                    <YAxis stroke="#6a6a8a" fontSize={12} allowDecimals={false} />
                    <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#e8e8f0' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#4361ee" strokeWidth={2} fill="url(#colorCount)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
