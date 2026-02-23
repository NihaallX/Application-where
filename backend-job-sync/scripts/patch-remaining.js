const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

const updates = [
    ['Via LinkedIn',    '33d4389f-76b3-44db-a54e-297f859bef16'],
    ['Manually Applied','74b36a59-6558-4eb4-87e8-f322f7a38f02'],
    ['Via LinkedIn',    'ce281272-56da-4287-8b30-99d9602d0937'],
    ['Via Internshala', 'e25c2022-9f7a-452d-9fc1-a553b3f77de7'],
];

Promise.all(updates.map(([company, id]) =>
    pool.query('UPDATE jobs SET company=$1 WHERE id=$2', [company, id])
        .then(() => console.log(`  ✓ ${id.substring(0,8)}… → "${company}"`))
)).then(() => { console.log('All patched.'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
