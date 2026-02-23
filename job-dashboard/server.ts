import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { spawn, ChildProcess } from 'child_process';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
app.use(express.json());

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

// --- Paths to backend ---
const BACKEND_DIR = path.resolve(process.cwd(), '..', 'backend-job-sync');
const LOG_FILE = path.join(BACKEND_DIR, 'logs', 'backfill.log');
const STATUS_FILE = path.join(BACKEND_DIR, 'logs', 'sync-status.json');
const RESUME_FILE = path.join(BACKEND_DIR, 'logs', 'resume-state.json');
const BACKEND_ENV = path.join(BACKEND_DIR, '.env');

// --- Groq helpers ---
function getGroqKey(): string {
    try {
        if (fs.existsSync(BACKEND_ENV)) {
            const content = fs.readFileSync(BACKEND_ENV, 'utf-8');
            const env = dotenv.parse(content);
            return env.GROQ_API_KEY || env.GROQ_API_KEY_2 || env.GROQ_API_KEY_3 || '';
        }
    } catch { /* ignore */ }
    return process.env.GROQ_API_KEY || '';
}

const RECLASSIFY_PROMPT = `You are a job email classifier. Analyze the email and return ONLY a valid JSON object.

{
  "category": "APPLIED_CONFIRMATION | REJECTED | INTERVIEW | OFFER | RECRUITER_OUTREACH | APPLICATION_VIEWED | OTHER",
  "company": "company name - NEVER empty, extract from body or sender domain",
  "role": "job role/title",
  "confidence": 0.0
}

Rules:
- category must be exactly one of the listed values
- OTHER means clearly not job-related (newsletters, personal emails)
- For job portals (LinkedIn/Indeed/Naukri), the company is the HIRING company in the body
- Return ONLY the JSON object, nothing else`;

// --- Backfill child process ---
let backfillProcess: ChildProcess | null = null;

// ===== DATA APIs =====

// GET /api/jobs
app.get('/api/jobs', async (req, res) => {
    try {
        const conditions: string[] = [];
        const params: string[] = [];
        let idx = 1;

        if (req.query.company) {
            conditions.push(`LOWER(company) = LOWER($${idx++})`);
            params.push(req.query.company as string);
        }
        if (req.query.job_type) {
            conditions.push(`job_type = $${idx++}`);
            params.push(req.query.job_type as string);
        }
        if (req.query.work_mode) {
            conditions.push(`work_mode = $${idx++}`);
            params.push(req.query.work_mode as string);
        }
        if (req.query.source_platform) {
            conditions.push(`LOWER(source_platform) = LOWER($${idx++})`);
            params.push(req.query.source_platform as string);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await pool.query(`SELECT * FROM jobs ${where} ORDER BY last_update_date DESC`, params);
        res.json(result.rows);
    } catch (err: any) {
        console.error('GET /api/jobs error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/emails
app.get('/api/emails', async (req, res) => {
    try {
        let query = 'SELECT * FROM emails';
        if (req.query.uncertain === 'true') {
            query += " WHERE category = 'UNCERTAIN' OR confidence < 0.6";
        }
        query += ' ORDER BY email_date DESC LIMIT 100';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err: any) {
        console.error('GET /api/emails error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/update-job
app.patch('/api/update-job', async (req, res) => {
    try {
        const { jobId, status } = req.body;
        if (!jobId || !status) {
            return res.status(400).json({ error: 'jobId and status are required' });
        }
        await pool.query(
            'UPDATE jobs SET current_status = $1, last_update_date = NOW() WHERE id = $2',
            [status, jobId]
        );
        res.json({ success: true });
    } catch (err: any) {
        console.error('PATCH /api/update-job error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/update-email
app.patch('/api/update-email', async (req, res) => {
    try {
        const { emailId, category } = req.body;
        if (!emailId || !category) {
            return res.status(400).json({ error: 'emailId and category are required' });
        }
        await pool.query(
            'UPDATE emails SET category = $1, confidence = 1.0 WHERE id = $2',
            [category, emailId]
        );
        res.json({ success: true });
    } catch (err: any) {
        console.error('PATCH /api/update-email error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reclassify-email — re-run Groq on a job's most recent email
app.post('/api/reclassify-email', async (req, res) => {
    try {
        const { jobId } = req.body;
        if (!jobId) return res.status(400).json({ error: 'jobId is required' });

        const emailRes = await pool.query(
            'SELECT id, subject, body_preview FROM emails WHERE job_id = $1 ORDER BY email_date DESC LIMIT 1',
            [jobId]
        );
        if (emailRes.rows.length === 0) return res.status(404).json({ error: 'No emails for this job' });
        const email = emailRes.rows[0];

        const groqKey = getGroqKey();
        if (!groqKey) return res.status(500).json({ error: 'No Groq API key configured' });

        const groqClient = new Groq({ apiKey: groqKey });
        const completion = await groqClient.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: RECLASSIFY_PROMPT },
                { role: 'user', content: `Subject: ${email.subject}\n\nBody:\n${email.body_preview}` },
            ],
            temperature: 0.1,
            max_tokens: 200,
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) return res.status(500).json({ error: 'Empty Groq response' });

        const parsed = JSON.parse(content);
        const newCategory = String(parsed.category || '').toUpperCase();
        const validCategories = ['APPLIED_CONFIRMATION', 'REJECTED', 'INTERVIEW', 'OFFER', 'RECRUITER_OUTREACH', 'APPLICATION_VIEWED', 'OTHER', 'MISCELLANEOUS'];
        if (!validCategories.includes(newCategory)) return res.status(422).json({ error: `Invalid category: ${newCategory}` });

        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;
        await pool.query('UPDATE emails SET category = $1, confidence = $2 WHERE id = $3', [newCategory, confidence, email.id]);
        await pool.query('UPDATE jobs SET current_status = $1, last_update_date = NOW() WHERE id = $2', [newCategory, jobId]);

        // Improve company name if current one is a placeholder
        const badCompanies = ['unknown', 'unknown company', 'via indeed', 'via linkedin', 'via internshala', 'manually applied', ''];
        if (parsed.company && !badCompanies.includes(String(parsed.company).toLowerCase())) {
            const jobRes = await pool.query('SELECT company FROM jobs WHERE id=$1', [jobId]);
            if (jobRes.rows[0] && badCompanies.includes(String(jobRes.rows[0].company).toLowerCase())) {
                await pool.query('UPDATE jobs SET company = $1 WHERE id = $2', [parsed.company, jobId]);
            }
        }

        res.json({ success: true, category: newCategory, company: parsed.company });
    } catch (err: any) {
        console.error('POST /api/reclassify-email error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/update-notes
app.patch('/api/update-notes', async (req, res) => {
    try {
        const { jobId, notes } = req.body;
        if (!jobId) return res.status(400).json({ error: 'jobId is required' });
        await pool.query('UPDATE jobs SET notes = $1 WHERE id = $2', [notes ?? '', jobId]);
        res.json({ success: true });
    } catch (err: any) {
        console.error('PATCH /api/update-notes error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== MONITORING APIs =====

// GET /api/sync-status
app.get('/api/sync-status', (_req, res) => {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, 'utf-8');
            const status = JSON.parse(data);
            // Also check if the process is actually running
            status.process_alive = backfillProcess !== null && !backfillProcess.killed;
            res.json(status);
        } else {
            res.json({ mode: 'idle', is_running: false, process_alive: false });
        }
    } catch (err: any) {
        res.json({ mode: 'idle', is_running: false, error: err.message });
    }
});

// GET /api/logs?tail=100
app.get('/api/logs', (req, res) => {
    try {
        const tailCount = parseInt(req.query.tail as string) || 100;

        if (!fs.existsSync(LOG_FILE)) {
            return res.json({ lines: [] });
        }

        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        const allLines = content.split('\n').filter((l) => l.trim());
        const lines = allLines.slice(-tailCount);

        const parsed = lines.map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return { timestamp: '', level: 'INFO', message: line };
            }
        });

        res.json({ lines: parsed, total: allLines.length });
    } catch (err: any) {
        res.json({ lines: [], error: err.message });
    }
});

// GET /api/groq-limits
app.get('/api/groq-limits', (_req, res) => {
    res.json({
        tier: 'free',
        limits: {
            requests_per_minute: 30,
            tokens_per_minute: 14400,
            tokens_per_day: 100000,
            requests_per_day: 14400,
        },
        throttle_config: {
            min_delay_ms: 2500,
            effective_rpm: 24,
            backoff_strategy: 'key rotation → 60s wait if all exhausted',
            max_retries: 4,
        },
    });
});

// GET /api/resume-state
app.get('/api/resume-state', (_req, res) => {
    try {
        if (fs.existsSync(RESUME_FILE)) {
            const data = fs.readFileSync(RESUME_FILE, 'utf-8');
            res.json(JSON.parse(data));
        } else {
            res.json(null);
        }
    } catch {
        res.json(null);
    }
});

// ===== PROCESS CONTROL APIs =====

// POST /api/update-api-key — updates GROQ_API_KEY in backend .env (triggers hot-reload)
app.post('/api/update-api-key', (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            return res.status(400).json({ error: 'Invalid API key' });
        }

        if (!fs.existsSync(BACKEND_ENV)) {
            return res.status(404).json({ error: 'Backend .env file not found' });
        }

        let envContent = fs.readFileSync(BACKEND_ENV, 'utf-8');

        // Replace the GROQ_API_KEY line
        if (envContent.includes('GROQ_API_KEY=')) {
            envContent = envContent.replace(
                /GROQ_API_KEY=.*/,
                `GROQ_API_KEY=${apiKey.trim()}`
            );
        } else {
            envContent += `\nGROQ_API_KEY=${apiKey.trim()}\n`;
        }

        fs.writeFileSync(BACKEND_ENV, envContent);
        console.log('✅ Updated GROQ_API_KEY in backend .env');
        res.json({ success: true, message: 'API key updated. Backend will hot-reload within 10 seconds.' });
    } catch (err: any) {
        console.error('Failed to update API key:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/backfill/start — starts the backfill process
app.post('/api/backfill/start', (req, res) => {
    if (backfillProcess && !backfillProcess.killed) {
        return res.status(409).json({ error: 'Backfill is already running' });
    }

    const mode = req.body.mode === 'sync' ? '--sync' : '--backfill';

    try {
        console.log(`Starting backfill process: npm run ${mode === '--sync' ? 'sync' : 'backfill'}`);

        backfillProcess = spawn('npm', ['run', mode === '--sync' ? 'sync' : 'backfill'], {
            cwd: BACKEND_DIR,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        backfillProcess.stdout?.on('data', (data) => {
            process.stdout.write(`[backfill] ${data}`);
        });

        backfillProcess.stderr?.on('data', (data) => {
            process.stderr.write(`[backfill] ${data}`);
        });

        backfillProcess.on('exit', (code) => {
            console.log(`Backfill process exited with code ${code}`);
            backfillProcess = null;
        });

        backfillProcess.on('error', (err) => {
            console.error('Backfill process error:', err.message);
            backfillProcess = null;
        });

        res.json({ success: true, message: `Backfill (${mode}) started`, pid: backfillProcess.pid });
    } catch (err: any) {
        console.error('Failed to start backfill:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/backfill/stop — stops the backfill process gracefully
app.post('/api/backfill/stop', (_req, res) => {
    if (!backfillProcess || backfillProcess.killed) {
        return res.status(404).json({ error: 'No backfill process is running' });
    }

    try {
        console.log('Stopping backfill process (SIGINT)...');
        backfillProcess.kill('SIGINT');
        res.json({ success: true, message: 'Stop signal sent. Process will save progress and exit.' });
    } catch (err: any) {
        console.error('Failed to stop backfill:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/backfill/alive — checks if the backfill process is alive
app.get('/api/backfill/alive', (_req, res) => {
    res.json({
        alive: backfillProcess !== null && !backfillProcess.killed,
        pid: backfillProcess?.pid || null,
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Backend dir: ${BACKEND_DIR}`);
    console.log(`Log file: ${LOG_FILE}`);
});
