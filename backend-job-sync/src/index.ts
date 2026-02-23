import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { getAuthenticatedClient } from './gmail/auth';
import { fetchAllEmails, fetchNewEmails, EmailMessage } from './gmail/fetcher';
import { isJobRelated } from './classifier/prefilter';
import { classifyEmail, ClassificationResult, isAllKeysExhausted } from './classifier/groq';
import { initializeSchema } from './db/schema';
import { getProcessedGmailIds, getLastProcessedDate, upsertJob, insertEmail, getStats, loadResumeStateFromDB, saveResumeStateToDB, clearResumeStateFromDB } from './db/operations';
import { closePool } from './db/neon';
import { logger, initSyncStatus, updateSyncStatus, clearLogFile } from './utils/logger';

const args = process.argv.slice(2);
const isBackfill = args.includes('--backfill');
const isSync = args.includes('--sync');

// --- Resume state ---
const LOGS_DIR = path.join(process.cwd(), 'logs');
const RESUME_FILE = path.join(LOGS_DIR, 'resume-state.json');

interface ResumeState {
    mode: string;
    last_page_token: string;
    emails_processed: number;
    updated_at: string;
}

async function loadResumeState(): Promise<ResumeState | null> {
    const mode = isBackfill ? 'backfill' : 'sync';
    // 1. Try DB first (works in GitHub Actions and locally)
    try {
        const dbState = await loadResumeStateFromDB(mode);
        if (dbState) {
            logger.info('Resumed from DB state', { processedSoFar: dbState.emails_processed, updatedAt: dbState.updated_at });
            return dbState;
        }
    } catch { /* fall through to file */ }
    // 2. Fall back to local file (backwards compat for existing local runs)
    try {
        if (fs.existsSync(RESUME_FILE)) {
            const data = JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8'));
            if (data.mode === mode) {
                logger.info('Resumed from local file state', { processedSoFar: data.emails_processed, updatedAt: data.updated_at });
                return data;
            }
        }
    } catch { /* ignore */ }
    return null;
}

async function saveResumeState(pageToken: string, emailsProcessed: number): Promise<void> {
    const mode = isBackfill ? 'backfill' : 'sync';
    // Write to DB (for GitHub Actions)
    await saveResumeStateToDB(mode, pageToken, emailsProcessed);
    // Also write local file (for Task Scheduler watcher + Monitor page)
    try {
        if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
        const state: ResumeState = {
            mode,
            last_page_token: pageToken,
            emails_processed: emailsProcessed,
            updated_at: new Date().toISOString(),
        };
        fs.writeFileSync(RESUME_FILE, JSON.stringify(state, null, 2));
    } catch { /* ignore */ }
}

async function clearResumeState(): Promise<void> {
    const mode = isBackfill ? 'backfill' : 'sync';
    await clearResumeStateFromDB(mode);
    try { if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE); } catch { /* ignore */ }
}

// --- Graceful shutdown ---
let isShuttingDown = false;

function setupGracefulShutdown(cleanup: () => Promise<void>): void {
    const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        logger.info(`Received ${signal} — saving progress and shutting down gracefully...`);
        updateSyncStatus({ is_running: false });
        await cleanup();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main() {
    const startTime = Date.now();
    const mode = isBackfill ? 'backfill' : 'sync';

    // Initialize status tracker and clear old logs
    clearLogFile();
    initSyncStatus(mode);

    // Check for resume state
    const resumeState = await loadResumeState();
    if (resumeState) {
        logger.info(`Resuming from previous run — ${resumeState.emails_processed} emails already processed`);
    }

    logger.info('Job Email Classifier starting...', { mode: mode.toUpperCase() });

    // Setup graceful shutdown
    setupGracefulShutdown(async () => {
        await closePool();
    });

    try {
        // Initialize database
        await initializeSchema();

        // Authenticate with Gmail
        const auth = await getAuthenticatedClient();

        // Get already processed IDs
        const processedIds = await getProcessedGmailIds();
        logger.info(`Found ${processedIds.size} already processed emails in database`);

        let totalProcessed = 0;
        let totalClassified = 0;
        let totalJobRelated = 0;
        let totalFailed = 0;
        let jobsCreated = 0;
        let batchNum = 0;
        let lastPageToken = '';

        const processBatch = async (emails: EmailMessage[], pageToken?: string) => {
            batchNum++;

            // Save resume state after each batch
            if (pageToken) {
                lastPageToken = pageToken;
                await saveResumeState(pageToken, totalProcessed);
            }

            updateSyncStatus({
                current_batch: batchNum,
                emails_fetched: totalProcessed + emails.length,
            });

            for (const email of emails) {
                // Check for shutdown request
                if (isShuttingDown) {
                    logger.info('Shutdown requested, stopping classification...');
                    return;
                }

                totalProcessed++;

                // Phase 1: Heuristic prefilter
                if (!isJobRelated(email)) {
                    updateSyncStatus({ emails_skipped: totalProcessed - totalJobRelated });
                    continue;
                }
                totalJobRelated++;

                // Phase 2: Groq LLM classification
                const classification = await classifyEmail(email);
                if (!classification) {
                    totalFailed++;
                    updateSyncStatus({ errors: totalFailed });
                    logger.warn('Classification failed, skipping', { gmailId: email.id, subject: email.subject });
                    // All Groq keys are daily-exhausted — save progress and exit cleanly
                    if (isAllKeysExhausted()) {
                        logger.info('All Groq API keys exhausted for today. Progress saved. Cron will resume tomorrow.');
                        updateSyncStatus({ is_running: false });
                        process.emit('SIGTERM' as any);
                        return;
                    }
                    continue;
                }

                // Skip if classified as OTHER with high confidence
                if (classification.category === 'OTHER' && classification.confidence > 0.8) {
                    continue;
                }

                totalClassified++;

                // Upsert job and insert email
                try {
                    const jobId = await upsertJob(classification, email.date);
                    await insertEmail(email, jobId, classification);
                    jobsCreated++;
                } catch (err: any) {
                    logger.error('DB write failed', { gmailId: email.id, error: err.message });
                    totalFailed++;
                }

                // Update status after each classified email
                updateSyncStatus({
                    emails_fetched: totalProcessed,
                    emails_classified: totalClassified,
                    emails_skipped: totalProcessed - totalJobRelated,
                    jobs_created: jobsCreated,
                    errors: totalFailed,
                });

                // Log progress every 10 classified emails
                if (totalClassified % 10 === 0) {
                    logger.info('Progress update', {
                        processed: totalProcessed,
                        jobRelated: totalJobRelated,
                        classified: totalClassified,
                        failed: totalFailed,
                    });
                }
            }
        };

        if (isBackfill) {
            logger.info(`Running FULL BACKFILL — scanning emails after ${config.backfillAfterDate}`);
            await fetchAllEmails(auth, processedIds, processBatch, config.backfillAfterDate);
        } else {
            const lastDate = await getLastProcessedDate();
            const since = lastDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            logger.info(`Running SYNC — fetching emails since ${since.toISOString()}`);
            await fetchNewEmails(auth, since, processedIds, processBatch);
        }

        // Run complete — clear resume state
        await clearResumeState();

        // Print summary
        const stats = await getStats();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        updateSyncStatus({
            is_running: false,
            emails_fetched: totalProcessed,
            emails_classified: totalClassified,
            emails_skipped: totalProcessed - totalJobRelated,
            jobs_created: jobsCreated,
            errors: totalFailed,
        });

        console.log('\n' + '='.repeat(60));
        console.log('  JOB EMAIL CLASSIFIER — RUN COMPLETE');
        console.log('='.repeat(60));
        console.log(`  Mode:              ${isBackfill ? 'BACKFILL' : 'SYNC'}`);
        console.log(`  Elapsed:           ${elapsed}s`);
        console.log(`  Emails Scanned:    ${totalProcessed}`);
        console.log(`  Passed Prefilter:  ${totalJobRelated}`);
        console.log(`  Classified:        ${totalClassified}`);
        console.log(`  Failed:            ${totalFailed}`);
        console.log('─'.repeat(60));
        console.log(`  Total Jobs in DB:  ${stats.total_jobs}`);
        console.log(`  Total Emails:      ${stats.total_emails}`);
        if (stats.APPLIED_CONFIRMATION) console.log(`  Applied:           ${stats.APPLIED_CONFIRMATION}`);
        if (stats.INTERVIEW) console.log(`  Interviews:        ${stats.INTERVIEW}`);
        if (stats.REJECTED) console.log(`  Rejected:          ${stats.REJECTED}`);
        if (stats.OFFER) console.log(`  Offers:            ${stats.OFFER}`);
        if (stats.RECRUITER_OUTREACH) console.log(`  Recruiter:         ${stats.RECRUITER_OUTREACH}`);
        console.log('='.repeat(60) + '\n');

        logger.info('Run complete', {
            elapsed: `${elapsed}s`,
            totalProcessed,
            totalClassified,
            totalFailed,
            dbJobs: stats.total_jobs,
            dbEmails: stats.total_emails,
        });

    } catch (err: any) {
        updateSyncStatus({ is_running: false, last_error: err.message });
        logger.error('Fatal error', { error: err.message, stack: err.stack });
        process.exit(1);
    } finally {
        await closePool();
    }
}

main();
