/**
 * One-time script to patch jobs where company = 'Unknown Company'.
 * Run with: node scripts/fix-unknown-companies.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function run() {
    const { rows: unknownJobs } = await pool.query(`
        SELECT j.id as job_id, j.company, j.role, j.current_status,
               e.subject, e.id as email_id
        FROM jobs j
        JOIN emails e ON e.job_id = j.id
        WHERE LOWER(j.company) IN ('unknown', 'unknown company', '')
           OR j.company IS NULL
        ORDER BY j.id
    `);

    console.log(`Found ${unknownJobs.length} email(s) linked to unknown-company jobs.`);

    let updated = 0;

    for (const row of unknownJobs) {
        const subject = (row.subject || '').trim();
        let newCompany = null;

        // Pattern 1: "Indeed Application: [Role]" — company never in email
        if (/^indeed application:/i.test(subject)) {
            newCompany = 'Via Indeed';
        }
        // Pattern 2: "Apply to jobs at X, Y and Z" — take first company
        else {
            const applyMatch = subject.match(/^apply to jobs at (.+)/i);
            if (applyMatch) {
                const first = applyMatch[1].split(/,|\band\b/i)[0].trim();
                if (first.length > 1) newCompany = first;
            }
        }
        // Pattern 3: Internshala alerts
        if (!newCompany && /internshala/i.test(subject)) {
            newCompany = 'Via Internshala';
        }
        // Pattern 4: Generic Indeed job alerts (new jobs, job alert)
        if (!newCompany && (/indeed job alert/i.test(subject) || /\bnew jobs? matching\b/i.test(subject))) {
            newCompany = 'Via Indeed';
        }
        // Pattern 5: LinkedIn job alerts
        if (!newCompany && /new internship vacancies|jobs matching your preferences/i.test(subject)) {
            newCompany = 'Via Indeed';
        }

        if (newCompany) {
            await pool.query('UPDATE jobs SET company = $1 WHERE id = $2', [newCompany, row.job_id]);
            console.log(`  ✓ Job ${row.job_id} (${row.current_status}): "${row.company}" → "${newCompany}"  [subject: ${subject.substring(0, 60)}]`);
            updated++;
        } else {
            console.log(`  ? Job ${row.job_id} (${row.current_status}): could not determine company. Subject: ${subject.substring(0, 80)}`);
        }
    }

    const dedupedJobIds = [...new Set(unknownJobs.map(r => r.job_id))];
    console.log(`\nUpdated ${updated} email → job record(s). Total unique jobs processed: ${dedupedJobIds.length}`);
    await pool.end();
}

run().catch((e) => { console.error(e.message); process.exit(1); });
