import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function run() {
    const c = await pool.connect();
    try {
        const r1 = await c.query(
            "UPDATE emails SET category = 'APPLIED_CONFIRMATION' WHERE category = 'INTERVIEW' RETURNING id, subject"
        );
        console.log('Emails fixed: ' + r1.rows.length);
        r1.rows.forEach(r => console.log('  - ' + r.subject));

        const r2 = await c.query(
            "UPDATE jobs SET current_status = 'APPLIED_CONFIRMATION' WHERE current_status = 'INTERVIEW' RETURNING company, role"
        );
        console.log('Jobs fixed: ' + r2.rows.length);
        r2.rows.forEach(r => console.log('  - ' + r.company + ' / ' + r.role));

        const r3 = await c.query('SELECT current_status, COUNT(*)::int as c FROM jobs GROUP BY current_status ORDER BY c DESC');
        console.log('\nFinal breakdown:');
        r3.rows.forEach(r => console.log('  ' + r.current_status + ': ' + r.c));
    } finally {
        c.release();
        await pool.end();
    }
}
run().catch(err => { console.error(err); process.exit(1); });
