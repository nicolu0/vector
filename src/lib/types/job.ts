export type JobSource = 'LinkedIn' | 'Indeed' | 'company' | 'ats' | 'other';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Internship' | 'Other';
export type Level = 'Intern' | 'NewGrad';
export type RemotePolicy = 'Remote' | 'Hybrid' | 'On-site';

export type SalaryRange = {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'year' | 'month' | 'hour';
};

export type Job = {
    title: string;
    company: string;
    location: string;
    url: string;
    source: JobSource;
    posted_at: string;
    employment_type: EmploymentType;
    level: Level;
    remote_policy: RemotePolicy;
    salary_range: SalaryRange;
    description: string;
    requirements: string[];
    match_reasons: string[];
}

export type Onboarding = {
    education: 'high_school' | 'college';
    goal: 'full_time' | 'internship' | 'explore';
    project: 'research' | 'industry';
    completed?: boolean;
    updated_at?: string;
}

export function isOnboarding(v: unknown): v is Onboarding {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    const eduOk = o.education === 'high_school' || o.education === 'college';
    const goalOk = o.goal === 'full_time' || o.goal === 'internship' || o.goal === 'explore';
    const projectOk = o.project === 'research' || o.project === 'industry';
    if (!eduOk || !goalOk || !projectOk) return false;
    if (o.completed !== undefined && typeof o.completed !== 'boolean') return false;
    if (o.updated_at !== undefined && typeof o.updated_at !== 'string') return false;
    return true;
}

export function isOnboardingComplete(o: Onboarding | null | undefined): boolean {
    return !!(o && o.education && o.goal && o.project && o.completed);
}

export function extractOnboardingFromMetadata(metadata: unknown): Onboarding | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const raw = (metadata as Record<string, unknown>)['vector_onboarding'];
    if (!raw || typeof raw !== 'object') return null;
    return isOnboarding(raw) ? (raw as Onboarding) : null;
}

export type JobsResponse = {
    query: string;
    jobs: Job[];
};

export type SearchJobsRequest = {
    interests?: string;
    tags?: string[];
    onboarding?: Onboarding;
    locations?: string[];
    remote_policy?: RemotePolicy;
    level?: Level;
    sources?: JobSource[];
    limit?: number;
}

export function isJob(value: unknown): value is Job {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;

    const requiredStrs: Array<keyof Job> = [
        'title',
        'company',
        'location',
        'url',
        'description',
        'posted_at'
    ];
    if (!requiredStrs.every((k) => typeof v[k] === 'string')) return false;

    const srcOk = ['LinkedIn', 'Indeed', 'company', 'ats', 'other'].includes(v.source as string);
    const empOk = ['Full-time', 'Part-time', 'Internship', 'Other'].includes(v.employment_type as string);
    const levelOk = ['Intern', 'NewGrad'].includes(v.level as string);
    if (!srcOk || !empOk || !levelOk) return false;

    if (!Array.isArray(v.requirements) || !v.requirements.every((x) => typeof x === 'string')) return false;
    if (!Array.isArray(v.match_reasons) || !v.match_reasons.every((x) => typeof x === 'string')) return false;

    if (v.salary_range !== undefined) {
        const s = v.salary_range as Record<string, unknown>;
        if (!s || typeof s !== 'object') return false;
        if (s.min !== undefined && typeof s.min !== 'number') return false;
        if (s.max !== undefined && typeof s.max !== 'number') return false;
        if (typeof s.currency !== 'string') return false;
        if (!['year', 'month', 'hour'].includes(s.period as string)) return false;
    }

    if (v.remote_policy !== undefined) {
        if (!['Remote', 'Hybrid', 'On-site'].includes(v.remote_policy as string)) return false;
    }

    if (typeof v.url === 'string') {
        const bad = v.url.includes('google.com/search') || v.url.includes('linkedin.com/jobs/search') || v.url.includes('indeed.com/jobs?');
        if (bad) return false;
    }

    return true;
}

export function isJobsResponse(value: unknown): value is JobsResponse {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    if (typeof v.query !== 'string') return false;
    if (!Array.isArray(v.jobs)) return false;
    return v.jobs.every(isJob);
}

export function isSearchJobsRequest(value: unknown): value is SearchJobsRequest {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;

    if (v.interests !== undefined && typeof v.interests !== 'string') return false;
    if (v.tags !== undefined && (!Array.isArray(v.tags) || !v.tags.every((x) => typeof x === 'string'))) return false;

    if (v.onboarding !== undefined && !isOnboarding(v.onboarding)) return false;

    if (v.locations !== undefined && (!Array.isArray(v.locations) || !v.locations.every((x) => typeof x === 'string'))) return false;
    if (v.remote_policy !== undefined && !['Remote', 'Hybrid', 'On-site'].includes(v.remote_policy as string)) return false;
    if (v.level !== undefined && !['Intern', 'NewGrad'].includes(v.level as string)) return false;
    if (v.sources !== undefined && (!Array.isArray(v.sources) || !v.sources.every((x) => ['LinkedIn', 'Indeed', 'company', 'ats', 'other'].includes(x as string)))) return false;
    if (v.limit !== undefined && typeof v.limit !== 'number') return false;
    return true;
}
