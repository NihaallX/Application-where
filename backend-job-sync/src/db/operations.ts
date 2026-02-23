import { query } from './neon';
import { ClassificationResult } from '../classifier/groq';
import { EmailMessage } from '../gmail/fetcher';
import { logger } from '../utils/logger';

/**
 * Status priority for evolution logic.
 * Higher number = higher priority.
 */
const STATUS_PRIORITY: Record<string, number> = {
    RECRUITER_OUTREACH: 1,
    APPLICATION_VIEWED: 2,
    APPLIED_CONFIRMATION: 3,
    REJECTED: 4,
    INTERVIEW: 5,
    OFFER: 6,
};

/**
 * Normalize a company name for comparison.
 * Strips suffixes like "Pvt. Ltd.", "Inc.", "(India)" etc.
 */
function normalizeCompany(name: string): string {
    return name
        .toLowerCase()
        .replace(/\b(pvt\.?\s*ltd\.?|private\s*limited|inc\.?|llc|ltd\.?|co\.?|corp\.?|corporation|limited|technologies|tech|solutions|software|services|consulting|group)\b/gi, '')
        .replace(/\(.*?\)/g, '')        // Remove parenthetical text like "(India)"
        .replace(/[.,\-_]+/g, '')       // Remove punctuation
        .replace(/\s+/g, ' ')           // Normalize spaces
        .trim();
}

/**
 * Normalize a role/title for comparison.
 * Handles variations like "AI Intern" vs "Artificial Intelligence (AI) Intern"
 */
function normalizeRole(role: string): string {
    return role
        .toLowerCase()
        .replace(/\(.*?\)/g, '')              // Remove parenthetical
        .replace(/artificial intelligence/gi, 'ai')
        .replace(/machine learning/gi, 'ml')
        .replace(/\binternship\b/gi, 'intern')
        .replace(/\bsoftware engineer\b/gi, 'swe')
        .replace(/\bsoftware developer\b/gi, 'swe')
        .replace(/\bdata scientist\b/gi, 'ds')
        .replace(/\bdata analyst\b/gi, 'da')
        .replace(/\bfull[\s-]?stack\b/gi, 'fullstack')
        .replace(/\bfront[\s-]?end\b/gi, 'frontend')
        .replace(/\bback[\s-]?end\b/gi, 'backend')
        .replace(/[.,\-_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if two normalized strings are similar enough to be the same entity.
 * Uses containment check: if one is a substring of the other, they match.
 */
function isSimilar(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.length === 0 || b.length === 0) return false;
    // One contains the other
    if (a.includes(b) || b.includes(a)) return true;
    return false;
}

/**
 * Get all processed Gmail IDs from the database.
 */
export async function getProcessedGmailIds(): Promise<Set<string>> {
    const result = await query('SELECT gmail_id FROM emails');
    return new Set(result.rows.map((r: any) => r.gmail_id));
}

/**
 * Get the date of the most recently processed email.
 */
export async function getLastProcessedDate(): Promise<Date | null> {
    const result = await query('SELECT MAX(email_date) as last_date FROM emails');
    const row = result.rows[0];
    return row?.last_date ? new Date(row.last_date) : null;
}

/**
 * Find an existing job by fuzzy company + role matching.
 * Uses normalized names to handle variations like "UrbanRoof" vs "UrbanRoof Pvt. Ltd."
 */
async function findExistingJob(company: string, role: string): Promise<any | null> {
    if (!company || !role) return null;

    const normCompany = normalizeCompany(company);
    const normRole = normalizeRole(role);

    if (!normCompany) return null;

    // Aggregator companies (Via Indeed, Via LinkedIn, etc.) — only exact role match
    // to avoid accidentally merging two distinct jobs applied through the same portal
    const aggregators = ['via indeed', 'via linkedin', 'via internshala', 'manually applied', 'via glassdoor', 'via naukri'];
    const isAggregator = aggregators.includes(company.toLowerCase());

    // First try exact match (fast)
    const exactResult = await query(
        'SELECT * FROM jobs WHERE LOWER(company) = LOWER($1) AND LOWER(role) = LOWER($2) LIMIT 1',
        [company, role]
    );
    if (exactResult.rows[0]) return exactResult.rows[0];

    // Aggregators: don't fuzzy match — two "Via Indeed" jobs with different (but similar) roles
    // are genuinely separate applications
    if (isAggregator) return null;

    // Then try fuzzy match on company — fetch all jobs for similar company names
    const fuzzyResult = await query(
        'SELECT * FROM jobs WHERE LOWER(company) LIKE $1 OR LOWER(company) LIKE $2',
        [`%${normCompany}%`, `${normCompany}%`]
    );

    for (const row of fuzzyResult.rows) {
        const rowCompany = normalizeCompany(row.company);
        const rowRole = normalizeRole(row.role);

        if (isSimilar(rowCompany, normCompany) && isSimilar(rowRole, normRole)) {
            logger.debug('Fuzzy matched existing job', {
                input: `${company} / ${role}`,
                matched: `${row.company} / ${row.role}`,
                jobId: row.id,
            });
            return row;
        }
    }

    return null;
}

/**
 * Determine if the new status should override the current status
 * based on priority ordering.
 */
function shouldUpdateStatus(currentStatus: string, newCategory: string): boolean {
    const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
    const newPriority = STATUS_PRIORITY[newCategory] || 0;
    return newPriority > currentPriority;
}

/**
 * Upsert a job: find by company+role (fuzzy), update if higher priority status, or create new.
 * Returns the job ID.
 */
export async function upsertJob(
    classification: ClassificationResult,
    emailDate: Date
): Promise<string> {
    const existing = await findExistingJob(classification.company, classification.role);

    if (existing) {
        const updates: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        // Update status if new category has higher priority
        if (shouldUpdateStatus(existing.current_status, classification.category)) {
            updates.push(`current_status = $${paramIdx++}`);
            params.push(classification.category);
        }

        // Always update last_update_date
        updates.push(`last_update_date = $${paramIdx++}`);
        params.push(emailDate);

        // Update interview_date if available
        if (classification.interview_date) {
            try {
                const interviewDate = new Date(classification.interview_date);
                if (!isNaN(interviewDate.getTime())) {
                    updates.push(`interview_date = $${paramIdx++}`);
                    params.push(interviewDate);
                }
            } catch {
                // Invalid date, skip
            }
        }

        // Update source_platform if currently empty
        if (!existing.source_platform && classification.source_platform) {
            updates.push(`source_platform = $${paramIdx++}`);
            params.push(classification.source_platform);
        }

        // Update work_mode if currently UNKNOWN
        if (existing.work_mode === 'UNKNOWN' && classification.work_mode !== 'UNKNOWN') {
            updates.push(`work_mode = $${paramIdx++}`);
            params.push(classification.work_mode);
        }

        // Update job_type if currently UNKNOWN
        if (existing.job_type === 'UNKNOWN' && classification.job_type !== 'UNKNOWN') {
            updates.push(`job_type = $${paramIdx++}`);
            params.push(classification.job_type);
        }

        if (updates.length > 0) {
            params.push(existing.id);
            await query(
                `UPDATE jobs SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
                params
            );
            logger.debug('Updated existing job', { jobId: existing.id, company: classification.company, role: classification.role });
        }

        return existing.id;
    }

    // Create new job
    const result = await query(
        `INSERT INTO jobs (company, role, source_platform, job_type, work_mode, current_status, first_email_date, last_update_date, interview_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
        [
            classification.company || 'Unknown Company',
            classification.role || 'Unknown Role',
            classification.source_platform || '',
            classification.job_type,
            classification.work_mode,
            classification.category,
            emailDate,
            emailDate,
            classification.interview_date ? new Date(classification.interview_date) : null,
        ]
    );

    const jobId = result.rows[0].id;
    logger.info('Created new job', { jobId, company: classification.company, role: classification.role, status: classification.category });
    return jobId;
}

/**
 * Insert an email record. Skips if gmail_id already exists.
 */
export async function insertEmail(
    email: EmailMessage,
    jobId: string,
    classification: ClassificationResult
): Promise<boolean> {
    try {
        await query(
            `INSERT INTO emails (gmail_id, job_id, category, confidence, email_date, subject, body_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (gmail_id) DO NOTHING`,
            [
                email.id,
                jobId,
                classification.confidence < 0.6 ? 'UNCERTAIN' : classification.category,
                classification.confidence,
                email.date,
                email.subject,
                email.body.slice(0, 2000),
            ]
        );
        return true;
    } catch (err: any) {
        logger.error('Failed to insert email', { gmailId: email.id, error: err.message });
        return false;
    }
}

/**
 * Get summary stats from the database.
 */
export async function getStats(): Promise<Record<string, number>> {
    const jobsResult = await query(`
    SELECT current_status, COUNT(*)::int as count FROM jobs GROUP BY current_status
  `);
    const emailsResult = await query('SELECT COUNT(*)::int as count FROM emails');

    const stats: Record<string, number> = {
        total_jobs: 0,
        total_emails: emailsResult.rows[0]?.count || 0,
    };

    for (const row of jobsResult.rows) {
        stats[row.current_status] = row.count;
        stats.total_jobs += row.count;
    }

    return stats;
}
