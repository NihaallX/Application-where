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
        await c.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo_url TEXT`);
        console.log("Added company_logo_url to jobs table.");
    } catch (e) {
        console.error(e);
    } finally {
        c.release();
        await pool.end();
    }
}

run().catch(console.error);
