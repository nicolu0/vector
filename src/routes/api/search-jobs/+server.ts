import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import {
    type SearchJobsRequest,
    type JobsResponse,
    type Job,
    type Level,
    type EmploymentType,
    type RemotePolicy,
    isSearchJobsRequest,
    isJobsResponse
} from '$lib/types/job';

type DiscoveredBoard = { provider: 'lever' | 'greenhouse'; org: string, url: string };

const PROVIDER_MATCHERS = [
    { provider: 'lever' as const, host: 'api.lever.co', re: /^https?:\/\/api\.lever\.co\/v0\/postings\/([^/?#]+)\?mode=json/i },
    { provider: 'greenhouse' as const, host: 'boards-api.greenhouse.io', re: /^https?:\/\/boards-api\.greenhouse\.io\/v1\/boards\/([^\/?#]+)\/jobs/i }
];

function buildGoalBlock(goal?: 'full_time' | 'internship' | 'explore') {
    switch (goal) {
        case 'internship':
            return '(intern OR internship)';
        case 'full_time':
            return '("new grad" OR "new-grad" OR "entry level" OR "early career")';
        case 'explore':
        default:
            return '(software engineer OR SWE OR developer)';
    }
}

function buildDiscoveryQueries(req: SearchJobsRequest) {
    const base = [
        req.interests?.trim() || '',
        (req.tags ?? []).join(' '),
        buildGoalBlock(req.onboarding?.goal)
    ].filter(Boolean).join(' ');

    return [
        `site:api.lever.co/v0/postings ${base}`,
        `site:boards-api.greenhouse.io/v1/boards ${base}`
    ];
}

async function braveSearch(query: string, apiKey: string) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=12&search_lang=en`;
    const res = await fetch(url, { headers: { 'X-Subscription-Token': apiKey } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: Array<{ url: string }> = data?.web?.results ?? [];
    return items.map((i) => i.url).filter(Boolean);
}

function parseProviderUrl(url: string): DiscoveredBoard | null {
    try {
        const { hostname, href } = new URL(url);
        for (const m of PROVIDER_MATCHERS) {
            if (hostname === m.host) {
                const match = href.match(m.re);
                if (match && match[1]) return { provider: m.provider, org: match[1].toLowerCase(), url: href };
            }
        }
        return null;
    } catch {
        return null;
    }
}

const JOBS_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['query', 'project_title', 'jobs'],
    properties: {
        query: { type: 'string' },
        project_title: { type: 'string' },
        jobs: { 
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: { 
                type: 'object',
                additionalProperties: false,
                required: [
                    'title',
                    'company',
                    'location',
                    'url',
                    'source',
                    'posted_at',
                    'employment_type',
                    'level',
                    'remote_policy',
                    'salary_range',
                    'description',
                    'requirements',
                    'match_reasons'
                ],
                properties: {
                    title: { type: 'string', minLength: 3, maxLength: 100 },
                    company: { type: 'string', minLength: 2, maxLength: 100 },
                    location: { type: 'string', minLength: 2, maxLength: 100 },
                    url: { type: 'string', minLength: 10, maxLength: 400, pattern: '^(https?:\\/\\/)(?!.*(google\\.com\\/search|linkedin\\.com\\/jobs\\/search|indeed\\.com\\/jobs\\?)).+' },
                    source: { type: 'string', enum: ['LinkedIn', 'Indeed', 'company', 'ats', 'other'] },
                    posted_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}(?:[T ][0-9:.+-Z]+)?$' },
                    employment_type: { type: 'string', enum: ['Full-time', 'Part-time', 'Internship', 'Other'] },
                    level: { type: 'string', enum: ['Intern', 'New-Grad'] },
                    remote_policy: { type: 'string', enum: ['Remote', 'Hybrid', 'On-site'] },
                    salary_range: { 
                        type: 'object',
                        additionalProperties: false,
                        required: ['currency', 'period'],
                        properties: {
                            min: { type: 'number' },
                            max: { type: 'number' },
                            currency: { type: 'string', minLength: 3, maxLength: 8 },
                            period: { type: 'string', enum: ['year', 'month', 'hour'] }
                        }
                    },
                    description: { type: 'string', minLength: 80, maxLength: 1500 },
                    requirements: {
                        type: 'array',
                        minItems: 3,
                        maxItems: 12,
                        items: { type: 'string', minLength: 3, maxLength: 200 }
                    },
                    match_reasons: {
                        type: 'array',
                        minItems: 2,
                        maxItems: 8,
                        items: { type: 'string', minLength: 3, maxLength: 200 } 
                    }
                } 
            } 
        }
    }
} as const;

const JOBS_RESPONSE_LLM_FORMAT = {
    type: 'json_schema',
    name: 'jobs_search_results',
    schema: JOBS_RESPONSE_SCHEMA,
    strict: true
} as const;

function createOpenAI() {
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
        return null;
    }
    return new OpenAI({ apiKey });
}

function buildPrompt(input: SearchJobsRequest) {
    const lines: string[] = [];

    lines.push(
        'Your goal is to find and retrieve 8-12 job listings that best match the user\'s goals',
        'Find real, high-quality job listings that closely match the user\'s interests and (if provided) the project (title, description, skills).'
    );

    if (input.interests?.trim()) lines.push(`Interests:\n${input.interests.trim()}`);
    if (input.tags?.length) lines.push(`Tags:\n${input.tags.map((t) => `- ${t}`).join('\n')}`);

    if (input.project) {
        lines.push(
            `Project Title: ${input.project.title}`,
            `Project Description: ${input.project.description}`,
            `Project Skills: ${input.project.skills.join(', ')}`
        );
    }

    if (input.locations?.length) lines.push(`Locations:\n${input.locations.map((l) => `- ${l}`).join('\n')}`);
    if (input.remote_policy) lines.push(`Remote Policy: ${input.remote_policy}`);
    if (input.level) lines.push(`Level: ${input.level}`);
    if (input.sources?.length) lines.push(`Preferred Sources: ${input.sources.join(', ')}`);

    lines.push(
        'Rules:',
        '- Prefer direct company career pages or ATS links (Greenhouse, Lever, Workday).',
        '- Avoid search result URLs (google.com/search, linkedin.com/jobs/search, indeed.com/jobs?q=).',
        '- Each job must include a concrete description and at least 3 requirements.',
        '- Include posted_at as ISO date. Prefer recent postings.',
        '- Use match_reasons to explain alignment with the project and skills.',
        '- Do not include markdown or commentary outside the JSON.'
    );

    return lines.join('\n\n');
}



export const POST: RequestHandler = async ({ request }) => {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    if (!isSearchJobsRequest(raw)) {
        throw error(400, 'Invalid search payload');
    }
    const req = raw as SearchJobsRequest;

    const hasSignal =
        (req.interests && req.interests.trim().length > 0) ||
        (Array.isArray(req.tags) && req.tags.length > 0) ||
        !!req.project;
    if (!hasSignal) {
        throw error(400, 'Provide interests, tags, or project to search for jobs');
    }

    const client = createOpenAI();
    if (!client) {
        const fallback: JobsResponse = {
            query: req.interests || '',
            project_title: req.project?.title || '',
            jobs: []
        };
        return json(fallback, { headers: { 'x-vector-jobs-source': 'fallback' } });
    }

    const instructions = 'Always respond with valid JSON that matches the provided JSON schema.';
    const prompt = buildPrompt(req);
    
    try {
        const resp = await client.responses.create({
            model: 'gpt-5-nano-2025-08-07',
            instructions,
            input: prompt,
            text: { format: JOBS_RESPONSE_LLM_FORMAT }
        });

        const output = resp.output_text;
        if (!output) throw new Error('No content returned from model');

        let parsed: unknown;
        try {
            parsed = JSON.parse(output);
        } catch {
            throw new Error('Invalid JSON returned from model');
        }

        if (!isJobsResponse(parsed)) throw new Error('Model response did not match expected schema');

        const result = parsed as JobsResponse;
        result.jobs = (result.jobs as Job[]).filter(
            (j) => !j.url.includes('google.com/search') && !j.url.includes('linkedin.com/jobs/search') && !j.url.includes('indeed.com/jobs?')
        )

        return json(result, { headers: {'x-vector-jobs-source': 'generated'} });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error searching for jobs: ${message}`);

        const fallback: JobsResponse = {
            query: req.interests || '',
            project_title: req.project?.title || '',
            jobs: []
        };

        return json(fallback, { headers: {'x-vector-jobs-source': 'fallback', 'x-vector-jobs-error': encodeURIComponent(message) } });
    }
}