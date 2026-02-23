export interface Job {
    id: string;
    company: string;
    role: string;
    source_platform: string;
    job_type: string;
    work_mode: string;
    current_status: string;
    first_email_date: string;
    last_update_date: string;
    interview_date: string | null;
    created_at: string;
    notes: string;
}

export interface Email {
    id: string;
    gmail_id: string;
    job_id: string;
    category: string;
    confidence: number;
    email_date: string;
    subject: string;
    body_preview: string;
}

export interface Filters {
    company: string;
    job_type: string;
    work_mode: string;
    source_platform: string;
}

export interface Metrics {
    totalApplications: number;
    totalInterviews: number;
    totalRejections: number;
    totalOffers: number;
    totalViewed: number;
    conversionRate: string;
    offerRate: string;
}
