# Backend Job Sync

Gmail inbox scanner + Groq LLM classifier + Neon Postgres storage for personal job tracking.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Fill in your Neon DB connection string, Groq API key, and Google OAuth2 credentials

3. **First run (interactive OAuth)**
   ```bash
   npm run backfill
   ```
   - A browser window opens for Google OAuth consent
   - After authorization, copy the printed `GOOGLE_REFRESH_TOKEN` into `.env`
   - The backfill continues scanning your entire inbox

4. **Subsequent syncs (after backfill)**
   ```bash
   npm run sync
   ```
   - Fetches only emails newer than last processed date
   - Uses Gmail query prefilter for job-related terms

## GitHub Actions

After backfill is complete:
1. Push this repo to GitHub
2. Add these repository secrets: `DATABASE_URL`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
3. The workflow runs every Sunday at midnight UTC
4. You can also trigger it manually from the Actions tab

## Architecture

```
Gmail Inbox
    ↓
Batch Fetch (100/page, paginated)
    ↓
Heuristic Prefilter (domain + keyword check)
    ↓
Groq LLM Classification (strict JSON, retry once)
    ↓
Status Evolution (priority-based upsert)
    ↓
Neon Postgres (jobs + emails tables)
```
