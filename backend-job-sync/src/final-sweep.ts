/**
 * Final sweep — bulk fix all remaining orphaned INTERVIEW jobs
 * and handle the last 3 with emails.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function finalSweep() {
    const client = await pool.connect();
    try {
        console.log('\n=== FINAL INTERVIEW SWEEP ===\n');

        // Step 1: Get all INTERVIEW jobs and check which have emails
        const interviewJobs = await client.query(
            `SELECT j.id, j.company, j.role,
                    (SELECT COUNT(*)::int FROM emails e WHERE e.job_id = j.id) as email_count
             FROM jobs j WHERE j.current_status = 'INTERVIEW'`
        );

        console.log('Total INTERVIEW jobs: ' + interviewJobs.rows.length);
        const orphans = interviewJobs.rows.filter(j => j.email_count === 0);
        const withEmails = interviewJobs.rows.filter(j => j.email_count > 0);
        console.log('  With emails: ' + withEmails.length);
        console.log('  Without emails (orphans): ' + orphans.length);

        // Step 2: Delete orphans
        if (orphans.length > 0) {
            const orphanIds = orphans.map(j => j.id);
            await client.query('DELETE FROM jobs WHERE id = ANY($1::uuid[])', [orphanIds]);
            console.log('\nDeleted ' + orphans.length + ' orphaned INTERVIEW jobs:');
            for (const j of orphans) {
                console.log('  - "' + j.company + ' / ' + j.role + '"');
            }
        }

        // Step 3: Handle the remaining ones with emails
        console.log('\nRemaining INTERVIEW jobs with emails:');
        for (const job of withEmails) {
            const emails = await client.query(
                'SELECT id, subject, category, confidence FROM emails WHERE job_id = $1',
                [job.id]
            );
            console.log('\n"' + job.company + ' / ' + job.role + '" (' + emails.rows.length + ' emails):');

            let hasRealInterview = false;
            for (const e of emails.rows) {
                console.log('  [' + e.category + ', conf=' + e.confidence + ']: "' + e.subject + '"');
                // Check if any email genuinely says "interview" in a personal context
                const s = (e.subject || '').toLowerCase();
                if (e.category === 'INTERVIEW' && (
                    /next step in your interview/i.test(s) ||
                    /interview is scheduled/i.test(s) ||
                    /please complete.*assessment/i.test(s) ||
                    /shortlisted/i.test(s) ||
                    /assignment.*next step/i.test(s)
                )) {
                    hasRealInterview = true;
                }
            }

            if (!hasRealInterview) {
                // Reclassify all INTERVIEW emails for this job
                for (const e of emails.rows) {
                    if (e.category === 'INTERVIEW') {
                        const s = (e.subject || '');
                        let newCat = 'OTHER';
                        // LinkedIn job alerts
                        if (/^".+":\s+/i.test(s)) newCat = 'OTHER';
                        // Job listing
                        else if (/@\s+/i.test(s)) newCat = 'RECRUITER_OUTREACH';

                        await client.query('UPDATE emails SET category = $1 WHERE id = $2', [newCat, e.id]);
                        console.log('  Fixed: [INTERVIEW -> ' + newCat + ']');
                    }
                }

                // Recalculate job status
                const STATUS_PRIORITY: Record<string, number> = {
                    RECRUITER_OUTREACH: 1, APPLIED_CONFIRMATION: 2,
                    APPLICATION_VIEWED: 3, REJECTED: 4, INTERVIEW: 5, OFFER: 6,
                };
                const remainingEmails = await client.query(
                    "SELECT category FROM emails WHERE job_id = $1 AND category NOT IN ('OTHER', 'MISCELLANEOUS')",
                    [job.id]
                );
                let best = 'OTHER';
                let bestP = 0;
                for (const r of remainingEmails.rows) {
                    const p = STATUS_PRIORITY[r.category] || 0;
                    if (p > bestP) { bestP = p; best = r.category; }
                }
                await client.query('UPDATE jobs SET current_status = $1 WHERE id = $2', [best, job.id]);
                console.log('  Job status: INTERVIEW -> ' + best);
            } else {
                console.log('  ✓ KEEPING as INTERVIEW (legitimate)');
            }
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

finalSweep().catch(err => { console.error(err); process.exit(1); });
