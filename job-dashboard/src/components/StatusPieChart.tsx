import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Job } from '../types';

interface Props {
    jobs: Job[];
}

const STATUS_COLORS: Record<string, string> = {
    APPLIED_CONFIRMATION: '#4361ee',
    APPLICATION_VIEWED: '#fb8500',
    INTERVIEW: '#4cc9f0',
    OFFER: '#06d6a0',
    REJECTED: '#ef233c',
    RECRUITER_OUTREACH: '#a855f7',
    MISCELLANEOUS: '#8888aa',
    OTHER: '#6a6a8a',
    UNCERTAIN: '#ffbe0b',
};

const STATUS_LABELS: Record<string, string> = {
    APPLIED_CONFIRMATION: 'Applied',
    APPLICATION_VIEWED: 'App Viewed',
    INTERVIEW: 'Interview',
    OFFER: 'Offer',
    REJECTED: 'Rejected',
    RECRUITER_OUTREACH: 'Recruiter',
    MISCELLANEOUS: 'Misc',
    OTHER: 'Other',
    UNCERTAIN: 'Uncertain',
};

export const StatusPieChart: React.FC<Props> = ({ jobs }) => {
    const counts = new Map<string, number>();
    jobs.forEach((j) => {
        counts.set(j.current_status, (counts.get(j.current_status) || 0) + 1);
    });

    const data = Array.from(counts.entries()).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        fill: STATUS_COLORS[status] || '#6a6a8a',
    }));

    if (data.length === 0) {
        return (
            <div className="chart-card">
                <h3>Status Distribution</h3>
                <div className="empty-state">No status data yet</div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#e8e8f0' }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ color: '#a0a0c0', fontSize: 12 }}>{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
