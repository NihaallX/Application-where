import { query } from './neon';
import { logger } from '../utils/logger';

/**
 * Create tables if they don't exist.
 * Runs on every startup for safety.
 */
export async function initializeSchema(): Promise<void> {
    logger.info('Initializing database schema...');

    await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      source_platform TEXT DEFAULT '',
      job_type TEXT DEFAULT 'UNKNOWN',
      work_mode TEXT DEFAULT 'UNKNOWN',
      current_status TEXT NOT NULL,
      first_email_date TIMESTAMPTZ NOT NULL,
      last_update_date TIMESTAMPTZ NOT NULL,
      interview_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gmail_id TEXT UNIQUE NOT NULL,
      job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      email_date TIMESTAMPTZ NOT NULL,
      subject TEXT DEFAULT '',
      body_preview TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
    CREATE INDEX IF NOT EXISTS idx_emails_job_id ON emails(job_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_company_role ON jobs(company, role);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(current_status);
    CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);

    CREATE TABLE IF NOT EXISTS backfill_state (
      mode TEXT PRIMARY KEY,
      last_page_token TEXT NOT NULL DEFAULT '',
      emails_processed INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

    logger.info('Database schema initialized');
}
