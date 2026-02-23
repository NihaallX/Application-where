import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
    const sql = neon(process.env.DATABASE_URL!);
    const url = new URL(req.url);
    const params = url.searchParams;

    const conditions: string[] = [];
    const values: string[] = [];

    if (params.get('company')) {
        values.push(params.get('company')!);
        conditions.push(`LOWER(company) = LOWER($${values.length})`);
    }
    if (params.get('job_type')) {
        values.push(params.get('job_type')!);
        conditions.push(`job_type = $${values.length}`);
    }
    if (params.get('work_mode')) {
        values.push(params.get('work_mode')!);
        conditions.push(`work_mode = $${values.length}`);
    }
    if (params.get('source_platform')) {
        values.push(params.get('source_platform')!);
        conditions.push(`LOWER(source_platform) = LOWER($${values.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM jobs ${where} ORDER BY last_update_date DESC`;

    try {
        const rows = await sql(query, values);
        return new Response(JSON.stringify(rows), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
