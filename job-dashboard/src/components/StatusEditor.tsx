import React, { useState } from 'react';
import { Job } from '../types';

interface Props {
    job: Job | null;
    onClose: () => void;
    onUpdate: (jobId: string, status: string) => Promise<void>;
    onUpdateNotes: (jobId: string, notes: string) => Promise<void>;
}

const STATUSES = [
    'APPLIED_CONFIRMATION',
    'APPLICATION_VIEWED',
    'INTERVIEW',
    'REJECTED',
    'OFFER',
    'RECRUITER_OUTREACH',
    'MISCELLANEOUS',
    'OTHER',
];

export const StatusEditor: React.FC<Props> = ({ job, onClose, onUpdate, onUpdateNotes }) => {
    const [status, setStatus] = useState(job?.current_status || '');
    const [notes, setNotes] = useState(job?.notes || '');
    const [saving, setSaving] = useState(false);

    if (!job) return null;

    const interviewCountdown = (() => {
        if (!job.interview_date) return null;
        const diffDays = Math.ceil((new Date(job.interview_date).getTime() - Date.now()) / 86400000);
        if (diffDays < 0) return null;
        if (diffDays === 0) return '📅 Interview is Today!';
        if (diffDays === 1) return '📅 Interview is Tomorrow';
        return `📅 Interview in ${diffDays} days`;
    })();

    const handleSave = async () => {
        setSaving(true);
        await onUpdate(job.id, status);
        if (notes !== (job.notes || '')) await onUpdateNotes(job.id, notes);
        setSaving(false);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>Edit Job</h3>

                <div className="form-group">
                    <label>Company</label>
                    <input type="text" value={job.company} disabled />
                </div>

                <div className="form-group">
                    <label>Role</label>
                    <input type="text" value={job.role} disabled />
                </div>

                {interviewCountdown && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(67,97,238,0.12)', borderRadius: 8, borderLeft: '3px solid #4361ee', color: '#a0c4ff', fontWeight: 600, fontSize: '0.85rem' }}>
                        {interviewCountdown}
                    </div>
                )}

                <div className="form-group">
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Had a great call, mentioned timeline..."
                        rows={3}
                        style={{
                            width: '100%', background: '#1a1a2e', border: '1px solid #2a2a4a',
                            borderRadius: 8, padding: '10px 14px', color: '#e8e8f0',
                            fontFamily: 'var(--font)', fontSize: '0.9rem', resize: 'vertical',
                            outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div className="actions">
                    <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};
