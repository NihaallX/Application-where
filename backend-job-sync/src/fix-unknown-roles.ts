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
        const result = await c.query("UPDATE jobs SET role = '' WHERE role ILIKE 'unknown%' OR role = 'n/a' OR role = '-' OR role = 'Not specified'");
        console.log(`Updated ${result.rowCount} jobs with unknown roles to empty strings.`);
    } finally {
        c.release();
        await pool.end();
    }
}

run().catch(console.error);
