import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
    if (req.method !== 'PATCH') {
        return new Response('Method not allowed', { status: 405 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const body = await req.json();
    const { emailId, category } = body;

    if (!emailId || !category) {
        return new Response(JSON.stringify({ error: 'emailId and category required' }), { status: 400 });
    }

    try {
        // Also set confidence = 1.0 so manually reviewed emails no longer appear in the uncertain list
        await sql('UPDATE emails SET category = $1, confidence = 1.0 WHERE id = $2', [category, emailId]);
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
