import { error, json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

type ProjectDescription = {
    title: string;
    description: string;
    skills: string[];
    domain: string;
};

type Milestone = {
    title: string;
    description: string;
    ordinal: number;
    skills: string[];
};

type Milestones = {
    milestones: Milestone[];
};

const PROJECT_DESCRIPTION_SCHEMA = {
    type: 'json_schema',
    name: 'project_description_v1',
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'skills','domain'],
        properties: {
            title: { type: 'string', minLength: 8, maxLength: 100 },
            description: { type: 'string', minLength: 40, maxLength: 800 },
            skills: {
                type: 'array',
                minItems: 3,
                maxItems: 12,
                items: { type: 'string', minLength: 1, maxLength: 40 }
            },
            domain: { type: 'string', minLength: 2, maxLength: 50 },
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
                minItems: 6,
                maxItems: 10,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'ordinal', 'description', 'skills'],
                    properties: {
                        title: { type: 'string', minLength: 6, maxLength: 80 },
                        ordinal: { type: 'integer', minimum: 1, maximum: 10 },
                        description: { type: 'string', minLength: 20, maxLength: 400 },
                        skills: {
                            type: 'array',
                            minItems: 1,
                            maxItems: 8,
                            items: { type: 'string', minLength: 1, maxLength: 40 }
                        }
                    }
                }
            }
        }
    },
    strict: true
} as const;

function isProjectDescription(x: unknown): x is ProjectDescription {
    if (!x || typeof x !== 'object') return false;
    const o = x as any;
    const skillsValid =
        Array.isArray(o.skills) && o.skills.every((s: any) => typeof s === 'string' && s.length > 0);
    return typeof o.title === 'string'
        && typeof o.description === 'string'
        && typeof o.domain === 'string'
        && skillsValid;
}

function isMilestones(x: unknown): x is Milestones {
    if (!x || typeof x !== 'object') return false;
    const arr = (x as any).milestones;
    return Array.isArray(arr) && arr.length >= 1 &&
        arr.every((m: any) =>
            m && 
            typeof m.title === 'string' &&
            typeof m.ordinal === 'number' &&
            typeof m.description === 'string' &&
            Number.isInteger(m.ordinal) &&
            m.ordinal >= 1 &&
            m.ordinal <= 10 &&
            Array.isArray(m.skills) &&
            m.skills.every((s: any) => typeof s === 'string' && s.length > 0)
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

    async function jsonResponse<T>(
        system: string, 
        input: string, 
        schema: any, 
        guard: (x: unknown) => x is T, 
        fallback: T
    ): Promise<T> {
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

    const projectFallback: ProjectDescription = {
        title: `Path to ${goal.slice(0, 64)}`,
        description: 'Three-week plan to build a focused project that demonstrates capability, produces tangible artifacts, and positions you for outreach to secure a research role or internship.',
        domain: 'Software Engineering',
        skills: ['Git']
    };

    const milestonesFallback: Milestones = {
        milestones: [
            { title: 'Scope & Data', description: 'Define problem, metric, and small dataset sample. Set up repo.', ordinal: 1, skills: ['Git'] },
            { title: 'Baseline', description: 'Implement a minimal end-to-end baseline to produce first results.', ordinal: 2, skills: ['Git'] },
            { title: 'Improvement', description: 'Add one targeted enhancement based on initial error analysis.', ordinal: 3, skills: ['Git'] },
            { title: 'Evaluation', description: 'Run rigorous evaluation, error taxonomy, and (if applicable) ablations.', ordinal: 4, skills: ['Git'] },
            { title: 'Packaging & Demo', description: 'Polish README/report, figures, and record a short demo or notebook.', ordinal: 5, skills: ['Git'] }
        ]
    };

    const projectPrompt = JSON.stringify({
        goal,
        instruction: 'From the user goal, generate a concise project title (<=100), description (<=800), 3-12 concrete skills (strings), and a domain/field string (2-50 chars).'
    });

    const projectDesc = await jsonResponse<ProjectDescription>(
        "You write concise project descriptions. Return VALID JSON ONLY with title, description, skills (array of strings), and domain (discipline/field).",
        projectPrompt,
        PROJECT_DESCRIPTION_SCHEMA,
        isProjectDescription,
        projectFallback
    );

    const milestonesPrompt = JSON.stringify({
        goal,
        projectDesc,
        instruction: 'Produce 6-10 milestones for a single coherent project in the provided domain. Each milestone advances the same artifact. Include title, ordinal (1..10), description, and skills (tags).'
    })

    const generatedMilestones = await jsonResponse<Milestones>(
        'You propose milestones for a single project. Return VALID JSON ONLY.',
        milestonesPrompt,
        MILESTONE_SCHEMA,
        isMilestones,
        milestonesFallback
    );

    let milestonesClean = (generatedMilestones.milestones?.length ? generatedMilestones.milestones : milestonesFallback.milestones).slice(0, 10);

    if (milestonesClean.length < 6) {
        milestonesClean = milestonesFallback.milestones;
    }

    milestonesClean.sort((a, b) => a.ordinal - b.ordinal);
    milestonesClean = milestonesClean.map((m, i) => ({...m, ordinal: i + 1}));

    const { data: proj, error: pErr } = await supabase
        .from('projects')
        .insert([{
            user_id: user.id,
            title: projectDesc.title,
            description: projectDesc.description,
            domain: projectDesc.domain,
            skills: projectDesc.skills,
            difficulty: 'Medium',
            timeline: '3 weeks',
            status: 'not_started',
            metadata: {
                projectDesc,
                plan_sizing: sizing,
                goal
            },
            prerequisites: null
        }]).select('id, title, description, domain, skills').single();

    if (pErr) throw error(500, `Failed to create project: ${pErr.message}`);

    const msRows = milestonesClean.map((m) => ({
        user_id: user.id,
        project_id: proj.id,
        title: m.title,
        description: m.description,
        skills: m.skills,
        ordinal: m.ordinal,
        status: 'not_started',
        done: false,
        metadata: null
    }));

    const { error: msErr } = await supabase
        .from('milestones')
        .upsert(msRows, { onConflict: 'project_id,ordinal' });

    if (msErr) throw error(500, `Failed to create milestones: ${msErr.message}`);

    const { data: msList, error: fetchMsErr } = await supabase
        .from('milestones')
        .select('id, ordinal, title, description, skills')
        .eq('project_id', proj.id)
        .order('ordinal', { ascending: true });

    if (fetchMsErr) throw error(500, fetchMsErr.message);

    return json({
        project: {
            id: proj.id,
            title: proj.title,
            description: proj.description,
            domain: proj.domain,
            skills: proj.skills
        },
        milestones: msList
    });
};