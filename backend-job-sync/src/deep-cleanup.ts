/**
 * Deep cleanup — fixes remaining INTERVIEW and OFFER misclassifications.
 *
 * Patterns found:
 * 1. 48 INTERVIEW jobs have NO linked emails → orphans → delete
 * 2. LinkedIn job notifications classified as INTERVIEW → should be RECRUITER_OUTREACH or OTHER
 * 3. Hackathons, programs, courses → should be OTHER
 * 4. "Thank you for applying" → APPLIED_CONFIRMATION not INTERVIEW
 * 5. All 3 remaining OFFER jobs are fake (L'Oréal challenge, Internshala, Nestlé marketing)
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

// Subjects/roles that indicate NOT a real interview
const NOT_INTERVIEW_PATTERNS = [
    /hackathon/i,
    /hack\s?\d{4}/i,
    /challenge\s+\d{4}/i,
    /course/i,
    /virtual internship program/i,
    /internship program/i,
    /internship opportunity/i,
    /internship orientation/i,
    /fellowship.*program/i,
    /training/i,
    /strategy call/i,
    /game development course/i,
    /grabhack/i,
    /nesternship/i,
];

async function deepCleanup() {
    const client = await pool.connect();
    try {
        console.log('\n' + '='.repeat(60));
        console.log('  DEEP CLEANUP — REMAINING FALSE INTERVIEWS & OFFERS');
        console.log('='.repeat(60));

        // ========== STEP 1: Delete orphaned INTERVIEW jobs (no emails) ==========
        console.log('\n1. Removing orphaned INTERVIEW jobs (no linked emails)...');
        const orphanedInterviews = await client.query(`
            SELECT j.id, j.company, j.role FROM jobs j
            WHERE j.current_status = 'INTERVIEW'
            AND j.id NOT IN (SELECT DISTINCT job_id FROM emails WHERE job_id IS NOT NULL)
        `);

        let orphanCount = 0;
        for (const job of orphanedInterviews.rows) {
            console.log('  Deleted: "' + job.company + ' / ' + job.role + '"');
            await client.query('DELETE FROM jobs WHERE id = $1', [job.id]);
            orphanCount++;
        }
        console.log('  Total orphaned INTERVIEW jobs deleted: ' + orphanCount);

        // ========== STEP 2: Fix remaining INTERVIEW emails by pattern ==========
        console.log('\n2. Fixing remaining misclassified INTERVIEW emails...');

        const remainingInterviewEmails = await client.query(`
            SELECT e.id, e.subject, e.category, e.job_id FROM emails e
            WHERE e.category = 'INTERVIEW'
        `);

        let emailsFixed = 0;
        for (const email of remainingInterviewEmails.rows) {
            const subject = email.subject || '';
            let newCategory = null;

            // "Thank you for applying" → APPLIED_CONFIRMATION
            if (/thank you for applying/i.test(subject)) {
                newCategory = 'APPLIED_CONFIRMATION';
            }

            // LinkedIn job alert format: "query": Title at Company and more
            if (/^".+":\s+/i.test(subject) && /and more/i.test(subject)) {
                newCategory = 'OTHER';
            }

            // "@ Company" indeed format that's a job listing not an interview
            if (/^[A-Z][\w\s]+@\s+/i.test(subject) && !/interview/i.test(subject)) {
                // "Senior Angular Developer @ Decision Management Solutions" - this is Indeed job listing
                // But only if the subject doesn't mention scheduling or invite
                if (!/schedul|invite|round|shortlist|assess/i.test(subject)) {
                    newCategory = 'RECRUITER_OUTREACH';
                }
            }

            // Check role-based patterns
            for (const pattern of NOT_INTERVIEW_PATTERNS) {
                if (pattern.test(subject)) {
                    newCategory = 'OTHER';
                    break;
                }
            }

            if (newCategory) {
                await client.query('UPDATE emails SET category = $1 WHERE id = $2', [newCategory, email.id]);
                console.log('  [' + email.category + ' -> ' + newCategory + ']: "' + subject.slice(0, 80) + '"');
                emailsFixed++;
            }
        }
        console.log('  Total emails fixed: ' + emailsFixed);

        // ========== STEP 3: Recalculate remaining INTERVIEW job statuses ==========
        console.log('\n3. Recalculating job statuses for remaining INTERVIEW jobs...');

        const STATUS_PRIORITY: Record<string, number> = {
            RECRUITER_OUTREACH: 1,
            APPLIED_CONFIRMATION: 2,
            APPLICATION_VIEWED: 3,
            REJECTED: 4,
            INTERVIEW: 5,
            OFFER: 6,
        };

        const interviewJobs = await client.query(
            "SELECT id, company, role, current_status FROM jobs WHERE current_status = 'INTERVIEW'"
        );

        let jobsFixed = 0;
        for (const job of interviewJobs.rows) {
            const jobEmails = await client.query(
                "SELECT category FROM emails WHERE job_id = $1 AND category NOT IN ('OTHER', 'MISCELLANEOUS', 'UNCERTAIN')",
                [job.id]
            );

            if (jobEmails.rows.length === 0) {
                await client.query("UPDATE jobs SET current_status = 'OTHER' WHERE id = $1", [job.id]);
                console.log('  "' + job.company + ' / ' + job.role + '" -> OTHER (no valid emails)');
                jobsFixed++;
                continue;
            }

            let bestCategory = 'OTHER';
            let bestPriority = 0;
            for (const emailRow of jobEmails.rows) {
                const prio = STATUS_PRIORITY[emailRow.category] || 0;
                if (prio > bestPriority) {
                    bestPriority = prio;
                    bestCategory = emailRow.category;
                }
            }

            if (bestCategory !== job.current_status) {
                await client.query('UPDATE jobs SET current_status = $1 WHERE id = $2', [bestCategory, job.id]);
                console.log('  "' + job.company + ' / ' + job.role + '": ' + job.current_status + ' -> ' + bestCategory);
                jobsFixed++;
            }
        }
        console.log('  Total job statuses corrected: ' + jobsFixed);

        // ========== STEP 4: Fix remaining OFFER jobs ==========
        console.log('\n4. Fixing remaining false OFFER jobs...');

        const offerJobs = await client.query(
            "SELECT id, company, role, current_status FROM jobs WHERE current_status = 'OFFER'"
        );

        let offersFixed = 0;
        for (const job of offerJobs.rows) {
            const roleLower = (job.role || '').toLowerCase();
            const companyLower = (job.company || '').toLowerCase();

            let shouldDowngrade = false;

            // Known false offer patterns
            if (/challenge/i.test(roleLower)) shouldDowngrade = true;           // L'Oréal challenge
            if (/nesternship/i.test(roleLower)) shouldDowngrade = true;         // Nestlé marketing
            if (/training/i.test(roleLower)) shouldDowngrade = true;            // Training programs
            if (/internshala/i.test(companyLower)) shouldDowngrade = true;      // Internshala digest
            if (/dare2compete/i.test(companyLower)) shouldDowngrade = true;     // Competition

            if (shouldDowngrade) {
                // Check if it has emails
                const hasEmails = await client.query(
                    'SELECT COUNT(*)::int as c FROM emails WHERE job_id = $1', [job.id]
                );
                if (hasEmails.rows[0].c === 0) {
                    await client.query('DELETE FROM jobs WHERE id = $1', [job.id]);
                    console.log('  Deleted (orphan): "' + job.company + ' / ' + job.role + '"');
                } else {
                    await client.query("UPDATE jobs SET current_status = 'OTHER' WHERE id = $1", [job.id]);
                    console.log('  Downgraded: "' + job.company + ' / ' + job.role + '" -> OTHER');
                }
                offersFixed++;
            }
        }
        console.log('  Total offers fixed: ' + offersFixed);

        // ========== STEP 5: Final orphan cleanup ==========
        console.log('\n5. Final orphan cleanup...');
        const finalOrphans = await client.query(`
            DELETE FROM jobs
            WHERE id NOT IN (SELECT DISTINCT job_id FROM emails WHERE job_id IS NOT NULL)
            AND current_status IN ('OTHER', 'INTERVIEW', 'OFFER')
            RETURNING id, company, role, current_status
        `);
        console.log('  Deleted ' + finalOrphans.rows.length + ' orphaned OTHER/INTERVIEW/OFFER jobs');

        // ========== SUMMARY ==========
        const finalJobs = await client.query('SELECT current_status, COUNT(*)::int as c FROM jobs GROUP BY current_status ORDER BY c DESC');
        const finalTotal = await client.query('SELECT COUNT(*)::int as c FROM jobs');

        console.log('\n' + '='.repeat(60));
        console.log('  DEEP CLEANUP COMPLETE');
        console.log('-'.repeat(60));
        console.log('  Orphaned INTERVIEW jobs deleted: ' + orphanCount);
        console.log('  Emails reclassified:             ' + emailsFixed);
        console.log('  Job statuses corrected:          ' + jobsFixed);
        console.log('  False OFFER jobs fixed:          ' + offersFixed);
        console.log('  Orphaned OTHER/INT/OFFER deleted: ' + finalOrphans.rows.length);
        console.log('-'.repeat(60));
        console.log('  Final job count: ' + finalTotal.rows[0].c);
        console.log('  Status breakdown:');
        for (const row of finalJobs.rows) {
            console.log('    ' + row.current_status + ': ' + row.c);
        }
        console.log('='.repeat(60) + '\n');

    } finally {
        client.release();
        await pool.end();
    }
}

deepCleanup().catch((err) => {
    console.error('Deep cleanup failed:', err);
    process.exit(1);
});
