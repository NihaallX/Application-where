import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function fixUnknowns() {
    const c = await pool.connect();
    try {
        console.log('--- BEFORE ---');
        const before = await c.query("SELECT job_type, COUNT(*)::int as c FROM jobs GROUP BY job_type ORDER BY c DESC");
        before.rows.forEach(r => console.log(r.job_type + ': ' + r.c));

        const unknowns = await c.query("SELECT id, company, role FROM jobs WHERE job_type = 'UNKNOWN'");
        let fixed = 0;

        for (const j of unknowns.rows) {
            let newType = 'UNKNOWN';
            const role = (j.role || '').toLowerCase(); // Fix: Safely default to empty string if null

            if (role.includes('intern') || role.includes('trainee') || role.includes('apprentice') || role.includes('student')) {
                newType = 'INTERNSHIP';
            } else if (role.includes('contract') || role.includes('freelance') || role.includes('consultant')) {
                newType = 'CONTRACT';
            } else if (role.includes('engineer') || role.includes('developer') || role.includes('analyst') ||
                role.includes('manager') || role.includes('associate') || role.includes('specialist') ||
                role.includes('architect') || role.includes('lead') || role.includes('senior') ||
                role.includes('scientist') || role.includes('programmer') || role.includes('designer') ||
                role.includes('administrator') || role.trim() !== '') {
                // If it doesn't match intern/contract, but role is somewhat explicit (has title),
                // we'll default to FULL_TIME as it's the most common default
                newType = 'FULL_TIME';
            }

            if (newType !== 'UNKNOWN') {
                await c.query("UPDATE jobs SET job_type = $1 WHERE id = $2", [newType, j.id]);
                fixed++;
                if (fixed <= 10) console.log('Fixed:', j.role, '->', newType);
            }
        }

        console.log('\n--- AFTER (' + fixed + ' fixed) ---');
        const after = await c.query("SELECT job_type, COUNT(*)::int as c FROM jobs GROUP BY job_type ORDER BY c DESC");
        after.rows.forEach(r => console.log(r.job_type + ': ' + r.c));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        c.release();
        await pool.end();
    }
}

fixUnknowns().catch(console.error);
