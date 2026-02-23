/**
 * Cleanup script — removes duplicate jobs and LinkedIn social noise from the DB.
 *
 * Usage: npx tsx src/cleanup.ts
 *
 * What it does:
 * 1. Finds duplicate jobs (same normalized company+role) and merges them into one
 * 2. Deletes emails classified as UNCERTAIN with confidence < 0.3 from LinkedIn social notifications
 * 3. Deletes orphaned jobs (jobs with no remaining linked emails)
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

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

const LINKEDIN_SOCIAL_SUBJECTS = [
    /accepted your invitation/i,
    /wants? to connect/i,
    /I'd like to (add|join|connect)/i,
    /your posts? reached/i,
    /connection request/i,
    /thanks for being a valued member/i,
    /your profile (photo|was changed|appeared)/i,
    /people viewed your profile/i,
    /invitation to connect/i,
    /sent you a connection/i,
    /I still want to connect/i,
    /I want to connect/i,
    /explore their network/i,
    /I've sent you a connection/i,
    /endorsed you/i,
    /mentioned you/i,
    /commented on/i,
    /liked your/i,
    /shared a post/i,
];

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('\n' + '='.repeat(60));
        console.log('  DATABASE CLEANUP');
        console.log('='.repeat(60));

        // ========== STEP 1: Remove LinkedIn social noise emails ==========
        console.log('\n📧 Step 1: Removing LinkedIn social notification emails...');

        const allEmails = await client.query('SELECT id, subject, category, confidence FROM emails');
        const linkedinNoiseIds: string[] = [];

        for (const email of allEmails.rows) {
            // Low confidence + matches social pattern
            if (email.confidence < 0.3) {
                for (const pattern of LINKEDIN_SOCIAL_SUBJECTS) {
                    if (pattern.test(email.subject)) {
                        linkedinNoiseIds.push(email.id);
                        break;
                    }
                }
            }
        }

        if (linkedinNoiseIds.length > 0) {
            console.log(`  Found ${linkedinNoiseIds.length} LinkedIn social emails to remove:`);
            for (const id of linkedinNoiseIds) {
                const email = allEmails.rows.find(e => e.id === id);
                console.log(`    ❌ "${email?.subject}"`);
            }

            await client.query(
                `DELETE FROM emails WHERE id = ANY($1::uuid[])`,
                [linkedinNoiseIds]
            );
            console.log(`  ✅ Deleted ${linkedinNoiseIds.length} LinkedIn noise emails`);
        } else {
            console.log('  ✅ No LinkedIn noise emails found');
        }

        // ========== STEP 2: Merge duplicate jobs ==========
        console.log('\n🔄 Step 2: Finding and merging duplicate jobs...');

        const allJobs = await client.query(
            'SELECT * FROM jobs ORDER BY first_email_date ASC'
        );

        // Group by normalized company+role
        const groups = new Map<string, any[]>();
        for (const job of allJobs.rows) {
            const key = `${normalizeCompany(job.company)}::${normalizeRole(job.role)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(job);
        }

        let mergedCount = 0;
        let deletedJobIds: string[] = [];

        for (const [key, jobs] of groups) {
            if (jobs.length <= 1) continue;

            // Keep the first (oldest) job, merge others into it
            const keeper = jobs[0];
            const dupes = jobs.slice(1);

            console.log(`  Merging "${key}" — keeping "${keeper.company} / ${keeper.role}" (${keeper.id})`);
            for (const dupe of dupes) {
                console.log(`    ❌ Removing "${dupe.company} / ${dupe.role}" (${dupe.id})`);

                // Reassign emails from dupe to keeper
                await client.query(
                    'UPDATE emails SET job_id = $1 WHERE job_id = $2',
                    [keeper.id, dupe.id]
                );

                deletedJobIds.push(dupe.id);
                mergedCount++;
            }
        }

        if (deletedJobIds.length > 0) {
            await client.query(
                `DELETE FROM jobs WHERE id = ANY($1::uuid[])`,
                [deletedJobIds]
            );
            console.log(`  ✅ Merged ${mergedCount} duplicate jobs (reassigned their emails)`);
        } else {
            console.log('  ✅ No duplicate jobs found');
        }

        // ========== STEP 3: Remove orphaned jobs ==========
        console.log('\n🗑️  Step 3: Removing orphaned jobs (no emails linked)...');

        const orphanResult = await client.query(`
            DELETE FROM jobs 
            WHERE id NOT IN (SELECT DISTINCT job_id FROM emails WHERE job_id IS NOT NULL)
            RETURNING id, company, role
        `);

        if (orphanResult.rows.length > 0) {
            console.log(`  Found ${orphanResult.rows.length} orphaned jobs:`);
            for (const j of orphanResult.rows) {
                console.log(`    ❌ "${j.company} / ${j.role}" (${j.id})`);
            }
            console.log(`  ✅ Deleted ${orphanResult.rows.length} orphaned jobs`);
        } else {
            console.log('  ✅ No orphaned jobs found');
        }

        // ========== SUMMARY ==========
        const finalJobs = await client.query('SELECT COUNT(*)::int as c FROM jobs');
        const finalEmails = await client.query('SELECT COUNT(*)::int as c FROM emails');

        console.log('\n' + '='.repeat(60));
        console.log('  CLEANUP COMPLETE');
        console.log('─'.repeat(60));
        console.log(`  LinkedIn noise removed:  ${linkedinNoiseIds.length} emails`);
        console.log(`  Duplicate jobs merged:   ${mergedCount}`);
        console.log(`  Orphaned jobs removed:   ${orphanResult.rows.length}`);
        console.log('─'.repeat(60));
        console.log(`  Remaining jobs:          ${finalJobs.rows[0].c}`);
        console.log(`  Remaining emails:        ${finalEmails.rows[0].c}`);
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
