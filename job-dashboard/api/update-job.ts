import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
    if (req.method !== 'PATCH') {
        return new Response('Method not allowed', { status: 405 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const body = await req.json();
    const { jobId, status } = body;

    if (!jobId || !status) {
        return new Response(JSON.stringify({ error: 'jobId and status required' }), { status: 400 });
    }

    try {
        await sql('UPDATE jobs SET current_status = $1, last_update_date = NOW() WHERE id = $2', [status, jobId]);
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
