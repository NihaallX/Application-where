import React, { useState, useEffect, useRef } from 'react';

// Live countdown hook
function useGroqCountdown(minuteStarted: string | undefined): number {
    const [secondsLeft, setSecondsLeft] = useState(60);
    useEffect(() => {
        const tick = () => {
            if (!minuteStarted) { setSecondsLeft(60); return; }
            const elapsed = Math.floor((Date.now() - new Date(minuteStarted).getTime()) / 1000);
            setSecondsLeft(Math.max(0, 60 - elapsed));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [minuteStarted]);
    return secondsLeft;
}

interface SyncStatus {
    mode: string;
    started_at: string;
    last_updated: string;
    emails_fetched: number;
    emails_classified: number;
    emails_skipped: number;
    jobs_created: number;
    errors: number;
    rate_limits_hit: number;
    current_batch: number;
    is_running: boolean;
    process_alive: boolean;
    last_error: string;
    groq_requests_total: number;
    groq_requests_this_minute: number;
    groq_minute_started: string;
    active_key_index: number;
    key_requests_total: number[];
    key_rate_limited: boolean[];
    tokens_used_session: number;
    tokens_used_today: number;
    tokens_day_started: string;
    tokens_day_limit: number;
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: Record<string, unknown>;
}

interface GroqLimits {
    tier: string;
    limits: { requests_per_minute: number; tokens_per_minute: number; tokens_per_day: number; requests_per_day: number };
    throttle_config: { min_delay_ms: number; effective_rpm: number; backoff_strategy: string; max_retries: number };
}

interface ResumeState {
    mode: string;
    last_page_token: string;
    emails_processed: number;
    updated_at: string;
}

export const MonitorPage: React.FC = () => {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logTotal, setLogTotal] = useState(0);
    const [groqLimits, setGroqLimits] = useState<GroqLimits | null>(null);
    const [resumeState, setResumeState] = useState<ResumeState | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [processAlive, setProcessAlive] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // API key state
    const [apiKey, setApiKey] = useState('');
    const [keyMsg, setKeyMsg] = useState('');
    const [keyLoading, setKeyLoading] = useState(false);

    // Control state
    const [controlMsg, setControlMsg] = useState('');
    const [controlLoading, setControlLoading] = useState(false);

    // Poll sync status every 2s
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const [statusRes, aliveRes, resumeRes] = await Promise.all([
                    fetch('/api/sync-status'),
                    fetch('/api/backfill/alive'),
                    fetch('/api/resume-state'),
                ]);
                const statusData = await statusRes.json();
                const aliveData = await aliveRes.json();
                const resumeData = await resumeRes.json();
                setStatus(statusData);
                setProcessAlive(aliveData.alive);
                setResumeState(resumeData);
            } catch { /* ignore */ }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    // Poll logs every 3s
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch('/api/logs?tail=200');
                const data = await res.json();
                setLogs(data.lines || []);
                setLogTotal(data.total || 0);
            } catch { /* ignore */ }
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, []);

    // Fetch groq limits once
    useEffect(() => {
        fetch('/api/groq-limits').then((r) => r.json()).then(setGroqLimits).catch(() => { });
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleUpdateKey = async () => {
        if (!apiKey.trim()) return;
        setKeyLoading(true);
        setKeyMsg('');
        try {
            const res = await fetch('/api/update-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKey.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setKeyMsg('✅ ' + data.message);
                setApiKey('');
            } else {
                setKeyMsg('❌ ' + (data.error || 'Failed'));
            }
        } catch (err: any) {
            setKeyMsg('❌ ' + err.message);
        }
        setKeyLoading(false);
    };

    const handleStartBackfill = async (mode: 'backfill' | 'sync') => {
        setControlLoading(true);
        setControlMsg('');
        try {
            const res = await fetch('/api/backfill/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            });
            const data = await res.json();
            if (data.success) {
                setControlMsg(`✅ ${data.message} (PID: ${data.pid})`);
            } else {
                setControlMsg('❌ ' + (data.error || 'Failed'));
            }
        } catch (err: any) {
            setControlMsg('❌ ' + err.message);
        }
        setControlLoading(false);
    };

    const handleStopBackfill = async () => {
        setControlLoading(true);
        setControlMsg('');
        try {
            const res = await fetch('/api/backfill/stop', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setControlMsg('✅ ' + data.message);
            } else {
                setControlMsg('❌ ' + (data.error || 'Failed'));
            }
        } catch (err: any) {
            setControlMsg('❌ ' + err.message);
        }
        setControlLoading(false);
    };

    const elapsed = status?.started_at
        ? Math.round((new Date(status.last_updated).getTime() - new Date(status.started_at).getTime()) / 1000)
        : 0;
    const elapsedStr = elapsed > 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;
    const groqUsagePercent = status ? Math.min(100, (status.groq_requests_this_minute / 30) * 100) : 0;
    const secondsLeft = useGroqCountdown(status?.groq_minute_started);
    const keyLabels = ['Key 1', 'Key 2', 'Key 3'];
    const activeIdx = status?.active_key_index ?? 0;
    const keyTotals = status?.key_requests_total ?? [0, 0, 0];
    const keyLimited = status?.key_rate_limited ?? [false, false, false];

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1>📡 System Monitor</h1>
                    <div className="subtitle">Live backfill progress, API usage & controls</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {processAlive ? (
                        <span style={{ background: '#06d6a0', color: '#000', padding: '4px 12px', borderRadius: 20, fontWeight: 600, fontSize: '0.85rem' }}>
                            ● PROCESS ALIVE
                        </span>
                    ) : status?.is_running ? (
                        <span style={{ background: '#fb8500', color: '#000', padding: '4px 12px', borderRadius: 20, fontWeight: 600, fontSize: '0.85rem' }}>
                            ● STATUS: RUNNING
                        </span>
                    ) : (
                        <span style={{ background: '#6a6a8a', color: '#fff', padding: '4px 12px', borderRadius: 20, fontWeight: 600, fontSize: '0.85rem' }}>
                            ○ IDLE
                        </span>
                    )}
                </div>
            </div>

            {/* Control Panel */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <h3>🎮 Backfill Controls</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, alignItems: 'center' }}>
                    <button
                        onClick={() => handleStartBackfill('backfill')}
                        disabled={controlLoading || processAlive}
                        style={{
                            background: processAlive ? '#2a2a4a' : 'linear-gradient(135deg, #06d6a0, #118ab2)',
                            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8,
                            cursor: processAlive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
                            opacity: processAlive ? 0.5 : 1,
                        }}
                    >
                        ▶ Start Backfill
                    </button>
                    <button
                        onClick={() => handleStartBackfill('sync')}
                        disabled={controlLoading || processAlive}
                        style={{
                            background: processAlive ? '#2a2a4a' : 'linear-gradient(135deg, #4361ee, #7209b7)',
                            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8,
                            cursor: processAlive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
                            opacity: processAlive ? 0.5 : 1,
                        }}
                    >
                        🔄 Start Sync
                    </button>
                    <button
                        onClick={handleStopBackfill}
                        disabled={controlLoading || !processAlive}
                        style={{
                            background: !processAlive ? '#2a2a4a' : 'linear-gradient(135deg, #ef233c, #d90429)',
                            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8,
                            cursor: !processAlive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
                            opacity: !processAlive ? 0.5 : 1,
                        }}
                    >
                        ⏹ Stop
                    </button>
                    {resumeState && (
                        <span style={{ color: '#a0a0c0', fontSize: '0.85rem', marginLeft: 8 }}>
                            📍 Resume available: {resumeState.emails_processed} emails processed
                        </span>
                    )}
                </div>
                {controlMsg && (
                    <div style={{ marginTop: 10, fontSize: '0.85rem', color: controlMsg.startsWith('✅') ? '#06d6a0' : '#ef233c' }}>
                        {controlMsg}
                    </div>
                )}
            </div>

            {/* API Key Input */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <h3>🔑 Groq API Key</h3>
                <p style={{ color: '#a0a0c0', fontSize: '0.85rem', margin: '8px 0 12px' }}>
                    Paste a new Groq API key below. The running backfill will auto-detect the change within ~10 seconds (no restart needed).
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="gsk_..."
                        style={{
                            flex: 1, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8,
                            padding: '10px 14px', color: '#e8e8f0', fontSize: '0.9rem',
                            fontFamily: '"JetBrains Mono", monospace', outline: 'none',
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateKey()}
                    />
                    <button
                        onClick={handleUpdateKey}
                        disabled={keyLoading || !apiKey.trim()}
                        style={{
                            background: !apiKey.trim() ? '#2a2a4a' : 'linear-gradient(135deg, #f72585, #7209b7)',
                            color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8,
                            cursor: !apiKey.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem',
                            opacity: !apiKey.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
                        }}
                    >
                        {keyLoading ? '...' : '🔄 Update Key'}
                    </button>
                </div>
                {keyMsg && (
                    <div style={{ marginTop: 8, fontSize: '0.85rem', color: keyMsg.startsWith('✅') ? '#06d6a0' : '#ef233c' }}>
                        {keyMsg}
                    </div>
                )}
            </div>

            {/* Sync Progress Cards */}
            <div className="metrics-grid">
                <div className="metric-card" style={{ borderTop: '3px solid #4361ee' }}>
                    <div className="metric-value">{status?.emails_fetched || 0}</div>
                    <div className="metric-label">Emails Fetched</div>
                </div>
                <div className="metric-card" style={{ borderTop: '3px solid #06d6a0' }}>
                    <div className="metric-value">{status?.emails_classified || 0}</div>
                    <div className="metric-label">Classified</div>
                </div>
                <div className="metric-card" style={{ borderTop: '3px solid #f72585' }}>
                    <div className="metric-value">{status?.emails_skipped || 0}</div>
                    <div className="metric-label">Skipped (non-job)</div>
                </div>
                <div className="metric-card" style={{ borderTop: '3px solid #fb8500' }}>
                    <div className="metric-value">{status?.jobs_created || 0}</div>
                    <div className="metric-label">Jobs Created</div>
                </div>
                <div className="metric-card" style={{ borderTop: '3px solid #ef233c' }}>
                    <div className="metric-value">{status?.errors || 0}</div>
                    <div className="metric-label">Errors</div>
                </div>
                <div className="metric-card" style={{ borderTop: '3px solid #7209b7' }}>
                    <div className="metric-value">{elapsedStr}</div>
                    <div className="metric-label">Elapsed</div>
                </div>
            </div>

            {/* Groq API Usage */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>⚡ Groq API Usage</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Minute resets in</div>
                            <div style={{
                                fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace',
                                color: secondsLeft < 10 ? '#ef233c' : secondsLeft < 30 ? '#fb8500' : '#06d6a0',
                            }}>
                                {String(secondsLeft).padStart(2, '0')}s
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total requests</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8e8f0', fontFamily: 'monospace' }}>
                                {status?.groq_requests_total || 0}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rate limits hit</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', color: (status?.rate_limits_hit || 0) > 0 ? '#ef233c' : '#e8e8f0' }}>
                                {status?.rate_limits_hit || 0}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Daily token usage */}
                {(() => {
                    const used = status?.tokens_used_today ?? 0;
                    const limit = status?.tokens_day_limit ?? 100000;
                    const session = status?.tokens_used_session ?? 0;
                    const pct = Math.min(100, (used / limit) * 100);
                    const barColor = pct >= 90 ? '#ef233c' : pct >= 70 ? '#fb8500' : '#06d6a0';
                    return (
                        <div style={{ marginBottom: 20, padding: '14px 16px', background: '#1a1a2e', borderRadius: 10, border: '1px solid #2a2a4a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#a0a0c0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Daily Token Budget
                                </span>
                                <div style={{ display: 'flex', gap: 18, fontSize: '0.82rem', color: '#a0a0c0' }}>
                                    <span>Session: <b style={{ color: '#e8e8f0', fontFamily: 'monospace' }}>{session.toLocaleString()}</b></span>
                                    <span style={{ color: barColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                        {used.toLocaleString()} <span style={{ color: '#6a6a8a', fontWeight: 400 }}>/ {limit.toLocaleString()}</span>
                                    </span>
                                    <span style={{ color: barColor, fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div style={{ background: '#0d0d1a', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${pct}%`, height: '100%', borderRadius: 6,
                                    background: `linear-gradient(90deg, #06d6a0, ${barColor})`,
                                    transition: 'width 0.6s ease, background 0.3s ease',
                                }} />
                            </div>
                            {pct >= 90 && (
                                <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#ef233c', fontWeight: 600 }}>
                                    ⚠ Approaching daily limit — backfill will pause when limit is reached
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Per-key usage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {keyLabels.map((label, i) => {
                        const isActive = i === activeIdx && processAlive;
                        const isLimited = keyLimited[i];
                        const reqsThisMin = isActive ? (status?.groq_requests_this_minute || 0) : 0;
                        const totalReqs = keyTotals[i] || 0;
                        const pct = Math.min(100, (reqsThisMin / 30) * 100);
                        const barColor = isLimited ? '#ef233c' : pct > 80 ? '#fb8500' : '#06d6a0';
                        return (
                            <div key={label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? '#e8e8f0' : '#6a6a8a' }}>{label}</span>
                                        {isActive && (
                                            <span style={{
                                                background: 'rgba(6,214,160,0.15)', border: '1px solid #06d6a0',
                                                color: '#06d6a0', fontSize: '0.7rem', fontWeight: 700,
                                                padding: '1px 8px', borderRadius: 20,
                                            }}>ACTIVE</span>
                                        )}
                                        {isLimited && (
                                            <span style={{
                                                background: 'rgba(239,35,60,0.15)', border: '1px solid #ef233c',
                                                color: '#ef233c', fontSize: '0.7rem', fontWeight: 700,
                                                padding: '1px 8px', borderRadius: 20,
                                            }}>RATE LIMITED</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#a0a0c0' }}>
                                        <span>This min: <b style={{ color: isActive ? '#e8e8f0' : '#6a6a8a' }}>{isActive ? reqsThisMin : '—'}/30</b></span>
                                        <span>Total: <b style={{ color: totalReqs > 0 ? '#e8e8f0' : '#6a6a8a' }}>{totalReqs}</b></span>
                                    </div>
                                </div>
                                <div style={{ background: '#1a1a2e', borderRadius: 6, height: 10, overflow: 'hidden', opacity: isActive ? 1 : 0.35 }}>
                                    <div style={{
                                        width: isActive ? `${pct}%` : '0%',
                                        height: '100%',
                                        background: barColor,
                                        borderRadius: 6,
                                        transition: 'width 0.5s ease, background 0.3s ease',
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {status?.last_error && (
                    <div style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(239,35,60,0.1)', border: '1px solid #ef233c', borderRadius: 8, color: '#ef233c', fontSize: '0.85rem' }}>
                        ⚠ Last Error: {status.last_error}
                    </div>
                )}
            </div>

            {/* Live Logs */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3>📋 Live Logs ({logTotal} total)</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a0a0c0', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            style={{ accentColor: '#4361ee' }}
                        />
                        Auto-scroll
                    </label>
                </div>
                <div
                    ref={logContainerRef}
                    style={{
                        background: '#0a0a14',
                        borderRadius: 8,
                        padding: 12,
                        maxHeight: 500,
                        overflowY: 'auto',
                        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                        fontSize: '0.78rem',
                        lineHeight: 1.7,
                    }}
                >
                    {logs.length === 0 ? (
                        <div style={{ color: '#6a6a8a', textAlign: 'center', padding: 40 }}>
                            No logs yet. Click "▶ Start Backfill" above to begin.
                        </div>
                    ) : (
                        logs.map((entry, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1a1a2e', padding: '3px 0' }}>
                                <span style={{ color: '#6a6a8a', flexShrink: 0 }}>
                                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'}
                                </span>
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontWeight: 600,
                                        color:
                                            entry.level === 'ERROR' ? '#ef233c'
                                                : entry.level === 'WARN' ? '#fb8500'
                                                    : entry.level === 'DEBUG' ? '#7209b7'
                                                        : '#4361ee',
                                        minWidth: 42,
                                    }}
                                >
                                    {entry.level}
                                </span>
                                <span style={{ color: '#e8e8f0' }}>
                                    {entry.message}
                                    {entry.data && (
                                        <span style={{ color: '#6a6a8a', marginLeft: 8 }}>
                                            {JSON.stringify(entry.data)}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Groq Tier Info */}
            {groqLimits && (
                <div className="chart-card">
                    <h3>📊 Groq Free Tier Limits</h3>
                    <table className="review-table" style={{ marginTop: 12 }}>
                        <thead>
                            <tr>
                                <th>Limit</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Requests / Minute</td><td>{groqLimits.limits.requests_per_minute}</td></tr>
                            <tr><td>Tokens / Minute</td><td>{groqLimits.limits.tokens_per_minute.toLocaleString()}</td></tr>
                            <tr><td>Requests / Day</td><td>{groqLimits.limits.requests_per_day.toLocaleString()}</td></tr>
                            <tr><td>Our Throttle Delay</td><td>{groqLimits.throttle_config.min_delay_ms}ms (= {groqLimits.throttle_config.effective_rpm} req/min)</td></tr>
                            <tr><td>Backoff Strategy</td><td>{groqLimits.throttle_config.backoff_strategy}</td></tr>
                            <tr><td>Max Retries</td><td>{groqLimits.throttle_config.max_retries}</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
