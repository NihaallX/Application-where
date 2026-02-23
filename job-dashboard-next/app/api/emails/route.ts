import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const uncertain = new URL(req.url).searchParams.get('uncertain') === 'true';
    const where = uncertain ? 'WHERE confidence < 0.5' : '';

    const rows = await sql(
      `SELECT id, gmail_id, job_id, category, confidence, email_date, subject, body_preview
       FROM emails ${where}
       ORDER BY email_date DESC LIMIT 200`
    );

    return NextResponse.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
