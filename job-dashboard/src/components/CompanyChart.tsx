import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Job } from '../types';

interface Props {
    jobs: Job[];
}

const COLORS = ['#4361ee', '#7209b7', '#f72585', '#4cc9f0', '#06d6a0', '#fb8500', '#ffbe0b', '#ef233c', '#a855f7', '#38bdf8'];

export const CompanyChart: React.FC<Props> = ({ jobs }) => {
    const counts = new Map<string, number>();
    jobs.forEach((j) => {
        const company = j.company || 'Unknown';
        counts.set(company, (counts.get(company) || 0) + 1);
    });

    const data = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([company, count]) => ({ company, count }));

    if (data.length === 0) {
        return (
            <div className="chart-card">
                <h3>Top Companies</h3>
                <div className="empty-state">No company data yet</div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Top Companies</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                    <XAxis type="number" stroke="#6a6a8a" fontSize={12} />
                    <YAxis
                        dataKey="company"
                        type="category"
                        stroke="#6a6a8a"
                        fontSize={11}
                        width={120}
                        tick={{ fill: '#a0a0c0' }}
                    />
                    <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#e8e8f0' }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                        {data.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
