# Job Dashboard

React analytics dashboard for your personal job-tracking system.

## Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Fill in your Neon DB connection string

3. **Run locally**
   ```bash
   npm run dev
   ```
   This starts both the Vite dev server (port 5173) and the API server (port 3001).

4. Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repository
3. Set environment variable: `DATABASE_URL` = your Neon connection string
4. Deploy

The Vercel serverless functions in `/api` handle all database queries.

## Features

- 📊 Metric cards (applications, interviews, offers, conversion rates)
- 📈 Application funnel chart
- 📅 Monthly timeline chart
- 🏢 Top companies bar chart
- 🎯 Status distribution pie chart
- 🔍 Filter by company, job type, work mode, platform
- ⚠️ Uncertain email review panel
- ✏️ Manual job status editor
