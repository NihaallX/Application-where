# Application Where? 📬

> **Your job search, finally organised — automatically.**

Application Where? scans your Gmail inbox, uses an LLM to read and classify every job-related email, and surfaces a live analytics dashboard so you always know exactly where you stand in your job search — without lifting a finger.

---

## The Problem

You apply to 50+ roles. Confirmations, rejections, interview invites, recruiter reach-outs, and "we viewed your profile" emails all land in the same inbox. Tracking everything in a spreadsheet is tedious. Forgetting to update it means you miss a follow-up or double-apply. You never have a clear picture of your funnel.

## The Vision

A **fully automated, personal job search CRM** that lives in your inbox.

- Zero manual input during the job search
- Every application, every rejection, every interview is captured and classified
- A clean dashboard that tells you your conversion rates, top companies, active interviews, and upcoming deadlines — in real time
- Notes and status overrides for when you want to add context
- One-click reclassification when the AI gets it wrong

The long-term goal is to make this available to anyone job-searching, with their own Gmail and no technical setup required.

---

## How It Works

```
Your Gmail Inbox
      │
      ▼
 Batch Fetch          ← pulls emails in pages of 100 via Gmail API
      │
      ▼
 Heuristic Prefilter  ← fast keyword + domain check (no LLM cost for spam)
      │
      ▼
 Groq LLM             ← llama-3.1-8b-instant classifies each email into:
      │                  category | company | role | interview_date |
      │                  job_type | work_mode | source_platform | confidence
      ▼
 Status Evolution     ← priority-based upsert (OFFER > INTERVIEW > REJECTED > ...)
      │
      ▼
 Neon Postgres        ← jobs + emails tables, permanent record
      │
      ▼
 React Dashboard      ← live analytics, review panel, manual overrides
```

---

## Features

### Backend (`backend-job-sync`)
- **Full inbox backfill** — scans your entire Gmail history in one run, resuming safely if interrupted
- **Incremental sync** — scheduled weekly (GitHub Actions) to stay current
- **3-key Groq rotation** — distributes load across up to 3 free-tier API keys (~3× throughput)
- **Per-key throttle** — respects the 30 RPM free-tier limit per key independently
- **Daily token tracking** — monitors usage against the 100k/day Groq limit, persisted across restarts
- **Smart deduplication** — priority-based upsert means a `REJECTED` email won't overwrite an `INTERVIEW` status for the same job
- **Company name extraction** — multi-source fallback (email body → sender name → domain → subject patterns)
- **Partial JSON recovery** — handles LLM response truncation gracefully
- **Category remapping** — corrects common LLM confusions (e.g. INTERNSHIP returned as category)

### Dashboard (`job-dashboard`)
- **Metric cards** — Applications, Interviews, Offers, Rejections, Application Views, Recruiter Outreach; each card filters the table on click
- **Application funnel** — visual conversion from applied → viewed → interview → offer
- **Timeline chart** — daily application activity over time
- **Company chart** — top hiring companies by volume
- **Status pie chart** — breakdown across all categories
- **Filter panel** — slice by company, job type (Internship / Full-Time), work mode (Remote / Hybrid / Onsite), and source platform
- **Uncertain email review** — low-confidence classifications surface for manual review; one click to accept or correct
- **Status editor** — change any job's status, add notes, see full email thread
- **Interview countdown** — "Interview in 3 days" banners on active rows
- **Search** — real-time filter across company and role name
- **CSV export** — download your full job history with one click
- **Reclassify** — re-run the LLM on any OTHER/MISCELLANEOUS email to get a better classification
- **Monitor page** — live sync status, per-key Groq usage, daily token budget bar, start/stop controls

### Categories tracked
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

## Project Structure

```
job-classifier/
├── backend-job-sync/       # Node.js + TypeScript — Gmail scanner & classifier
│   ├── src/
│   │   ├── classifier/     # Groq LLM integration, prefilter heuristics
│   │   ├── db/             # NeonDB client, query operations, schema
│   │   ├── gmail/          # OAuth2 auth, Gmail API fetcher
│   │   └── utils/          # Logger, sync status tracker
│   ├── scripts/            # One-off DB migrations and fixes
│   └── schema.sql          # Postgres table definitions
│
└── job-dashboard/          # React + Vite — analytics dashboard
    ├── src/
    │   ├── components/     # All UI components
    │   ├── hooks/          # useJobs — data fetching and mutations
    │   └── types.ts        # Shared TypeScript types
    ├── api/                # Vercel serverless API routes
    └── server.ts           # Local Express dev server
```

---

## Stack

| Layer | Technology |
|---|---|
| Email source | Gmail API (OAuth2) |
| LLM | Groq — `llama-3.1-8b-instant` |
| Database | NeonDB (serverless Postgres) |
| Backend runtime | Node.js + TypeScript (`tsx`) |
| Frontend | React 18 + Vite + TypeScript |
| Charts | Recharts |
| Hosting | Vercel (dashboard) + GitHub Actions (weekly sync) |

---

## Setup

### Prerequisites
- A Gmail account you use for job applications
- A [Neon](https://neon.tech) account (free tier is enough)
- A [Groq](https://console.groq.com) account (free tier — up to 3 keys for better throughput)
- [Node.js](https://nodejs.org) v18+

### 1. Database

Run the schema in your Neon SQL editor:

```sql
-- from backend-job-sync/schema.sql
```

### 2. Backend

```bash
cd backend-job-sync
npm install
cp .env.example .env
# Fill in DATABASE_URL, GROQ_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

**First run (OAuth consent + full backfill):**
```bash
npm run backfill
```
A browser window opens for Google sign-in. After authorising, copy the printed `GOOGLE_REFRESH_TOKEN` into `.env`. The backfill scans your full inbox and classifies every job email.

**Subsequent syncs:**
```bash
npm run sync
```

### 3. Dashboard

```bash
cd job-dashboard
npm install
cp .env.example .env
# Fill in DATABASE_URL
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Deploy

**Dashboard → Vercel:**
1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Set `DATABASE_URL` environment variable
4. Deploy

**Weekly sync → GitHub Actions:**

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `GROQ_API_KEY` | Primary Groq key |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | Printed during first backfill run |

---

## Environment Variables

**`backend-job-sync/.env`**
```env
DATABASE_URL=postgresql://...
GROQ_API_KEY=gsk_...
GROQ_API_KEY_2=gsk_...        # optional — improves throughput
GROQ_API_KEY_3=gsk_...        # optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

**`job-dashboard/.env`**
```env
DATABASE_URL=postgresql://...
```

---

## Roadmap

- [ ] Public SaaS — sign in with Google, your own isolated dashboard
- [ ] Push notifications for new interviews or offers
- [ ] Follow-up reminders (e.g. "No response in 14 days — follow up?")
- [ ] Multi-inbox support
- [ ] Mobile-responsive dashboard
- [ ] AI-generated weekly job search summary

---

## License

MIT — build on it, learn from it, make it your own.
