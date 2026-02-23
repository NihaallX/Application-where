-- Job Tracking System — Neon Postgres Schema
-- Run this manually or let the app auto-create on startup

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  source_platform TEXT DEFAULT '',
  job_type TEXT DEFAULT 'UNKNOWN' CHECK (job_type IN ('INTERNSHIP', 'FULL_TIME', 'CONTRACT', 'UNKNOWN')),
  work_mode TEXT DEFAULT 'UNKNOWN' CHECK (work_mode IN ('REMOTE', 'ONSITE', 'HYBRID', 'UNKNOWN')),
  current_status TEXT NOT NULL CHECK (current_status IN ('APPLIED_CONFIRMATION', 'APPLICATION_VIEWED', 'REJECTED', 'INTERVIEW', 'OFFER', 'RECRUITER_OUTREACH', 'MISCELLANEOUS', 'OTHER', 'UNCERTAIN')),
  first_email_date TIMESTAMPTZ NOT NULL,
  last_update_date TIMESTAMPTZ NOT NULL,
  interview_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_job_id ON emails(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_role ON jobs(company, role);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(current_status);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_jobs_first_email_date ON jobs(first_email_date);
