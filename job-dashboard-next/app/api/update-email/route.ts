import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getDbUserId } from '@/lib/auth-db';

const STATUS_PRIORITY: Record<string, number> = {
  RECRUITER_OUTREACH: 1, APPLICATION_VIEWED: 2, APPLIED_CONFIRMATION: 3,
  REJECTED: 4, INTERVIEW: 5, OFFER: 6,
};

export async function PATCH(req: NextRequest) {
  try {
    const dbUserId = await getDbUserId();
    if (!dbUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { emailId, category } = await req.json();
    if (!emailId || !category) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);

    // Update email classification — verify ownership via join
    await sql`
      UPDATE emails SET category = ${category}, confidence = 1.0
      WHERE id = ${emailId} AND user_id = ${dbUserId}
    `;

    // Update the job status if this category has higher priority
    const emailRow = await sql`SELECT job_id FROM emails WHERE id = ${emailId} AND user_id = ${dbUserId}`;
    if (emailRow.length > 0 && emailRow[0].job_id) {
      const jobId = emailRow[0].job_id;
      const jobRow = await sql`SELECT current_status FROM jobs WHERE id = ${jobId} AND user_id = ${dbUserId}`;
      if (jobRow.length > 0) {
        const currentPriority = STATUS_PRIORITY[jobRow[0].current_status] ?? 0;
        const newPriority = STATUS_PRIORITY[category] ?? 0;
        if (newPriority > currentPriority) {
          await sql`
            UPDATE jobs SET current_status = ${category}, last_update_date = NOW()
            WHERE id = ${jobId} AND user_id = ${dbUserId}
          `;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
