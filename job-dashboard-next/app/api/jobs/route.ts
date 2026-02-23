import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { searchParams } = new URL(req.url);

    const conditions: string[] = [];
    const values: string[] = [];

    if (searchParams.get('company')) {
      values.push(searchParams.get('company')!);
      conditions.push(`LOWER(company) = LOWER($${values.length})`);
    }
    if (searchParams.get('job_type')) {
      values.push(searchParams.get('job_type')!);
      conditions.push(`job_type = $${values.length}`);
    }
    if (searchParams.get('work_mode')) {
      values.push(searchParams.get('work_mode')!);
      conditions.push(`work_mode = $${values.length}`);
    }
    if (searchParams.get('source_platform')) {
      values.push(searchParams.get('source_platform')!);
      conditions.push(`LOWER(source_platform) = LOWER($${values.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [jobs, timelineRows] = await Promise.all([
      sql(
        `SELECT id, company, role, current_status, job_type, work_mode,
                first_email_date, source_platform, last_update_date,
                interview_date, created_at,
                COALESCE(notes, '') AS notes
         FROM jobs ${where}
         ORDER BY last_update_date DESC
         LIMIT 2000`,
        values
      ),
      sql`
        SELECT DATE(first_email_date AT TIME ZONE 'UTC') AS date, COUNT(*)::int AS count
        FROM jobs
        WHERE first_email_date IS NOT NULL
        GROUP BY DATE(first_email_date AT TIME ZONE 'UTC')
        ORDER BY date
      `,
    ]);

    return NextResponse.json({ jobs, timeline: timelineRows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
