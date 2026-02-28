import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getDbUserId } from '@/lib/auth-db';

export async function PATCH(req: NextRequest) {
  try {
    const dbUserId = await getDbUserId();
    if (!dbUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, status } = await req.json();
    if (!jobId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE jobs
      SET current_status = ${status}, last_update_date = NOW()
      WHERE id = ${jobId} AND user_id = ${dbUserId}
    `;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
