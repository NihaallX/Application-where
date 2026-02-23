import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Job } from '../types';

interface Props {
    jobs: Job[];
}

export const FunnelChart: React.FC<Props> = ({ jobs }) => {
    const applied = jobs.filter((j) =>
        ['APPLIED_CONFIRMATION', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.current_status)
    ).length;
    const interviews = jobs.filter((j) =>
        ['INTERVIEW', 'OFFER'].includes(j.current_status)
    ).length;
    const offers = jobs.filter((j) => j.current_status === 'OFFER').length;

    const data = [
        { stage: 'Applied', count: applied, fill: '#4361ee' },
        { stage: 'Interview', count: interviews, fill: '#4cc9f0' },
        { stage: 'Offer', count: offers, fill: '#06d6a0' },
    ];

    if (applied === 0) {
        return (
            <div className="chart-card">
                <h3>Application Funnel</h3>
                <div className="empty-state">No application data yet</div>
            </div>
        );
    }

    return (
        <div className="chart-card">
            <h3>Application Funnel</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                    <XAxis type="number" stroke="#6a6a8a" fontSize={12} />
                    <YAxis dataKey="stage" type="category" stroke="#6a6a8a" fontSize={13} width={80} />
                    <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#e8e8f0' }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                        {data.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="count" position="right" fill="#e8e8f0" fontSize={14} fontWeight={600} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
