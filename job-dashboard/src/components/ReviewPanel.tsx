import React, { useState } from 'react';
import { Email } from '../types';

interface Props {
    emails: Email[];
    onUpdateCategory: (emailId: string, category: string) => Promise<void>;
}

const CATEGORIES = [
    'APPLIED_CONFIRMATION',
    'APPLICATION_VIEWED',
    'REJECTED',
    'INTERVIEW',
    'OFFER',
    'RECRUITER_OUTREACH',
    'MISCELLANEOUS',
    'OTHER',
];

export const ReviewPanel: React.FC<Props> = ({ emails, onUpdateCategory }) => {
    const [updating, setUpdating] = useState<string | null>(null);

    if (emails.length === 0) {
        return null;
    }

    const handleUpdate = async (emailId: string, category: string) => {
        setUpdating(emailId);
        await onUpdateCategory(emailId, category);
        setUpdating(null);
    };

    return (
        <div className="review-panel">
            <h3>⚠ Uncertain Classifications ({emails.length})</h3>
            <div style={{ overflowX: 'auto' }}>
                <table className="review-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Subject</th>
                            <th>Confidence</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {emails.map((email) => (
                            <tr key={email.id}>
                                <td>{new Date(email.email_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {email.subject}
                                </td>
                                <td>
                                    <span className={`confidence-badge ${email.confidence < 0.4 ? 'confidence-low' : 'confidence-medium'}`}>
                                        {(email.confidence * 100).toFixed(0)}%
                                    </span>
                                </td>
                                <td>
                                    {updating === email.id ? (
                                        <span style={{ color: '#6a6a8a', fontSize: '0.8rem' }}>Updating...</span>
                                    ) : (
                                        <select
                                            defaultValue=""
                                            onChange={(e) => {
                                                if (e.target.value) handleUpdate(email.id, e.target.value);
                                            }}
                                            style={{
                                                background: '#0f0f1a',
                                                color: '#e8e8f0',
                                                border: '1px solid #2a2a4a',
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                                fontFamily: 'var(--font)',
                                            }}
                                        >
                                            <option value="" disabled>
                                                Classify as...
                                            </option>
                                            {CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat.replace('_', ' ')}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
