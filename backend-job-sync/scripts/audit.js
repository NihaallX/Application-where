const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

Promise.all([
    pool.query("SELECT COUNT(*) FROM jobs WHERE current_status='OTHER'"),
    pool.query("SELECT company, role, COUNT(*) as cnt FROM jobs GROUP BY company, role HAVING COUNT(*) > 1 ORDER BY cnt DESC LIMIT 10"),
    pool.query("SELECT AVG(LENGTH(body_preview))::int as avg_len, MAX(LENGTH(body_preview)) as max_len FROM emails"),
    pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='jobs' ORDER BY ordinal_position"),
    pool.query("SELECT current_status, COUNT(*) as cnt FROM jobs GROUP BY current_status ORDER BY cnt DESC"),
]).then(([other, dups, body, cols, statuses]) => {
    console.log('OTHER count:', other.rows[0].count);
    console.log('\nDuplicate company+role pairs:');
    dups.rows.forEach(r => console.log(' ', r.cnt, 'x', r.company, '—', r.role));
    console.log('\nBody preview avg/max length:', body.rows[0]);
    console.log('\nJobs columns:', cols.rows.map(r => r.column_name).join(', '));
    console.log('\nStatus breakdown:');
    statuses.rows.forEach(r => console.log(' ', r.current_status, ':', r.cnt));
    pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
