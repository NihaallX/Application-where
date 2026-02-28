import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function run() {
    const c = await pool.connect();
    try {
        console.log('--- FIXING "INDEED IRELAND" ---');
        const resIndeed = await c.query(`
            UPDATE jobs 
            SET company = 'Via Indeed' 
            WHERE company ILIKE '%Indeed Ireland%' 
            RETURNING id, company, role
        `);
        console.log(`Updated ${resIndeed.rowCount} jobs to 'Via Indeed'`);

        console.log('\n--- FIXING UNKNOWN WORK MODES ---');
        // We'll pull jobs that are 'UNKNOWN', check their role, and corresponding email subject
        const unknowns = await c.query(`
            SELECT j.id, j.company, j.role, e.subject 
            FROM jobs j
            LEFT JOIN emails e ON e.job_id = j.id
            WHERE j.work_mode = 'UNKNOWN'
        `);

        let fixedModes = 0;
        let remoteCounts = 0;
        let hybridCounts = 0;
        let onsiteCounts = 0;

        for (const j of unknowns.rows) {
            const text = `${j.role || ''} ${j.subject || ''}`.toLowerCase();
            let newMode = 'UNKNOWN';

            if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
                newMode = 'REMOTE';
                remoteCounts++;
            } else if (text.includes('hybrid')) {
                newMode = 'HYBRID';
                hybridCounts++;
            } else if (text.includes('onsite') || text.includes('on-site')) {
                newMode = 'ONSITE';
                onsiteCounts++;
            }

            if (newMode !== 'UNKNOWN') {
                await c.query("UPDATE jobs SET work_mode = $1 WHERE id = $2", [newMode, j.id]);
                fixedModes++;
            }
        }

        console.log(`Fixed ${fixedModes} work modes.`);
        console.log(`  - REMOTE: ${remoteCounts} `);
        console.log(`  - HYBRID: ${hybridCounts} `);
        console.log(`  - ONSITE: ${onsiteCounts} `);

    } catch (e) {
        console.error(e);
    } finally {
        c.release();
        await pool.end();
    }
}

run().catch(console.error);
