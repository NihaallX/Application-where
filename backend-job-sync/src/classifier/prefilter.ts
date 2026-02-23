import { EmailMessage } from '../gmail/fetcher';
import { logger } from '../utils/logger';

/**
 * Job-related sender domain patterns.
 * NOTE: linkedin.com is intentionally excluded here.
 * LinkedIn social notifications (connections, analytics, profile views) flood the system.
 * Only LinkedIn JOB-SPECIFIC emails are matched via subject/body keywords below.
 */
const JOB_DOMAINS = [
    'naukri.com',
    'indeed.com',
    'glassdoor.com',
    'monster.com',
    'wellfound.com',
    'angel.co',
    'lever.co',
    'greenhouse.io',
    'workday.com',
    'smartrecruiters.com',
    'icims.com',
    'taleo.net',
    'breezy.hr',
    'recruitee.com',
    'ashbyhq.com',
    'myworkday.com',
    'hire.lever.co',
    'jobs-noreply',
    'jobvite.com',
];

const JOB_DOMAIN_PATTERNS = [
    /careers?\./i,
    /hiring\./i,
    /recruit/i,
    /talent/i,
    /^hr@/i,
    /^jobs@/i,
    /^no-?reply@.*career/i,
    /^no-?reply@.*recruit/i,
    /^no-?reply@.*talent/i,
    /^no-?reply@.*hiring/i,
];

/**
 * LinkedIn social notification subjects to REJECT.
 * These are NOT job-related even though they come from linkedin.com.
 */
const LINKEDIN_SOCIAL_PATTERNS = [
    /accepted your invitation/i,
    /wants? to connect/i,
    /I'd like to (add|join|connect)/i,
    /your posts? reached/i,
    /connection request/i,
    /thanks for being a valued member/i,
    /your profile (photo|was changed|appeared)/i,
    /your weekly newsletter/i,
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
    /new followers?/i,
    /trending in your network/i,
    /people are looking at/i,
    /your network is growing/i,
    /congratulated you/i,
    /your activity update/i,
];

/**
 * Job-related subject keywords.
 */
const SUBJECT_KEYWORDS = [
    'application',
    'applied',
    'viewed your application',
    'application was viewed',
    'viewed your profile',
    'your resume was',
    'resume was downloaded',
    'opened your application',
    'interview',
    'regret',
    'unfortunately',
    'hiring',
    'position',
    'career',
    'offer',
    'congratulations',
    'selected',
    'shortlisted',
    'assessment',
    'coding challenge',
    'technical round',
    'onboarding',
    'joining',
    'internship',
    'full-time',
    'full time',
    'job opportunity',
    'we reviewed',
    'we have reviewed',
    'your candidacy',
    'your resume',
    'thank you for applying',
    'next steps',
    'job alert',
    'new jobs',
    'recruiter',
    'talent acquisition',
    'we regret',
    'moved forward',
    'not moving forward',
    'other candidates',
];

/**
 * Returns true if the email looks job-related based on heuristics.
 * Only emails passing this filter will be sent to Groq for classification.
 */
export function isJobRelated(email: EmailMessage): boolean {
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const senderDomain = extractDomain(fromLower);

    // --- LinkedIn special handling ---
    // LinkedIn sends both job-related AND social notification emails.
    // We need to explicitly reject social notifications.
    if (senderDomain && senderDomain.includes('linkedin.com')) {
        // Check if it's a social notification (reject)
        for (const pattern of LINKEDIN_SOCIAL_PATTERNS) {
            if (pattern.test(email.subject)) {
                logger.debug('Prefilter: rejected LinkedIn social notification', { subject: email.subject });
                return false;
            }
        }
        // LinkedIn email that didn't match social patterns → check for job keywords
        const hasJobKeyword = SUBJECT_KEYWORDS.some((kw) => subjectLower.includes(kw));
        if (hasJobKeyword) {
            return true;
        }
        // No job keyword in subject → check body for job-specific phrases
        const bodyPreview = email.body.slice(0, 500).toLowerCase();
        const jobBodyKeywords = [
            'thank you for applying',
            'your application',
            'interview scheduled',
            'applied for',
            'job alert',
            'new job',
            'is hiring',
            'we regret',
            'offer letter',
        ];
        for (const kw of jobBodyKeywords) {
            if (bodyPreview.includes(kw)) {
                return true;
            }
        }
        // LinkedIn email with no job signals → reject
        logger.debug('Prefilter: rejected LinkedIn email (no job signals)', { subject: email.subject });
        return false;
    }

    // --- Non-LinkedIn emails ---
    // Check sender domain
    if (senderDomain) {
        for (const domain of JOB_DOMAINS) {
            if (senderDomain.includes(domain)) {
                return true;
            }
        }
        for (const pattern of JOB_DOMAIN_PATTERNS) {
            if (pattern.test(fromLower)) {
                return true;
            }
        }
    }

    // Check subject keywords
    for (const keyword of SUBJECT_KEYWORDS) {
        if (subjectLower.includes(keyword)) {
            return true;
        }
    }

    // Check body keywords (first 500 chars for speed)
    const bodyPreview = email.body.slice(0, 500).toLowerCase();
    const bodyKeywords = [
        'thank you for applying',
        'your application',
        'interview scheduled',
        'we regret',
        'offer letter',
        'congratulations',
        'we are pleased',
        'we would like to',
        'coding assessment',
    ];
    for (const keyword of bodyKeywords) {
        if (bodyPreview.includes(keyword)) {
            return true;
        }
    }

    return false;
}

function extractDomain(email: string): string | null {
    const match = email.match(/@([^\s>]+)/);
    return match ? match[1] : null;
}
