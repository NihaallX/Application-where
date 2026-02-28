/**
 * Mark jobs as GHOSTED if they've had no activity for 21+ days
 * and are still in APPLIED_CONFIRMATION or APPLICATION_VIEWED status.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

const GHOST_THRESHOLD_DAYS = 21;

async function ghostSweep() {
    const client = await pool.connect();
    try {
        console.log('\n=== GHOSTING SWEEP (threshold: ' + GHOST_THRESHOLD_DAYS + ' days) ===\n');

        // Find jobs that are APPLIED_CONFIRMATION or APPLICATION_VIEWED
        // and whose most recent email is older than threshold
        const result = await client.query(`
            UPDATE jobs SET current_status = 'GHOSTED'
            WHERE current_status IN ('APPLIED_CONFIRMATION', 'APPLICATION_VIEWED')
            AND id IN (
                SELECT j.id FROM jobs j
                LEFT JOIN emails e ON e.job_id = j.id
                WHERE j.current_status IN ('APPLIED_CONFIRMATION', 'APPLICATION_VIEWED')
                GROUP BY j.id
                HAVING COALESCE(MAX(e.email_date), j.first_email_date) < NOW() - INTERVAL '${GHOST_THRESHOLD_DAYS} days'
            )
            RETURNING id, company, role
        `);

        console.log('Ghosted ' + result.rows.length + ' jobs:\n');
        for (const j of result.rows.slice(0, 20)) {
            console.log('  👻 "' + j.company + ' / ' + j.role + '"');
        }
        if (result.rows.length > 20) {
            console.log('  ... and ' + (result.rows.length - 20) + ' more');
        }

        // Final summary
        const final = await client.query('SELECT current_status, COUNT(*)::int as c FROM jobs GROUP BY current_status ORDER BY c DESC');
        const total = await client.query('SELECT COUNT(*)::int as c FROM jobs');

        console.log('\n=== FINAL STATUS BREAKDOWN ===');
        console.log('Total jobs: ' + total.rows[0].c);
        for (const r of final.rows) {
            console.log('  ' + r.current_status + ': ' + r.c);
        }
        console.log('');

    } finally {
        client.release();
        await pool.end();
    }
}

ghostSweep().catch(err => { console.error(err); process.exit(1); });
