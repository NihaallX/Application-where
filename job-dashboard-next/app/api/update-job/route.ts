import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  try {
    const { jobId, status } = await req.json();
    if (!jobId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE jobs
      SET current_status = ${status}, last_update_date = NOW()
      WHERE id = ${jobId}
    `;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
