import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'backfill.log');
const STATUS_FILE = path.join(LOG_DIR, 'sync-status.json');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: Record<string, unknown>;
}

function timestamp(): string {
    return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: timestamp(),
        level,
        message,
        ...(data ? { data } : {}),
    };
    const line = JSON.stringify(entry);

    // Console output
    if (level === 'ERROR') {
        console.error(line);
    } else {
        console.log(line);
    }

    // File output — append to log file
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch {
        // Silently ignore file write errors
    }
}

export const logger = {
    info: (message: string, data?: Record<string, unknown>) => log('INFO', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('WARN', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('ERROR', message, data),
    debug: (message: string, data?: Record<string, unknown>) => log('DEBUG', message, data),
};

// --- Sync status tracker ---
export interface SyncStatus {
    mode: 'backfill' | 'sync' | 'idle';
    started_at: string;
    last_updated: string;
    emails_fetched: number;
    emails_classified: number;
    emails_skipped: number;
    jobs_created: number;
    jobs_updated: number;
    errors: number;
    rate_limits_hit: number;
    current_batch: number;
    is_running: boolean;
    last_error: string;
    groq_requests_total: number;
    groq_requests_this_minute: number;
    groq_minute_started: string;
    // Per-key tracking
    active_key_index: number;
    key_requests_total: number[];
    key_rate_limited: boolean[];
    // Token tracking
    tokens_used_session: number;
    tokens_used_today: number;
    tokens_day_started: string;
    tokens_day_limit: number;
}

const defaultStatus: SyncStatus = {
    mode: 'idle',
    started_at: '',
    last_updated: '',
    emails_fetched: 0,
    emails_classified: 0,
    emails_skipped: 0,
    jobs_created: 0,
    jobs_updated: 0,
    errors: 0,
    rate_limits_hit: 0,
    current_batch: 0,
    is_running: false,
    last_error: '',
    groq_requests_total: 0,
    groq_requests_this_minute: 0,
    groq_minute_started: '',
    active_key_index: 0,
    key_requests_total: [0, 0, 0],
    key_rate_limited: [false, false, false],
    tokens_used_session: 0,
    tokens_used_today: 0,
    tokens_day_started: new Date().toISOString().slice(0, 10),
    tokens_day_limit: 100000,
};

let currentStatus: SyncStatus = { ...defaultStatus };

export function initSyncStatus(mode: 'backfill' | 'sync'): void {
    // Preserve today's accumulated token count across runs
    const today = new Date().toISOString().slice(0, 10);
    let tokensUsedToday = 0;
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const prev = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) as Partial<SyncStatus>;
            if (prev.tokens_day_started === today && typeof prev.tokens_used_today === 'number') {
                tokensUsedToday = prev.tokens_used_today;
            }
        }
    } catch { /* ignore */ }

    currentStatus = {
        ...defaultStatus,
        mode,
        started_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        is_running: true,
        groq_minute_started: new Date().toISOString(),
        tokens_used_session: 0,        // reset per-run
        tokens_used_today: tokensUsedToday, // carry over from previous runs today
        tokens_day_started: today,
    };
    writeSyncStatus();
}

export function updateSyncStatus(updates: Partial<SyncStatus>): void {
    currentStatus = {
        ...currentStatus,
        ...updates,
        last_updated: new Date().toISOString(),
    };
    writeSyncStatus();
}

export function getSyncStatus(): SyncStatus {
    return { ...currentStatus };
}

export function trackGroqRequest(): void {
    const now = new Date();
    const minuteStart = new Date(currentStatus.groq_minute_started || now.toISOString());
    const elapsed = now.getTime() - minuteStart.getTime();

    if (elapsed > 60000) {
        // Reset minute counter
        currentStatus.groq_requests_this_minute = 1;
        currentStatus.groq_minute_started = now.toISOString();
    } else {
        currentStatus.groq_requests_this_minute++;
    }
    currentStatus.groq_requests_total++;

    // Per-key tracking
    const idx = currentStatus.active_key_index;
    if (!currentStatus.key_requests_total) currentStatus.key_requests_total = [0, 0, 0];
    currentStatus.key_requests_total[idx] = (currentStatus.key_requests_total[idx] || 0) + 1;

    writeSyncStatus();
}

export function trackKeyRotation(newIndex: number): void {
    currentStatus.active_key_index = newIndex;
    writeSyncStatus();
}

export function trackKeyRateLimit(keyIndex: number): void {
    if (!currentStatus.key_rate_limited) currentStatus.key_rate_limited = [false, false, false];
    currentStatus.key_rate_limited[keyIndex] = true;
    currentStatus.rate_limits_hit = (currentStatus.rate_limits_hit || 0) + 1;
    writeSyncStatus();
}

export function trackGroqTokens(totalTokens: number): void {
    // Reset if it's a new calendar day
    const today = new Date().toISOString().slice(0, 10);
    if (currentStatus.tokens_day_started !== today) {
        currentStatus.tokens_used_today = 0;
        currentStatus.tokens_day_started = today;
    }
    currentStatus.tokens_used_session = (currentStatus.tokens_used_session || 0) + totalTokens;
    currentStatus.tokens_used_today = (currentStatus.tokens_used_today || 0) + totalTokens;
    writeSyncStatus();
}

function writeSyncStatus(): void {
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(currentStatus, null, 2));
    } catch {
        // Silently ignore
    }
}

export function clearLogFile(): void {
    try {
        fs.writeFileSync(LOG_FILE, '');
    } catch {
        // Silently ignore
    }
}
