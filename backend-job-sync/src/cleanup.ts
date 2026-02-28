/**
 * Cleanup script — fixes misclassified jobs in the database.
 *
 * Usage: npx tsx src/cleanup.ts
 *
 * What it does:
 * 1. Reclassifies INTERVIEW jobs that are actually job digests/alerts → OTHER
 * 2. Reclassifies OFFER jobs that are actually program marketing → OTHER
 * 3. Reclassifies "Hiring ||" recruiter threads misclassified as INTERVIEW → RECRUITER_OUTREACH
 * 4. Deletes jobs where company starts with "Via " (portal digests)
 * 5. Merges duplicate jobs (same normalized company+role)
 * 6. Deletes orphaned jobs (no linked emails)
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

// --- Patterns for emails that should NOT be INTERVIEW ---
const NOT_INTERVIEW_SUBJECT_PATTERNS = [
    /new job:.+and \d+ more match/i,           // Wellfound digest
    /^apply to jobs at /i,                       // Indeed digest
    /^".+":\s+.+and more$/i,                     // LinkedIn job alert
    /top internships? of the week/i,             // Internshala digest
    /\d+\+?\s+new internships? for\b/i,          // Internshala batch
    /matching your profile/i,                     // Portal digest
    /\d+\s+new jobs?\s+(for|matching)\b/i,       // Generic job alert
    /job alert/i,                                 // Generic job alert
    /^(urgent\s+)?hiring\s*\|{1,2}/i,            // Recruiter spam
    /^re:\s*(urgent\s+)?hiring\s*[|│]/i,         // Recruiter reply chains
    /internship program/i,                        // Program marketing
    /virtual internship/i,                        // Virtual program
    /challenge\s+\d{4}/i,                         // Competition
    /hackathon/i,                                 // Hackathon
    /fellowship.*program/i,                       // Fellowship program
    /orientation/i,                                // Training orientation
    /training/i,                                   // Training program
    /grab.*hack/i,                                // Hackathon
    /nesternship/i,                                // Nestlé marketing
];

// --- Patterns for emails that should NOT be OFFER ---
const NOT_OFFER_SUBJECT_PATTERNS = [
    /^(urgent\s+)?hiring\s*\|{1,2}/i,            // Recruiter outreach
    /^re:\s*(urgent\s+)?hiring\s*[|│]/i,         // Recruiter reply
    /internship program/i,                        // Program marketing
    /virtual internship/i,                        // Virtual program
    /challenge\s+\d{4}/i,                         // Competition
    /hackathon/i,                                 // Hackathon
    /top internships? of the week/i,             // Digest
    /matching your profile/i,                     // Digest
    /training/i,                                   // Training
    /nesternship/i,                                // Marketing
];

// Decide what a misclassified email should become
function getCorrectCategory(subject: string, currentCategory: string): string | null {
    const s = subject.trim();

    // Job digests → OTHER
    if (/new job:.+and \d+ more match/i.test(s)) return 'OTHER';
    if (/^apply to jobs at /i.test(s)) return 'OTHER';
    if (/^".+":\s+.+and more$/i.test(s)) return 'OTHER';
    if (/top internships? of the week/i.test(s)) return 'OTHER';
    if (/\d+\+?\s+new internships? for\b/i.test(s)) return 'OTHER';
    if (/matching your profile/i.test(s)) return 'OTHER';
    if (/\d+\s+new jobs?\s+(for|matching)\b/i.test(s)) return 'OTHER';
    if (/job alert/i.test(s)) return 'OTHER';
    if (/internship program/i.test(s)) return 'OTHER';
    if (/virtual internship/i.test(s)) return 'OTHER';
    if (/challenge\s+\d{4}/i.test(s)) return 'OTHER';
    if (/hackathon/i.test(s)) return 'OTHER';
    if (/fellowship.*program/i.test(s)) return 'OTHER';
    if (/orientation/i.test(s)) return 'OTHER';
    if (/nesternship/i.test(s)) return 'OTHER';

    // Recruiter outreach patterns → RECRUITER_OUTREACH
    if (/^(urgent\s+)?hiring\s*\|{1,2}/i.test(s)) return 'RECRUITER_OUTREACH';
    if (/^re:\s*(urgent\s+)?hiring\s*[|│]/i.test(s)) return 'RECRUITER_OUTREACH';

    return null; // No correction
}

function normalizeCompany(name: string): string {
    return name
        .toLowerCase()
        .replace(/\b(pvt\.?\s*ltd\.?|private\s*limited|inc\.?|llc|ltd\.?|co\.?|corp\.?|corporation|limited|technologies|tech|solutions|software|services|consulting|group)\b/gi, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[.,\-_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeRole(role: string): string {
    return role
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/artificial intelligence/gi, 'ai')
        .replace(/machine learning/gi, 'ml')
        .replace(/\binternship\b/gi, 'intern')
        .replace(/\bsoftware engineer\b/gi, 'swe')
        .replace(/\bsoftware developer\b/gi, 'swe')
        .replace(/[.,\-_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isSimilar(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.length === 0 || b.length === 0) return false;
    if (a.includes(b) || b.includes(a)) return true;
    return false;
}

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('\n' + '='.repeat(60));
        console.log('  DATABASE CLEANUP — CLASSIFICATION FIX');
        console.log('='.repeat(60));

        let emailsFixed = 0;
        let jobsDowngraded = 0;

        // ========== STEP 1: Fix misclassified emails ==========
        console.log('\n1. Fixing misclassified emails...');

        // Get all emails that are INTERVIEW or OFFER
        const suspectEmails = await client.query(
            `SELECT id, subject, category, confidence, job_id FROM emails
             WHERE category IN ('INTERVIEW', 'OFFER')`
        );

        const emailUpdates: { id: string; newCategory: string; subject: string }[] = [];

        for (const email of suspectEmails.rows) {
            const corrected = getCorrectCategory(email.subject, email.category);
            if (corrected && corrected !== email.category) {
                emailUpdates.push({
                    id: email.id,
                    newCategory: corrected,
                    subject: email.subject,
                });
            }
        }

        if (emailUpdates.length > 0) {
            console.log(`  Found ${emailUpdates.length} misclassified emails:`);
            for (const upd of emailUpdates) {
                console.log(`    ${upd.subject.slice(0, 80)}`);
                console.log(`      -> was INTERVIEW/OFFER, now ${upd.newCategory}`);
                await client.query(
                    'UPDATE emails SET category = $1 WHERE id = $2',
                    [upd.newCategory, upd.id]
                );
                emailsFixed++;
            }
        } else {
            console.log('  No misclassified emails found');
        }

        // ========== STEP 2: Recalculate job statuses from their emails ==========
        console.log('\n2. Recalculating job statuses from corrected emails...');

        const STATUS_PRIORITY: Record<string, number> = {
            RECRUITER_OUTREACH: 1,
            APPLIED_CONFIRMATION: 2,
            APPLICATION_VIEWED: 3,
            REJECTED: 4,
            INTERVIEW: 5,
            OFFER: 6,
        };

        // Get all jobs that had INTERVIEW or OFFER status
        const suspectJobs = await client.query(
            `SELECT id, company, role, current_status FROM jobs
             WHERE current_status IN ('INTERVIEW', 'OFFER')`
        );

        for (const job of suspectJobs.rows) {
            // Find the highest-priority email category for this job
            const jobEmails = await client.query(
                `SELECT category FROM emails WHERE job_id = $1 AND category NOT IN ('OTHER', 'MISCELLANEOUS', 'UNCERTAIN')`,
                [job.id]
            );

            if (jobEmails.rows.length === 0) {
                // No non-OTHER emails → this job should be OTHER
                await client.query('UPDATE jobs SET current_status = $1 WHERE id = $2', ['OTHER', job.id]);
                console.log(`  "${job.company} / ${job.role}" -> OTHER (no valid emails)`);
                jobsDowngraded++;
                continue;
            }

            // Find the highest priority category among remaining emails
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
                console.log(`  "${job.company} / ${job.role}": ${job.current_status} -> ${bestCategory}`);
                jobsDowngraded++;
            }
        }

        if (jobsDowngraded === 0) {
            console.log('  No job status corrections needed');
        }

        // ========== STEP 3: Remove "Via " portal digest jobs ==========
        console.log('\n3. Removing portal digest jobs (company starts with "Via ")...');

        const portalJobs = await client.query(
            `SELECT id, company, role FROM jobs WHERE company LIKE 'Via %'`
        );

        let portalDeleted = 0;
        for (const job of portalJobs.rows) {
            // Delete associated emails first
            await client.query('DELETE FROM emails WHERE job_id = $1', [job.id]);
            await client.query('DELETE FROM jobs WHERE id = $1', [job.id]);
            console.log(`  Deleted: "${job.company} / ${job.role}"`);
            portalDeleted++;
        }

        if (portalDeleted === 0) {
            console.log('  No portal digest jobs found');
        }

        // ========== STEP 4: Merge duplicate jobs ==========
        console.log('\n4. Merging duplicate jobs...');

        const allJobs = await client.query(
            'SELECT * FROM jobs ORDER BY first_email_date ASC'
        );

        const groups = new Map<string, any[]>();
        for (const job of allJobs.rows) {
            const key = `${normalizeCompany(job.company)}::${normalizeRole(job.role)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(job);
        }

        let mergedCount = 0;
        const deletedJobIds: string[] = [];

        for (const [key, jobs] of groups) {
            if (jobs.length <= 1) continue;

            const keeper = jobs[0];
            const dupes = jobs.slice(1);

            console.log(`  Merging "${key}" — keeping "${keeper.company} / ${keeper.role}"`);
            for (const dupe of dupes) {
                console.log(`    Removing "${dupe.company} / ${dupe.role}"`);
                await client.query('UPDATE emails SET job_id = $1 WHERE job_id = $2', [keeper.id, dupe.id]);
                deletedJobIds.push(dupe.id);
                mergedCount++;
            }
        }

        if (deletedJobIds.length > 0) {
            await client.query(`DELETE FROM jobs WHERE id = ANY($1::uuid[])`, [deletedJobIds]);
        }

        if (mergedCount === 0) {
            console.log('  No duplicates found');
        }

        // ========== STEP 5: Remove orphaned jobs ==========
        console.log('\n5. Removing orphaned jobs...');

        const orphanResult = await client.query(`
            DELETE FROM jobs
            WHERE id NOT IN (SELECT DISTINCT job_id FROM emails WHERE job_id IS NOT NULL)
            RETURNING id, company, role
        `);

        if (orphanResult.rows.length > 0) {
            for (const j of orphanResult.rows) {
                console.log(`  Deleted: "${j.company} / ${j.role}"`);
            }
        } else {
            console.log('  No orphans found');
        }

        // ========== SUMMARY ==========
        const finalJobs = await client.query('SELECT current_status, COUNT(*)::int as c FROM jobs GROUP BY current_status ORDER BY c DESC');
        const finalTotal = await client.query('SELECT COUNT(*)::int as c FROM jobs');
        const finalEmails = await client.query('SELECT COUNT(*)::int as c FROM emails');

        console.log('\n' + '='.repeat(60));
        console.log('  CLEANUP COMPLETE');
        console.log('-'.repeat(60));
        console.log(`  Emails reclassified:     ${emailsFixed}`);
        console.log(`  Jobs status corrected:   ${jobsDowngraded}`);
        console.log(`  Portal digest jobs deleted: ${portalDeleted}`);
        console.log(`  Duplicate jobs merged:   ${mergedCount}`);
        console.log(`  Orphaned jobs removed:   ${orphanResult.rows.length}`);
        console.log('-'.repeat(60));
        console.log(`  Final job count:         ${finalTotal.rows[0].c}`);
        console.log(`  Final email count:       ${finalEmails.rows[0].c}`);
        console.log('  Status breakdown:');
        for (const row of finalJobs.rows) {
            console.log(`    ${row.current_status}: ${row.c}`);
        }
        console.log('='.repeat(60) + '\n');

    } finally {
        client.release();
        await pool.end();
    }
}

cleanup().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
