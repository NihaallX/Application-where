-- ============================================================
-- Application Where? — SaaS Multi-Tenancy Migration
-- Run this in your Neon SQL editor ONCE before deploying.
-- ============================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  clerk_id            TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  forwarding_address  UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  plan                TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_clerk_id_idx ON users (clerk_id);
CREATE INDEX IF NOT EXISTS users_forwarding_address_idx ON users (forwarding_address);

-- 2. Add user_id to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 3. Add user_id to emails
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 4. Index for fast per-user queries
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id);
CREATE INDEX IF NOT EXISTS emails_user_id_idx ON emails (user_id);

-- ============================================================
-- NOTE: Existing rows in jobs/emails will have user_id = NULL
-- (they belong to the original single-user personal setup).
-- For the SaaS version, all new writes include user_id.
-- ============================================================