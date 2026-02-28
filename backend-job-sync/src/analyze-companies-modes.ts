import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function run() {
    const c = await pool.connect();
    try {
        const indeedJobs = await c.query(`
            SELECT j.id, j.company, j.role, e.subject 
            FROM jobs j
            LEFT JOIN emails e ON e.job_id = j.id
            WHERE j.company ILIKE '%Indeed Ireland%'
            LIMIT 20
        `);

        const unknownModes = await c.query(`
            SELECT j.id, j.company, j.role, e.subject 
            FROM jobs j
            LEFT JOIN emails e ON e.job_id = j.id
            WHERE j.work_mode = 'UNKNOWN'
            LIMIT 50
        `);

        const counts = await c.query("SELECT work_mode, COUNT(*)::int as c FROM jobs GROUP BY work_mode ORDER BY c DESC");

        const output = {
            indeedIreland: indeedJobs.rows,
            unknownModes: unknownModes.rows,
            modeCounts: counts.rows
        };

        fs.writeFileSync('C:\\Users\\Nihal\\AppData\\Local\\Temp\\company_mode_analysis.json', JSON.stringify(output, null, 2));
        console.log('Dumped to company_mode_analysis.json');

    } catch (e) {
        console.error(e);
    } finally {
        c.release();
        await pool.end();
    }
}

run().catch(console.error);
