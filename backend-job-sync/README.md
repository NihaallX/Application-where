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

## GitHub Actions (Automated Backfill)

The workflow at `.github/workflows/backfill.yml` runs the backfill automatically every night at **1:00 AM IST** until all emails are processed. Progress is persisted in NeonDB (`backfill_state` table) so each run resumes exactly where the last one stopped.

**Required repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `DATABASE_URL` | NeonDB connection string |
| `GROQ_API_KEY` | Groq key 1 |
| `GROQ_API_KEY_2` | Groq key 2 |
| `GROQ_API_KEY_3` | Groq key 3 |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth2 refresh token |

You can also trigger a run manually from the **Actions** tab → **Backfill Job Emails** → **Run workflow**.

Once backfill is fully complete, set `SYNC_MODE_ONLY=true` in `.env` and switch to `npm run sync` for daily incremental syncs.

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
