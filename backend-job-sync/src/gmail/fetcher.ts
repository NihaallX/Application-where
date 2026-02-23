import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

export interface EmailMessage {
    id: string;
    subject: string;
    from: string;
    body: string;
    date: Date;
}

const GMAIL_SEARCH_QUERY = '("application" OR "interview" OR "regret" OR "hiring" OR "position" OR "career")';
const BATCH_SIZE = 100;

/**
 * Fetch ALL emails from the inbox for backfill.
 * Returns them in batches of 100, using pagination.
 * The onBatch callback receives the page token for resume support.
 * @param afterDate - optional Gmail date string (e.g. '2025/06/01') to limit how far back to scan
 */
export async function fetchAllEmails(
    auth: OAuth2Client,
    processedIds: Set<string>,
    onBatch: (emails: EmailMessage[], pageToken?: string) => Promise<void>,
    afterDate?: string
): Promise<number> {
    const gmail = google.gmail({ version: 'v1', auth });
    let pageToken: string | undefined;
    let totalFetched = 0;

    const query = afterDate ? `after:${afterDate}` : undefined;
    logger.info('Starting full inbox backfill...', { afterDate: afterDate || 'all time', query });

    do {
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: BATCH_SIZE,
            pageToken,
            q: query,
        });

        const messages = response.data.messages || [];
        pageToken = response.data.nextPageToken || undefined;

        if (messages.length === 0) break;

        // Filter out already processed
        const newMessages = messages.filter((m) => m.id && !processedIds.has(m.id));

        if (newMessages.length > 0) {
            const emails = await fetchMessageDetails(gmail, newMessages.map((m) => m.id!));
            await onBatch(emails, pageToken);
            totalFetched += emails.length;
            logger.info(`Backfill progress: ${totalFetched} emails fetched`);
        } else {
            logger.debug(`Skipped batch — all ${messages.length} emails already processed`);
        }

        // Rate limiting - small delay between batches
        await sleep(500);
    } while (pageToken);

    logger.info(`Backfill complete. Total emails fetched: ${totalFetched}`);
    return totalFetched;
}

/**
 * Fetch emails newer than `since` date using the prefilter query.
 */
export async function fetchNewEmails(
    auth: OAuth2Client,
    since: Date,
    processedIds: Set<string>,
    onBatch: (emails: EmailMessage[], pageToken?: string) => Promise<void>
): Promise<number> {
    const gmail = google.gmail({ version: 'v1', auth });
    const afterDate = formatGmailDate(since);
    const query = `${GMAIL_SEARCH_QUERY} after:${afterDate}`;

    let pageToken: string | undefined;
    let totalFetched = 0;

    logger.info(`Fetching new emails since ${since.toISOString()}`, { query });

    do {
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: BATCH_SIZE,
            pageToken,
        });

        const messages = response.data.messages || [];
        pageToken = response.data.nextPageToken || undefined;

        if (messages.length === 0) break;

        const newMessages = messages.filter((m) => m.id && !processedIds.has(m.id));

        if (newMessages.length > 0) {
            const emails = await fetchMessageDetails(gmail, newMessages.map((m) => m.id!));
            await onBatch(emails, pageToken);
            totalFetched += emails.length;
            logger.info(`Sync progress: ${totalFetched} new emails fetched`);
        }

        await sleep(500);
    } while (pageToken);

    logger.info(`Sync complete. Total new emails: ${totalFetched}`);
    return totalFetched;
}

/**
 * Fetch full message details for a batch of message IDs.
 */
async function fetchMessageDetails(
    gmail: gmail_v1.Gmail,
    messageIds: string[]
): Promise<EmailMessage[]> {
    const emails: EmailMessage[] = [];

    for (const id of messageIds) {
        try {
            const msg = await gmail.users.messages.get({
                userId: 'me',
                id,
                format: 'full',
            });

            const headers = msg.data.payload?.headers || [];
            const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
            const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
            const dateStr = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

            const body = extractBody(msg.data.payload);

            // Prefer internalDate (Gmail server-side timestamp, always accurate)
            // Fall back to parsing the Date: header
            let emailDate: Date;
            const internalDateMs = msg.data.internalDate ? parseInt(msg.data.internalDate, 10) : NaN;
            if (!isNaN(internalDateMs) && internalDateMs > 0) {
                emailDate = new Date(internalDateMs);
            } else if (dateStr) {
                const parsed = new Date(dateStr);
                emailDate = isNaN(parsed.getTime()) ? new Date() : parsed;
            } else {
                emailDate = new Date();
            }

            emails.push({
                id,
                subject,
                from,
                body: body.slice(0, 2000),
                date: emailDate,
            });
        } catch (err: any) {
            logger.warn(`Failed to fetch message ${id}`, { error: err.message });
        }

        // Small delay to avoid rate limits
        await sleep(100);
    }

    return emails;
}

/**
 * Extract the plain text body from a Gmail message payload.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    // Direct body data
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Multipart - try to find text/plain
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
        // Fall back to text/html stripped of tags
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
                const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                return stripHtml(html);
            }
        }
        // Recursive for nested multipart
        for (const part of payload.parts) {
            const nested = extractBody(part);
            if (nested) return nested;
        }
    }

    return '';
}

function stripHtml(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatGmailDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
