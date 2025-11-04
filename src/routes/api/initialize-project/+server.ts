import { error, json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

type ProjectBrief = {
    title: string;
    description: string;
    domain: 'research' | 'internship';
};

type Milestone = {
    title: string;
    summary: string;
};

type Milestones = {
    milestones: Milestone[];
};

const BRIEF_SCHEMA = {
    type: 'json_schema',
    name: 'brief_v1',
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'domain'],
        properties: {
            title: { type: 'string', minLength: 8, maxLength: 100 },
            description: { type: 'string', minLength: 40, maxLength: 800 },
            domain: { type: 'string', enum: ['research', 'internship'] },
        }
    },
    strict: true
} as const;

const MILESTONE_SCHEMA = {
    type: 'json_schema',
    name: 'milestone_v1',
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['milestones'],
        properties: {
            milestones: {
                type: 'array',
                minItems: 4,
                maxItems: 6,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'summary'],
                    properties: {
                        title: { type: 'string', minLength: 6, maxLength: 80 },
                        summary: { type: 'string', minLength: 20, maxLength: 400 },
                    }
                }
            }
        }
    },
    strict: true
} as const;

function isProjectBrief(x: unknown): x is ProjectBrief {
    if (!x || typeof x !== 'object') return false;
    const o = x as any;
    return typeof o.title === 'string'
        && typeof o.description === 'string'
        && (o.domain === 'research' || o.domain === 'internship');
}

function isMilestones(x: unknown): x is Milestones {
    if (!x || typeof x !== 'object') return false;
    const arr = (x as any).milestones;
    return Array.isArray(arr) && arr.length >= 1 &&
        arr.every((m: any) =>
            m && typeof m.title === 'string' &&
            typeof m.summary === 'string'
        );
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    let payload: { goal?: string; } = {};
    try {
        payload = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }
    const goal = (payload.goal ?? '').trim();
    if (!goal) throw error(400, 'Provide a goal to initialize a project');

    const supabase = createSupabaseServerClient(cookies);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw error(401, 'Not signed in');

    const sizing = {
        minutes_per_day: 60,
        days_per_week: 5,
        weeks_target: 4,
    }

    const oa = new OpenAI({ apiKey: OPENAI_API_KEY });

    async function jsonResponse<T>(system: string, input: string, schema: any, guard: (x: unknown) => x is T, fallback: T): Promise<T> {
        try {
            const res = await oa.responses.create({
                model: 'gpt-5-2025-08-07',
                instructions: system,
                input: input,
                text: { format: schema },
            });
            const txt = res.output_text ?? '';
            const parsed = JSON.parse(txt);
            if (guard(parsed)) return parsed;
            return fallback;
        } catch {
            return fallback;
        }
    }

    const briefFallback: ProjectBrief = {
        title: `Path to ${goal.slice(0, 64)}`,
        description: 'Three-week plan to build a focused project that demonstrates capability, produces tangible artifacts, and positions you for outreach to secure a research role or internship.',
        domain: /lab|research/i.test(goal) ? 'research' : 'internship'
    };

    const briefPrompt = JSON.stringify({
        goal,
        instruction: 'Generate a concise title (<=100), description (<=800), and select domain: research|internship.'
    });

    const brief = await jsonResponse<ProjectBrief>(
        'You write concise project briefs from a user\'s goal. Return valid JSON only.',
        briefPrompt,
        BRIEF_SCHEMA,
        isProjectBrief,
        briefFallback
    );

    const { data: proj, error: pErr } = await supabase
        .from('projects')
        .insert([{
            user_id: user.id,
            title: brief.title,
            description: brief.description,
            domain: brief.domain,
            difficulty: 'standard',
            timeline: '3 weeks',
            status: 'not_started',
            metadata: {
                brief,
                plan_sizing: sizing,
                goal
            }
        }]).select('id, title, description, domain').single();

    if (pErr) throw error(500, `Failed to create project: ${pErr.message}`);

    const milestonesFallback: Milestones = {
        milestones: [
            { title: 'Scope & Data', summary: 'Define problem, metric, and small dataset sample. Set up repo.' },
            { title: 'Baseline', summary: 'Implement a minimal end-to-end baseline to produce first results.' },
            { title: 'Improvement', summary: 'Add one targeted enhancement based on initial error analysis.' },
            { title: 'Evaluation', summary: 'Run rigorous evaluation, error taxonomy, and (if applicable) ablations.' },
            { title: 'Packaging & Demo', summary: 'Polish README/report, figures, and record a short demo or notebook.' }
        ]
    };

    const milestonesPrompt = JSON.stringify({
        goal,
        brief,
        constraint: 'Produce 4-6 milestones for a single coherent project toward the stated domain. Each milestone advances the same artifact.'
    });

    const milestones = await jsonResponse<Milestones>(
        'You propose milestone titles for a single project toward a research role or internship. Return VALID JSON only.',
        milestonesPrompt,
        MILESTONE_SCHEMA,
        isMilestones,
        milestonesFallback
    );

    const milestonesClean = (milestones.milestones?.length ? milestones.milestones : milestonesFallback.milestones)
        .slice(0, 6);

    const msRows = milestonesClean.map((m, i) => ({
        user_id: user.id,
        project_id: proj.id,
        title: m.title,
        summary: m.summary,
        ordinal: i + 1,
        status: 'planned',
        metadata: null
    }));

    const { error: msErr } = await supabase
        .from('milestones')
        .upsert(msRows, { onConflict: 'project_id,ordinal' });

    if (msErr) throw error(500, msErr.message);

    const { data: msList, error: fetchMsErr } = await supabase
        .from('milestones')
        .select('id, ordinal, title, summary')
        .eq('project_id', proj.id)
        .order('ordinal', { ascending: true });

    if (fetchMsErr) throw error(500, fetchMsErr.message);

    return json({
        project: {
            id: proj.id,
            title: proj.title,
            description: proj.description,
            domain: brief.domain
        },
        milestones: msList
    });
};