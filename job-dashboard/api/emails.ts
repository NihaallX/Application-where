import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
    const sql = neon(process.env.DATABASE_URL!);
    const url = new URL(req.url);
    const uncertain = url.searchParams.get('uncertain');

    try {
        let query = 'SELECT * FROM emails';
        if (uncertain === 'true') {
            query += " WHERE category = 'UNCERTAIN' OR confidence < 0.6";
        }
        query += ' ORDER BY email_date DESC LIMIT 100';
        const rows = await sql(query);
        return new Response(JSON.stringify(rows), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
