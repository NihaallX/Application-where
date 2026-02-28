import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function analyzeUnknownRoles() {
    const c = await pool.connect();
    try {
        const unknowns = await c.query(`
            SELECT j.id, j.company, j.role, j.current_status, e.subject 
            FROM jobs j
            LEFT JOIN emails e ON e.job_id = j.id
            WHERE j.role = 'Unknown Role' OR j.role = '' OR j.role IS NULL
            ORDER BY j.last_update_date DESC
            LIMIT 100
        `);

        fs.writeFileSync('C:\\Users\\Nihal\\AppData\\Local\\Temp\\unknowns_dump.json', JSON.stringify(unknowns.rows, null, 2));
        console.log('Dumped to unknowns_dump.json');
    } finally {
        c.release();
        await pool.end();
    }
}

analyzeUnknownRoles().catch(console.error);
