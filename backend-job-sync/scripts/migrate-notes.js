const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function run() {
    // Add notes column (idempotent)
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`);
    console.log('✓ notes column added (or already exists)');
    pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
