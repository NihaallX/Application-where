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

// Set when every key has hit a daily rate limit — caller should stop and let cron resume tomorrow
let allKeysExhaustedFlag = false;
export function isAllKeysExhausted(): boolean { return allKeysExhaustedFlag; }
export function resetAllKeysExhaustedFlag(): void { allKeysExhaustedFlag = false; }

function currentKeyLabel(): string {
    return `key${currentKeyIndex + 1}`;
}

// rotateKey() replaced by round-robin selectBestKey() / switchToKey() below

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
                lastCallTimes.push(0); // keep lastCallTimes in sync with keyPool
                keyRateLimitedFlags.push(false); // keep flags in sync with keyPool
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

const CLASSIFICATION_PROMPT = `You are a job email classifier for a PERSONAL job search tracker. You are analyzing emails from ONE person's inbox.

Return ONLY a valid JSON object:
{
  "category": "APPLIED_CONFIRMATION | REJECTED | INTERVIEW | OFFER | RECRUITER_OUTREACH | APPLICATION_VIEWED | OTHER",
  "company": "company name",
  "role": "job role/title or empty string if no specific role is mentioned",
  "interview_date": "ISO date string or empty string",
  "job_type": "INTERNSHIP | FULL_TIME | CONTRACT | UNKNOWN",
  "work_mode": "REMOTE | ONSITE | HYBRID | UNKNOWN",
  "source_platform": "linkedin | naukri | indeed | glassdoor | wellfound | company_website | email | other",
  "confidence": 0.0 to 1.0
}

═══ CATEGORY RULES (READ CAREFULLY) ═══

INTERVIEW — Use ONLY when the user has been PERSONALLY INVITED to an interview, assessment, or screening call.
  ✅ "We'd like to schedule an interview with you"
  ✅ "You've been shortlisted for the next round"
  ✅ "Please complete this coding assessment"
  ✅ "Your interview is scheduled for March 5th"
  ❌ NOT job listing emails ("New job: Engineer at X" — this is OTHER)
  ❌ NOT job digests ("Apply to jobs at X, Y and Z" — this is OTHER)
  ❌ NOT recruiter outreach ("Urgent Hiring | Data Scientist" — this is RECRUITER_OUTREACH)
  ❌ NOT hackathon/competition invites — this is OTHER

OFFER — Use ONLY when the user has received a PERSONAL job offer or offer letter.
  ✅ "We are pleased to offer you the position of..."
  ✅ "Congratulations! Here is your offer letter"
  ❌ NOT "We're offering an internship program" — this is OTHER (marketing)
  ❌ NOT "Top internships of the week matching your profile" — this is OTHER
  ❌ NOT challenge/competition invites — this is OTHER

APPLIED_CONFIRMATION — The user applied and got a confirmation.
  ✅ "Thank you for applying to X"
  ✅ "Application to X successfully submitted"
  ✅ "We received your application"

REJECTED — The user's application was declined.
  ✅ "We regret to inform you", "We've decided to move forward with other candidates"

RECRUITER_OUTREACH — A recruiter or company reached out to the user about a role (the user did NOT apply first).
  ✅ "Urgent Hiring | Data Scientist | Jersey City" (including all reply threads "Re: Urgent Hiring...")
  ✅ "I came across your profile and wanted to reach out"
  ✅ "We have an opening that matches your background"

APPLICATION_VIEWED — An employer or recruiter viewed the user's application/resume/profile.

OTHER — EVERYTHING ELSE. This is the DEFAULT when unsure. Use liberally.
  ✅ Job alert digest emails: "New job: X at Y, and N more matches" (Wellfound)
  ✅ Job alert digest emails: "Apply to jobs at X, Y and Z" (Indeed)
  ✅ Job alert digest emails: "artificial intelligence intern: Company - Role and more" (LinkedIn)
  ✅ Weekly roundups: "Top internships of the week matching your profile"
  ✅ Internship program marketing: "Join our internship program"
  ✅ Newsletters, competition invites, hackathons
  ✅ Orientation or onboarding info for training programs (not real jobs)
  ✅ Generic "N+ new internships for you" batch notifications

═══ KEY DISTINCTION ═══
Job DIGEST/ALERT emails list available positions — they are NOT about YOUR application.
INTERVIEW/OFFER means something happened TO YOU PERSONALLY — you were selected, invited, or offered something.
If the email is about job LISTINGS or OPPORTUNITIES (not YOUR specific application), use OTHER.

═══ COMPANY RULES ═══
- Extract the HIRING company, not the portal (LinkedIn/Indeed/Wellfound are platforms, not employers)
- For job digests listing multiple companies, use the FIRST company mentioned
- Priority: email body → sender name → sender domain
- If truly impossible to determine, use "Unknown"

═══ OTHER RULES ═══
- INTERNSHIP/FULL_TIME/CONTRACT are job_type values, NEVER category values
- confidence: how certain this is about the user's PERSONAL job search activity (not general job listings)
- For job alert/digest emails: confidence should be LOW (0.2–0.4) since they're not personal
- Return ONLY the JSON object, nothing else`;

// --- Rate limiter for Groq free tier ---
// Each key gets its own timer so we fully utilise all keys in parallel
const MIN_DELAY_MS = 2100; // ~28 req/min per key (safe below 30 RPM limit)
// Grows with keyPool — indexed by key position
const lastCallTimes: number[] = keyPool.map(() => 0);
// Tracks which keys have hit their daily rate limit
const keyRateLimitedFlags: boolean[] = keyPool.map(() => false);

/**
 * Pick the available key (not daily-rate-limited) with the longest idle time.
 * Returns -1 if all keys are exhausted.
 */
function selectBestKey(): number {
    const available = keyPool.map((_, i) => i).filter(i => !keyRateLimitedFlags[i]);
    if (available.length === 0) return -1;
    return available.reduce((best, i) =>
        (lastCallTimes[i] ?? 0) < (lastCallTimes[best] ?? 0) ? i : best,
        available[0],
    );
}

function switchToKey(idx: number): void {
    if (idx === currentKeyIndex) return;
    currentKeyIndex = idx;
    groq = new Groq({ apiKey: keyPool[currentKeyIndex] });
    trackKeyRotation(currentKeyIndex);
    logger.info(`🔑 Round-robin: switched to Groq ${currentKeyLabel()}`);
}

async function throttle(): Promise<void> {
    // Round-robin: always switch to the most-idle available key before waiting
    const best = selectBestKey();
    if (best !== -1) switchToKey(best);
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
        const isPortalName = portalDomains.some(p => name.toLowerCase().includes(p.replace('.com', '').replace('.co', '')));

        if (!genericNames.some((g) => name.toLowerCase().includes(g)) && !isPortalName && !name.toLowerCase().includes('indeed') && name.length > 2) {
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

                // Post-classification guardrails — catch known misclassification patterns
                const corrected = applyGuardrails(parsed, email);
                return corrected;
            }

            logger.warn('Invalid JSON from Groq, retrying...', { emailId: email.id, attempt, raw: content.slice(0, 200) });
        } catch (err: any) {
            if (err.status === 429) {
                trackKeyRateLimit(currentKeyIndex);
                keyRateLimitedFlags[currentKeyIndex] = true;
                logger.warn(`Groq rate limit on ${currentKeyLabel()}, trying another key...`, { emailId: email.id, attempt: attempt + 1 });
                checkForKeyUpdate();
                const best = selectBestKey();
                if (best !== -1) {
                    switchToKey(best);
                    continue;
                }
                // All keys exhausted for the day — exit cleanly so cron can restart tomorrow
                allKeysExhaustedFlag = true;
                logger.warn(`All ${keyPool.length} Groq keys are daily-rate-limited. Stopping to resume via cron tomorrow.`, { emailId: email.id });
                return null;
            }
            logger.error('Groq API error', { emailId: email.id, error: err.message, attempt, key: currentKeyLabel() });
            if (attempt < 3) continue;
        }
    }

    logger.error('Failed to classify email after all attempts', { emailId: email.id, subject: email.subject });
    return null;
}

/**
 * Post-classification guardrails — heuristic overrides for known LLM misclassification patterns.
 * These catch cases where the LLM misidentifies job digests/alerts as INTERVIEW or OFFER.
 */
function applyGuardrails(result: ClassificationResult, email: EmailMessage): ClassificationResult {
    const subject = email.subject;
    const subjectLower = subject.toLowerCase();
    const fromLower = email.from.toLowerCase();
    const original = result.category;

    // --- Job digest / alert patterns → force to OTHER ---

    // Wellfound digest: "New job: X at Y, and N more matches"
    if (/new job:.+and \d+ more match/i.test(subject)) {
        result.category = 'OTHER';
    }

    // Indeed digest: "Apply to jobs at X, Y and Z"
    if (/^apply to jobs at /i.test(subject)) {
        result.category = 'OTHER';
    }

    // LinkedIn job alert: "search query": Title - Company and more
    if (/^".+":\s+.+and more$/i.test(subject)) {
        result.category = 'OTHER';
    }

    // Internshala digests
    if (/top internships? of the week/i.test(subject) ||
        /\d+\+?\s+new internships? for\b/i.test(subject) ||
        /your profile is a perfect match for these.*internships/i.test(subject) ||
        /matching your profile/i.test(subject)) {
        result.category = 'OTHER';
    }

    // Indeed job alerts: "N new jobs for X"
    if (/\d+\s+new jobs?\s+(for|matching)\b/i.test(subject)) {
        result.category = 'OTHER';
    }

    // Generic job alert pattern
    if (/job alert/i.test(subject) && result.category !== 'APPLIED_CONFIRMATION') {
        result.category = 'OTHER';
    }

    // --- INTERVIEW guardrails ---

    // Recruiter outreach reply threads should not be upgraded to INTERVIEW
    // "Re: Urgent Hiring | ..." or "Re: Hiring ||" patterns
    if (result.category === 'INTERVIEW' && /^re:\s*(urgent\s+)?hiring\s*[|│]/i.test(subject)) {
        result.category = 'RECRUITER_OUTREACH';
    }

    // "Hiring || Role || Location" patterns (recruiter spam, not interview)
    if (result.category === 'INTERVIEW' && /^(urgent\s+)?hiring\s*\|{1,2}/i.test(subject)) {
        result.category = 'RECRUITER_OUTREACH';
    }

    // "Shortlisted" / "You've Been Shortlisted" → APPLIED_CONFIRMATION (pre-interview step, not interview)
    if (result.category === 'INTERVIEW' && /shortlist/i.test(subject)) {
        result.category = 'APPLIED_CONFIRMATION';
    }

    // "Assignment" / "Next Step" → APPLIED_CONFIRMATION (assessment task, not interview)
    if (result.category === 'INTERVIEW' && /assignment.*next step|next step.*assignment/i.test(subject)) {
        result.category = 'APPLIED_CONFIRMATION';
    }

    // Online assessment invitations → APPLIED_CONFIRMATION
    if (result.category === 'INTERVIEW' && /online assessment|aptitude (test|assessment)/i.test(subject)) {
        result.category = 'APPLIED_CONFIRMATION';
    }

    // "Induction Session" / "Orientation" → OTHER (not interview)
    if (result.category === 'INTERVIEW' && /induction|orientation/i.test(subject)) {
        result.category = 'OTHER';
    }

    // Indeed "New Message from X" → APPLIED_CONFIRMATION (employer message, not interview)
    if (result.category === 'INTERVIEW' && /^new message from /i.test(subject)) {
        result.category = 'APPLIED_CONFIRMATION';
    }

    // LinkedIn job alerts: "Title at Company and N more new jobs"
    if (result.category === 'INTERVIEW' && /\d+\s+more\s+new\s+jobs?/i.test(subject)) {
        result.category = 'OTHER';
    }

    // "X is hiring a Y" → OTHER (job listing notification, not interview)
    if (result.category === 'INTERVIEW' && /is hiring a /i.test(subject)) {
        result.category = 'OTHER';
    }

    // "Role @ Company" Indeed format → RECRUITER_OUTREACH (job listing)
    if (result.category === 'INTERVIEW' && /^[A-Za-z][\w\s\/&()\-]+@\s+\w/i.test(subject) && !/interview/i.test(subject)) {
        result.category = 'RECRUITER_OUTREACH';
    }

    // LinkedIn format: "query": Company - Title
    if (result.category === 'INTERVIEW' && /^".+":\s+/i.test(subject)) {
        result.category = 'OTHER';
    }

    // "Finish your interview" Wellfound platform prompt → OTHER
    if (result.category === 'INTERVIEW' && /finish your interview/i.test(subject)) {
        result.category = 'OTHER';
    }

    // --- OFFER guardrails ---

    // "Hiring || Role" is recruiter outreach, not an offer
    if (result.category === 'OFFER' && /hiring\s*\|{1,2}/i.test(subject)) {
        result.category = 'RECRUITER_OUTREACH';
    }

    // Program marketing mistaken for offer
    if (result.category === 'OFFER' && (
        /internship program/i.test(subject) ||
        /virtual internship/i.test(subject) ||
        /challenge\s+\d{4}/i.test(subject) ||
        /hackathon/i.test(subject) ||
        /training/i.test(subject) ||
        /dare2compete/i.test(fromLower) ||
        /internshala/i.test(fromLower)
    )) {
        result.category = 'OTHER';
    }

    // Wellfound digest shouldn't be INTERVIEW/OFFER even if body mentions companies
    if ((result.category === 'INTERVIEW' || result.category === 'OFFER') &&
        /wellfound/i.test(fromLower) &&
        /more matches/i.test(subject)) {
        result.category = 'OTHER';
    }

    // --- WORK MODE guardrails ---
    if (result.work_mode === 'UNKNOWN') {
        const textToCheck = `${result.role} ${subject}`.toLowerCase();
        if (textToCheck.includes('remote') || textToCheck.includes('work from home') || textToCheck.includes('wfh')) {
            result.work_mode = 'REMOTE';
        } else if (textToCheck.includes('hybrid')) {
            result.work_mode = 'HYBRID';
        } else if (textToCheck.includes('onsite') || textToCheck.includes('on-site')) {
            result.work_mode = 'ONSITE';
        }
    }

    // Log any corrections
    if (result.category !== original) {
        logger.info(`Guardrail: ${original} → ${result.category}`, {
            emailId: email.id,
            subject: subject.slice(0, 100),
        });
    }

    return result;
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

        let role = String(parsed.role || '').trim();
        if (/^(unknown role|unknown|n\/a|not applicable|not specified|-)$/i.test(role)) {
            role = '';
        }

        let jobType = validJobTypes.includes(parsed.job_type) ? parsed.job_type : 'UNKNOWN';

        // If LLM says UNKNOWN but we have a role, try to infer it or default to FULL_TIME
        if (jobType === 'UNKNOWN' && role) {
            const roleLower = role.toLowerCase();
            if (roleLower.includes('intern') || roleLower.includes('trainee') || roleLower.includes('student')) {
                jobType = 'INTERNSHIP';
            } else if (roleLower.includes('contract') || roleLower.includes('freelance')) {
                jobType = 'CONTRACT';
            } else {
                jobType = 'FULL_TIME'; // Default to full time if there's a real role
            }
        }

        return {
            category: category as ClassificationResult['category'],
            company: String(parsed.company || '').trim(),
            role: role,
            interview_date: String(parsed.interview_date || ''),
            job_type: jobType,
            work_mode: validWorkModes.includes(parsed.work_mode) ? parsed.work_mode : 'UNKNOWN',
            source_platform: String(parsed.source_platform || ''),
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
        };
    } catch {
        return null;
    }
}
