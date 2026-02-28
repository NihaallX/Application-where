# Application Where? 📬

> Automated job search CRM that scans your entire Gmail inbox with LLM classification, tracks every application status, and surfaces a live analytics dashboard — zero manual input required.

---

## Problem Statement

Active job seekers applying to 50+ roles lose track fast. Confirmation emails, rejections, interview invites, recruiter outreach, and "we viewed your profile" notifications all land in the same inbox. Spreadsheet tracking is tedious, gets abandoned, and gives no analytics. The result: missed follow-ups, accidental double-applications, and no visibility into conversion rates.

---

## Target Audience

Active job seekers — particularly new grads and career changers — running high-volume job searches (30+ applications) who want to understand their funnel without managing a spreadsheet. Also useful for anyone who has ever missed a follow-up deadline because a recruiter email got buried.

---

## Why

The problem isn't lack of organization tools — it's that they all require manual input, which gets abandoned under job search stress. The only sustainable solution is a system that works invisibly, in the background, without asking anything of the user. Your Gmail already has all the data; the gap is automated classification and a dashboard to surface it.

---

## Product Thinking Decisions

- **Gmail as the source of truth** — Every job-related event ends up in email eventually. Rather than building an app people have to remember to update, the system reads the inbox they're already using.
- **Groq LLM (llama-3.1-8b-instant) for classification** — Fast, cheap, and accurate enough for the task. Each email is classified into one of 7 categories (APPLIED_CONFIRMATION, APPLICATION_VIEWED, INTERVIEW, OFFER, REJECTED, RECRUITER_OUTREACH, OTHER) with confidence score, company, role, and interview date extracted.
- **Heuristic prefilter before LLM call** — Keyword + domain check eliminates newsletters, spam, and irrelevant emails before they hit the LLM. Reduces cost and API rate limit pressure by ~60-70%.
- **Priority-based upsert** — Status evolution follows a hierarchy (OFFER > INTERVIEW > REJECTED > APPLICATION_VIEWED > APPLIED_CONFIRMATION). A rejection email won't overwrite an interview status for the same job. This prevents incorrect status downgrades from out-of-order email processing.
- **3-key Groq round-robin rotation** — Three free-tier API keys rotated with `selectBestKey()` (least-recently-used, non-rate-limited) before every request. ~3x throughput without paying for a higher tier. On 429, the affected key is flagged and the next available key is picked automatically.
- **GitHub Actions daily sync** — No infrastructure to maintain. The backend runs as a scheduled job every night at 19:30 UTC (1:00 AM IST). The dashboard on Vercel is always up.
- **Bulk reclassification from the dashboard** — When the LLM misclassifies OTHER/MISCELLANEOUS emails at scale, a single button in the Monitor tab re-runs all of them through Groq with live SSE progress streaming. Human correction, machine execution.
- **No loading flash on refetch** — Dashboard keeps stale data visible during background refetches instead of blanking to a loading state. Only the very first load shows a spinner.

---

## System Architecture

```
Gmail Inbox
     |
Batch Fetch (pages of 100, Gmail API OAuth2)
     |
Heuristic Prefilter (keyword + domain check)
     |
Groq LLM — llama-3.1-8b-instant
  classify: category | company | role | interview_date |
            job_type | work_mode | source_platform | confidence
     |
Priority-based Status Upsert
     |
NeonDB (serverless Postgres) — jobs + emails tables
     |
Next.js Dashboard (Vercel)
  |-- Metric cards (Applications, Interviews, Offers, Rejections)
  |-- Application funnel visualization
  |-- Timeline, company, status, and breakdown charts
  |-- Analytics (conversion rates + work mode / job type / platform charts)
  |-- Low-confidence review queue with inline status editor
  |-- Monitor tab (sync status, bulk reclassify with live progress)
  `-- Mobile bottom navigation
```

**Stack:** Node.js · TypeScript · Groq SDK · Gmail API (OAuth2) · NeonDB (serverless Postgres) · Next.js 15 · React 19 · Tailwind CSS v4 · shadcn/ui · Recharts · Vercel · GitHub Actions

---

## Features

### Backend (`backend-job-sync`)

- Full inbox backfill — scans your entire Gmail history in one run, resumable across cron runs
- Incremental sync — scheduled nightly via GitHub Actions (19:30 UTC / 1:00 AM IST)
- **Round-robin 3-key Groq rotation** — `selectBestKey()` picks the least-recently-used, non-rate-limited key before every request; on 429 the key is flagged and automatically skipped
- Per-key throttle — respects the 30 RPM free-tier limit independently per key
- Daily token tracking — monitors usage against the 100k/day Groq limit
- Smart deduplication — priority-based upsert (OFFER won't be overwritten by REJECTED)
- Partial JSON recovery — handles LLM response truncation gracefully
- 30s per-call timeout — prevents stalled Groq requests from blocking the sync loop

### Dashboard (`job-dashboard-next`)

- **Metric cards** — Applications, Interviews, Offers, Rejections, Application Views, Recruiter Outreach
- **Application funnel** — visual conversion: applied -> viewed -> interview -> offer
- **Filter panel** — slice by company, job type, work mode, source platform, date range
- **Applications over time chart** — year labels (`Jan '24` style) for ALL / 3M periods and full-date tooltip
- **Analytics page**
  - Conversion stat cards: Total Tracked, Interview Rate, Offer Rate, Active Pipeline
  - Status distribution, funnel, company bar, and timeline charts
  - Breakdown bar charts: Work Mode, Job Type, Platform
- **Review panel** — low-confidence classifications surfaced for manual correction with inline status editor
- **Monitor tab**
  - Live sync status (running / idle, last run timestamp, emails processed)
  - **Bulk Reclassify OTHER Jobs** — streams SSE progress (`X / N changed • "Company – Role"`) with a live progress bar
- **Mobile-responsive** — fixed bottom navigation bar (Dashboard / Analytics / Review / Monitor) on small screens; desktop sidebar on `md+`
- **No loading flash** — stale data stays visible during background refetches

### Categories Tracked

| Category | Meaning |
|---|---|
| `APPLIED_CONFIRMATION` | You applied and got a confirmation |
| `APPLICATION_VIEWED` | A recruiter opened your application or resume |
| `INTERVIEW` | Interview invitation or scheduling |
| `OFFER` | Job offer received |
| `REJECTED` | Application declined |
| `RECRUITER_OUTREACH` | Cold outreach from a recruiter |
| `OTHER` / `MISCELLANEOUS` | Noise, newsletters, job alerts |

---

## Stack

| Layer | Technology |
|---|---|
| Email source | Gmail API (OAuth2) |
| LLM | Groq — `llama-3.1-8b-instant` |
| Database | NeonDB (serverless Postgres) |
| Backend runtime | Node.js + TypeScript (`tsx`) |
| Frontend | Next.js 15 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Hosting | Vercel (dashboard) + GitHub Actions (nightly sync) |

---

## Metrics

| Feature | Status |
|---|---|
| Full inbox backfill (Gmail API, resumable) | ✅ Implemented |
| LLM classification (7 categories) | ✅ Implemented |
| Priority-based status upsert | ✅ Implemented |
| 3-key Groq round-robin rotation | ✅ Implemented |
| Bulk reclassify with live SSE progress | ✅ Implemented |
| Next.js analytics dashboard | ✅ Deployed (Vercel) |
| Mobile bottom navigation | ✅ Implemented |
| GitHub Actions nightly sync (1:00 AM IST) | ✅ Deployed |
| LLM cost (free tier + key rotation) | ~$0 for personal-scale usage |

*No formal classification accuracy benchmarks have been run. Accuracy depends on LLM quality on your specific inbox's email phrasing.*

---

## Setup

### Prerequisites

- A Gmail account you use for job applications
- A [Neon](https://neon.tech) account (free tier)
- A [Groq](https://console.groq.com) account (free tier — up to 3 keys)
- Node.js v18+

### 1. Database

Run the schema in your Neon SQL editor: `backend-job-sync/supabase-schema.sql`

### 2. Backend

```bash
cd backend-job-sync
npm install
cp .env.example .env
# Fill in DATABASE_URL, GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3,
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# First run (OAuth consent + full backfill):
npm run backfill
# Copy printed GOOGLE_REFRESH_TOKEN into .env

# Subsequent syncs:
npm run sync
```

### 3. Dashboard

```bash
cd job-dashboard-next
npm install
cp .env.example .env
# Fill in DATABASE_URL
npm run dev
```

### 4. Deploy

- **Dashboard -> Vercel**: Import repo, set `DATABASE_URL`, deploy from `job-dashboard-next/`
- **Nightly sync -> GitHub Actions**: Add `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` as repo secrets. Cron runs at `30 19 * * *` UTC (1:00 AM IST).

### 5. Optional: Bulk Reclassify Security

Set `BULK_SECRET` in your Vercel environment variables. The `/api/reclassify-bulk` endpoint will then require an `Authorization: Bearer <secret>` header.

---

## Future Roadmap

- **Public SaaS** — sign in with Google, isolated dashboard per user, no technical setup required
- **Push notifications** — real-time alert when an interview invite or offer lands
- **Follow-up reminders** — "No response in 14 days — want to follow up?" nudges
- **Multi-inbox support** — connect multiple Gmail accounts (personal + work)
- **AI weekly summary** — natural language summary of your job search week
- **Free-text search** — search across company, role, and email subject in the jobs table
- **CSV export** — download filtered jobs as `.csv`
- **GitHub Actions failure alerts** — notify on Discord or auto-create an issue when nightly sync fails silently
- **Integration with Intern-stellar** — close the loop between job discovery and application tracking

---

## License

MIT — build on it, learn from it, make it your own.