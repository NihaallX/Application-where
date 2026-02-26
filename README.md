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
- **Heuristic prefilter before LLM call** — Keyword + domain check eliminates newsletters, spam, and irrelevant emails before they hit the LLM. Reduces cost and API rate limit pressure by ~60–70%.
- **Priority-based upsert** — Status evolution follows a hierarchy (OFFER > INTERVIEW > REJECTED > APPLICATION_VIEWED > APPLIED_CONFIRMATION). A rejection email won't overwrite an interview status for the same job. This prevents incorrect status downgrades from out-of-order email processing.
- **3-key Groq rotation** — Three free-tier API keys rotated round-robin with per-key 30 RPM throttling. ~3× throughput without paying for a higher tier — practical for a personal tool.
- **GitHub Actions for weekly sync** — No infrastructure to maintain. The backend runs as a scheduled job twice weekly. The dashboard on Vercel is always up.
- **One-click reclassification** — When the LLM misclassifies an OTHER/MISCELLANEOUS email, users can re-run classification from the dashboard. Human correction, machine execution.

---

## System Architecture

```
Gmail Inbox
      ↓
Batch Fetch (pages of 100, Gmail API OAuth2)
      ↓
Heuristic Prefilter (keyword + domain check)
      ↓
Groq LLM — llama-3.1-8b-instant
  └── classify: category | company | role | interview_date |
                job_type | work_mode | source_platform | confidence
      ↓
Priority-based Status Upsert
      ↓
NeonDB (Postgres) — jobs + emails tables
      ↓
React + Vite Dashboard (Vercel)
  ├── Metric cards (Applications, Interviews, Offers, Rejections)
  ├── Application funnel visualization
  ├── Timeline, company, and status charts
  ├── Low-confidence review queue
  └── CSV export
```

**Stack:** Node.js · TypeScript · Groq SDK · Gmail API (OAuth2) · NeonDB (serverless Postgres) · React 18 · Vite · Recharts · Vercel · GitHub Actions

---

## Metrics

| Feature | Status |
|---|---|
| Full inbox backfill (Gmail API) | ✅ Implemented |
| LLM classification (7 categories) | ✅ Implemented |
| Priority-based status upsert | ✅ Implemented — logic is deterministic and hard-coded |
| 3-key Groq rotation (30 RPM per key) | ✅ Implemented |
| React analytics dashboard | ✅ Deployed (Vercel) |
| GitHub Actions weekly sync | ✅ Deployed |
| LLM cost (free tier + key rotation) | ~$0 for personal-scale usage |

*No formal classification accuracy benchmarks have been run. Accuracy depends on LLM quality on your specific inbox's email phrasing.*

---

## Future Roadmap

- **Public SaaS** — sign in with Google, isolated dashboard per user, no technical setup required
- **Push notifications** — real-time alert when an interview invite or offer lands
- **Follow-up reminders** — "No response in 14 days — want to follow up?" nudges
- **Multi-inbox support** — connect multiple Gmail accounts (personal + work)
- **AI weekly summary** — natural language summary of your job search week: "You got 3 rejections, 1 interview, and 12 new applications processed"
- **Integration with Intern-stellar** — close the loop between job discovery (Intern-stellar) and application tracking (Application-where)
- **Mobile-responsive dashboard** — current dashboard optimized for desktop; mobile view needed for on-the-go check-ins


---

## Original README

> The following is the original technical README from the repository, preserved in full.

---
# Application Where? 

> **Your job search, finally organised � automatically.**

Application Where? scans your Gmail inbox, uses an LLM to read and classify every job-related email, and surfaces a live analytics dashboard so you always know exactly where you stand in your job search � without lifting a finger.

---

## The Problem

You apply to 50+ roles. Confirmations, rejections, interview invites, recruiter reach-outs, and "we viewed your profile" emails all land in the same inbox. Tracking everything in a spreadsheet is tedious. You never have a clear picture of your funnel.

## The Vision

A **fully automated, personal job search CRM** that lives in your inbox. Zero manual input during the job search. A clean dashboard with conversion rates, top companies, active interviews, and upcoming deadlines � in real time.

---

## How It Works

```
Your Gmail Inbox
      
      
 Batch Fetch           pulls emails in pages of 100 via Gmail API
      
      
 Heuristic Prefilter   fast keyword + domain check (no LLM cost for spam)
      
      
 Groq LLM              llama-3.1-8b-instant classifies each email into:
                        category | company | role | interview_date |
                        job_type | work_mode | source_platform | confidence
      
 Status Evolution      priority-based upsert (OFFER > INTERVIEW > REJECTED > ...)
      
      
 Neon Postgres         jobs + emails tables, permanent record
      
      
 React Dashboard       live analytics, review panel, manual overrides
```

---

## Features

### Backend (`backend-job-sync`)
- Full inbox backfill � scans your entire Gmail history in one run
- Incremental sync � scheduled weekly (GitHub Actions) to stay current
- 3-key Groq rotation � distributes load across up to 3 free-tier API keys
- Per-key throttle � respects the 30 RPM free-tier limit per key independently
- Daily token tracking � monitors usage against the 100k/day Groq limit
- Smart deduplication � priority-based upsert (OFFER won't be overwritten by REJECTED)
- Partial JSON recovery � handles LLM response truncation gracefully

### Dashboard (`job-dashboard`)
- Metric cards � Applications, Interviews, Offers, Rejections, Application Views, Recruiter Outreach
- Application funnel � visual conversion from applied  viewed  interview  offer
- Filter panel � slice by company, job type (Internship / Full-Time), work mode, source platform
- Uncertain email review � low-confidence classifications surface for manual review
- Interview countdown � "Interview in 3 days" banners on active rows
- CSV export � download your full job history

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
| LLM | Groq � `llama-3.1-8b-instant` |
| Database | NeonDB (serverless Postgres) |
| Backend runtime | Node.js + TypeScript (`tsx`) |
| Frontend | React 18 + Vite + TypeScript |
| Charts | Recharts |
| Hosting | Vercel (dashboard) + GitHub Actions (weekly sync) |

---

## Setup

### Prerequisites
- A Gmail account you use for job applications
- A [Neon](https://neon.tech) account (free tier)
- A [Groq](https://console.groq.com) account (free tier � up to 3 keys)
- Node.js v18+

### 1. Database
Run the schema in your Neon SQL editor: `backend-job-sync/schema.sql`

### 2. Backend
```bash
cd backend-job-sync
npm install
cp .env.example .env
# Fill in DATABASE_URL, GROQ_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# First run (OAuth consent + full backfill):
npm run backfill
# Copy printed GOOGLE_REFRESH_TOKEN into .env

# Subsequent syncs:
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

### 4. Deploy
- **Dashboard  Vercel**: Import repo, set `DATABASE_URL`, deploy
- **Weekly sync  GitHub Actions**: Add `DATABASE_URL`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` as repo secrets

---

## Roadmap

- [ ] Public SaaS � sign in with Google, your own isolated dashboard
- [ ] Push notifications for new interviews or offers
- [ ] Follow-up reminders
- [ ] Multi-inbox support
- [ ] Mobile-responsive dashboard
- [ ] AI-generated weekly job search summary

---

## License

MIT � build on it, learn from it, make it your own.
