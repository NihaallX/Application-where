import React from 'react';
import { Metrics } from '../types';

interface Props {
    metrics: Metrics;
    onFilter: (status: string | null) => void;
    activeFilter: string | null;
}

export const MetricCards: React.FC<Props> = ({ metrics, onFilter, activeFilter }) => {
    const cards = [
        { label: 'Total Applications', value: metrics.totalApplications, status: null as string | null },
        { label: 'Interviews', value: metrics.totalInterviews, status: 'INTERVIEW' },
        { label: 'Rejections', value: metrics.totalRejections, status: 'REJECTED' },
        { label: 'Offers', value: metrics.totalOffers, status: 'OFFER' },
        { label: 'App Viewed', value: metrics.totalViewed, status: 'APPLICATION_VIEWED' },
        { label: 'Conversion Rate', value: metrics.conversionRate, small: true, status: 'INTERVIEW' },
        { label: 'Offer Rate', value: metrics.offerRate, small: true, status: 'OFFER' },
    ];

    return (
        <div className="metrics-grid">
            {cards.map((card) => {
                const isActive = card.status !== null && activeFilter === card.status;
                return (
                    <div
                        key={card.label}
                        className={`metric-card clickable${isActive ? ' active' : ''}`}
                        onClick={() => onFilter(isActive ? null : card.status)}
                        title={card.status ? `Filter by ${card.label}` : undefined}
                    >
                        <div className="label">{card.label}</div>
                        <div className={`value${card.small ? ' small' : ''}`}>{card.value}</div>
                    </div>
                );
            })}
        </div>
    );
};
