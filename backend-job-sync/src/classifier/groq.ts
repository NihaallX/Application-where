import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { config } from '../config';
import { logger, trackGroqRequest, trackKeyRotation, trackKeyRateLimit, trackGroqTokens } from '../utils/logger';
import { EmailMessage } from '../gmail/fetcher';

export interface ClassificationResult {
    category: 'APPLIED_CONFIRMATION' | 'REJECTED' | 'INTERVIEW' | 'OFFER' | 'RECRUITER_OUTREACH' | 'APPLICATION_VIEWED' | 'OTHER';
    company: string;
    role: string;
    interview_date: string;
    job_type: 'INTERNSHIP' | 'FULL_TIME' | 'CONTRACT' | 'UNKNOWN';
    work_mode: 'REMOTE' | 'ONSITE' | 'HYBRID' | 'UNKNOWN';
    source_platform: string;
    confidence: number;
}

// --- Key rotation pool ---
const keyPool: string[] = [...config.groq.apiKeys];
let currentKeyIndex = 0;
let groq = new Groq({ apiKey: keyPool[currentKeyIndex] });
const ENV_PATH = path.join(process.cwd(), '.env');

function currentKeyLabel(): string {
    return `key${currentKeyIndex + 1}`;
}

/**
 * Rotate to the next available key. Returns true if a new key is available.
 */
function rotateKey(): boolean {
    const nextIndex = currentKeyIndex + 1;
    if (nextIndex >= keyPool.length) {
        logger.warn('All Groq API keys exhausted — no more keys to rotate to');
        return false;
    }
    currentKeyIndex = nextIndex;
    groq = new Groq({ apiKey: keyPool[currentKeyIndex] });
    trackKeyRotation(currentKeyIndex);
    logger.info(`🔑 Rotated to Groq ${currentKeyLabel()} (${keyPool.length - currentKeyIndex - 1} remaining)`);
    return true;
}

/**
 * Watch .env file for new keys added at runtime and reload the pool.
 */
let lastEnvCheck = 0;
function checkForKeyUpdate(): void {
    const now = Date.now();
    if (now - lastEnvCheck < 10000) return;
    lastEnvCheck = now;

    try {
        if (!fs.existsSync(ENV_PATH)) return;
        const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        const parsed = dotenv.parse(envContent);

        const freshKeys = [
            parsed.GROQ_API_KEY,
            parsed.GROQ_API_KEY_2,
            parsed.GROQ_API_KEY_3,
        ].filter(Boolean) as string[];

        // Add any new keys not already in the pool
        let added = 0;
        for (const k of freshKeys) {
            if (!keyPool.includes(k)) {
                keyPool.push(k);
                added++;
            }
        }
        if (added > 0) {
            logger.info(`🔑 Loaded ${added} new Groq key(s) from .env (pool size: ${keyPool.length})`);
        }
    } catch {
        // Silently ignore read errors
    }
}

const CLASSIFICATION_PROMPT = `You are a job email classifier. Analyze the email and return ONLY a valid JSON object.

{
  "category": "APPLIED_CONFIRMATION | REJECTED | INTERVIEW | OFFER | RECRUITER_OUTREACH | APPLICATION_VIEWED | OTHER",
  "company": "company name",
  "role": "job role/title",
  "interview_date": "ISO date string or empty string",
  "job_type": "INTERNSHIP | FULL_TIME | CONTRACT | UNKNOWN",
  "work_mode": "REMOTE | ONSITE | HYBRID | UNKNOWN",
  "source_platform": "linkedin | naukri | indeed | glassdoor | company_website | email | other",
  "confidence": 0.0 to 1.0
}

CRITICAL — "category" field:
- MUST be exactly one of: APPLIED_CONFIRMATION, REJECTED, INTERVIEW, OFFER, RECRUITER_OUTREACH, APPLICATION_VIEWED, OTHER
- INTERNSHIP is NOT a valid category — it is a job_type value only
- An internship application confirmation → category = "APPLIED_CONFIRMATION", job_type = "INTERNSHIP"
- An internship interview invite → category = "INTERVIEW", job_type = "INTERNSHIP"
- Do NOT use INTERNSHIP, FULL_TIME, CONTRACT, or UNKNOWN as a category value, ever

CRITICAL rules for "company":
- ALWAYS try to identify the company name. NEVER return an empty string for company.
- Extract company from these sources (in priority order):
  1. The email body (e.g. "Thank you for applying to Google", "Your application at Amazon")
  2. The sender name (e.g. "LinkedIn Job Alerts" → look in body for company, "Naukri.com" → look in body for company)
  3. The sender email domain (e.g. "careers@microsoft.com" → "Microsoft", "noreply@stripe.com" → "Stripe")
  4. If a job portal (LinkedIn, Naukri, Indeed) sent the email, the ACTUAL hiring company is in the body, not the portal
- For job portals: the company is the one HIRING, not LinkedIn/Naukri/Indeed themselves
- Capitalize the company name properly (e.g. "Google", not "google")
- If truly impossible to determine, use "Unknown"

Other rules:
- Use APPLICATION_VIEWED when an employer or recruiter has viewed/opened your application, resume, or profile
- For role: extract the specific job title (e.g. "Software Engineer", "Data Analyst Intern")
- confidence reflects how certain you are this is a job-related email
- Return ONLY the JSON object, nothing else`;

// --- Rate limiter for Groq free tier ---
// Each key gets its own timer so we fully utilise all 3 keys in parallel (3× throughput)
const MIN_DELAY_MS = 2100; // ~28 req/min per key (safe below 30 RPM limit)
const lastCallTimes: number[] = [0, 0, 0];

async function throttle(): Promise<void> {
    const now = Date.now();
    const last = lastCallTimes[currentKeyIndex] ?? 0;
    const elapsed = now - last;
    if (elapsed < MIN_DELAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
    }
    lastCallTimes[currentKeyIndex] = Date.now();
}

/**
 * Extract a company name from the sender's email address/name as a fallback.
 */
function extractCompanyFromSender(from: string): string {
    const portalDomains = [
        'linkedin.com', 'naukri.com', 'indeed.com', 'glassdoor.com',
        'monster.com', 'ziprecruiter.com', 'dice.com', 'angel.co',
        'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
        'googlemail.com', 'protonmail.com', 'icloud.com',
    ];

    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    if (emailMatch) {
        const email = emailMatch[1];
        const domain = email.split('@')[1]?.toLowerCase();

        if (domain && !portalDomains.some((p) => domain.includes(p))) {
            const parts = domain.split('.');
            const mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
            if (mainPart && mainPart.length > 2 && mainPart !== 'mail' && mainPart !== 'email') {
                return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
            }
        }
    }

    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) {
        const name = nameMatch[1].trim();
        const genericNames = ['no-reply', 'noreply', 'notifications', 'info', 'admin', 'support', 'careers', 'jobs', 'hiring'];
        if (!genericNames.some((g) => name.toLowerCase().includes(g)) && name.length > 2) {
            return name;
        }
    }

    return '';
}

/**
 * Extract a company name from the email subject line as a fallback.
 * Handles common portal email patterns like Indeed confirmations and job digests.
 */
function extractCompanyFromSubject(subject: string): string {
    const s = subject.trim();

    // Indeed Application: [Role] — company not in subject/body, use portal label
    if (/^indeed application:/i.test(s)) {
        return 'Via Indeed';
    }

    // Indeed alerts: "Apply to jobs at X, Y and Z" — take first named company
    const applyToMatch = s.match(/^apply to jobs at (.+)/i);
    if (applyToMatch) {
        // Split on commas and " and ", return first token
        const first = applyToMatch[1].split(/,|\band\b/i)[0].trim();
        if (first.length > 1) return first;
    }

    // Internshala batch alerts (subject or pattern-based)
    if (/internshala/i.test(s)) return 'Via Internshala';
    if (/\d+\+?\s+new internships? for\b/i.test(s)) return 'Via Internshala';
    if (/your profile is a perfect match for these.*internships/i.test(s)) return 'Via Internshala';

    // LinkedIn job alert — format: "search query": Job Title 1 - Job Title 2
    if (/^"[^"]+"\s*:\s+/i.test(s)) return 'Via LinkedIn';

    // Indeed / generic job alerts
    if (/new jobs? (matching|for)\b/i.test(s)) return 'Via Indeed';
    if (/\bjob alert\b/i.test(s)) return 'Via Indeed';

    return '';
}

/**
 * Classify a single email using Groq LLM.
 * Rotates through up to 3 API keys on rate limits; falls back to waiting if all are exhausted.
 * Checks .env for newly added keys before each attempt.
 */
export async function classifyEmail(email: EmailMessage): Promise<ClassificationResult | null> {
    const userContent = `Subject: ${email.subject}\nFrom: ${email.from}\n\nBody:\n${email.body}`;
    const maxAttempts = keyPool.length * 2 + 2; // enough room for rotation + retries

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            await throttle();

            // Check for API key update before each call
            checkForKeyUpdate();

            trackGroqRequest();

            const completion = await groq.chat.completions.create({
                model: config.groq.model,
                messages: [
                    { role: 'system', content: CLASSIFICATION_PROMPT },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.1,
                max_tokens: 800,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content;
            // Track token usage from API response
            if (completion.usage?.total_tokens) {
                trackGroqTokens(completion.usage.total_tokens);
            }
            if (!content) {
                logger.warn('Empty response from Groq', { emailId: email.id, attempt });
                continue;
            }

            const parsed = parseClassification(content);
            if (parsed) {
                // Fallback: if company is empty or "Unknown", try extracting from sender
                if (!parsed.company || parsed.company === 'Unknown' || parsed.company === 'unknown' || parsed.company.toLowerCase() === 'unknown company') {
                    const senderCompany = extractCompanyFromSender(email.from);
                    if (senderCompany) {
                        parsed.company = senderCompany;
                        logger.debug('Used sender-domain fallback for company', { emailId: email.id, company: senderCompany });
                    } else {
                        const subjectCompany = extractCompanyFromSubject(email.subject);
                        if (subjectCompany) {
                            parsed.company = subjectCompany;
                            logger.debug('Used subject fallback for company', { emailId: email.id, company: subjectCompany });
                        }
                    }
                }
                return parsed;
            }

            logger.warn('Invalid JSON from Groq, retrying...', { emailId: email.id, attempt, raw: content.slice(0, 200) });
        } catch (err: any) {
            if (err.status === 429) {
                trackKeyRateLimit(currentKeyIndex);
                logger.warn(`Groq rate limit on ${currentKeyLabel()}, attempting key rotation...`, { emailId: email.id, attempt: attempt + 1 });
                checkForKeyUpdate();
                if (rotateKey()) {
                    // Don't increment attempt — retry immediately with new key
                    continue;
                }
                // All keys exhausted — wait before retrying
                const waitSec = 60;
                logger.warn(`All keys rate-limited, waiting ${waitSec}s...`, { emailId: email.id });
                await new Promise((r) => setTimeout(r, waitSec * 1000));
                // Reset to key 1 after waiting in case limits reset
                currentKeyIndex = 0;
                groq = new Groq({ apiKey: keyPool[0] });
                continue;
            }
            logger.error('Groq API error', { emailId: email.id, error: err.message, attempt, key: currentKeyLabel() });
            if (attempt < 3) continue;
        }
    }

    logger.error('Failed to classify email after all attempts', { emailId: email.id, subject: email.subject });
    return null;
}

function parseClassification(raw: string): ClassificationResult | null {
    try {
        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }

        // Recover truncated JSON: if it ends mid-field, close it best-effort
        if (!cleaned.endsWith('}')) {
            // Strip trailing incomplete key-value pair and close the object
            cleaned = cleaned.replace(/,?\s*"[^"]*"?\s*:?[^,}]*$/, '') + '}';
        }

        const parsed = JSON.parse(cleaned);

        const validCategories = ['APPLIED_CONFIRMATION', 'REJECTED', 'INTERVIEW', 'OFFER', 'RECRUITER_OUTREACH', 'APPLICATION_VIEWED', 'OTHER'];
        const validJobTypes = ['INTERNSHIP', 'FULL_TIME', 'CONTRACT', 'UNKNOWN'];
        const validWorkModes = ['REMOTE', 'ONSITE', 'HYBRID', 'UNKNOWN'];

        // Remap job_type values mistakenly returned as category
        const categoryRemap: Record<string, string> = {
            INTERNSHIP: 'APPLIED_CONFIRMATION',
            FULL_TIME: 'APPLIED_CONFIRMATION',
            CONTRACT: 'APPLIED_CONFIRMATION',
            UNKNOWN: 'OTHER',
        };
        let category = String(parsed.category || '').toUpperCase();
        if (!validCategories.includes(category) && categoryRemap[category]) {
            logger.warn(`Remapped invalid category "${category}" → "${categoryRemap[category]}"`); 
            category = categoryRemap[category];
        }

        if (!validCategories.includes(category)) {
            return null;
        }

        return {
            category: category as ClassificationResult['category'],
            company: String(parsed.company || '').trim(),
            role: String(parsed.role || '').trim(),
            interview_date: String(parsed.interview_date || ''),
            job_type: validJobTypes.includes(parsed.job_type) ? parsed.job_type : 'UNKNOWN',
            work_mode: validWorkModes.includes(parsed.work_mode) ? parsed.work_mode : 'UNKNOWN',
            source_platform: String(parsed.source_platform || ''),
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
        };
    } catch {
        return null;
    }
}
