import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import {
  OPENAI_API_KEY,
} from '$env/static/private';
import type { RequestHandler } from './$types';
import { isProject, type Project } from '$lib/types/project';
import sampleProject from '$lib/mock/project.sample.json';
import { createSupabaseServerClient } from '$lib/server/supabase';

const REQUIRE_AUTH = false;
const REQUIRE_CREDITS = false;
const INITIAL_CREDITS = Number.isFinite(Number(1))
  ? Number(1)
  : 1;

const FALLBACK_PROJECT = sampleProject as Project;


const PROJECT_SCHEMA = {
  type: 'json_schema',
  name: 'project_brief',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'difficulty', 'timeline', 'description', 'jobs', 'skills'],
    properties: {
      title: {
        type: 'string',
        minLength: 4,
        maxLength: 64,
        pattern: '^[A-Za-z0-9-]+(?:\\s+[A-Za-z0-9-]+){0,3}$'
      },
      difficulty: {
        type: 'string',
        enum: ['Easy', 'Medium', 'Hard', 'Expert']
      },
      timeline: {
        type: 'string',
        minLength: 3,
        maxLength: 24,
        pattern: '^[0-9]+(?:-[0-9]+)?\\s?(?:week|weeks|month|months)$'
      },
      description: { type: 'string', minLength: 30 },
      jobs: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'url'],
          properties: {
            title: { type: 'string', minLength: 5 },
            url: { type: 'string', minLength: 6 }
          }
        }
      },
      skills: {
        type: 'array',
        minItems: 4,
        maxItems: 12,
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 40,
          pattern: '^[A-Za-z0-9][A-Za-z0-9\\-/ ]{0,39}$'
        }
      }
    }
  },
  strict: true
} as const;

function buildPrompt({ interests, tags }: { interests: string; tags: string[] }) {
  const focus = interests ? interests.trim() : '';
  const tagList = tags.filter(Boolean);

  const interestSection = focus ? `Primary interests or goals:\n${focus}\n` : '';
  const tagSection = tagList.length
    ? `Key focus tags:\n${tagList.map((tag) => `- ${tag}`).join('\n')}\n`
    : '';

  const guidance =
    `Generate a single standout technical project tailored to the candidate. ` +
    `Align it closely with the interests, highlight relevant industry context, and ensure it feels ` +
    `practical to execute within 4-8 weeks. Include concrete deliverables, measurable outcomes, and ` +
    `references to real-world tools or datasets when possible.`;

  return [
    guidance,
    interestSection,
    tagSection,
    'Follow these additional rules:',
    '- Title must be four words or fewer, composed only of descriptive technical terms (letters, numbers, hyphen). No branding, marketing, or suffixes.',
    '- Title must be four words or fewer. Keep it punchy and branded.',
    '- Difficulty must be one of: Easy, Medium, Hard, Expert.',
    '- Timeline must be a short estimate like "4-6 weeks" or "2 months". Do not exceed four words.',
    '- Jobs array should list real or plausible job titles. Provide the best guess URLs if unknown.',
    '- Skills list should cover technologies, methodologies, or frameworks needed.',
    '- Skills must be concise (≤40 chars), alphanumeric with optional spaces, hyphen, or slash. Avoid punctuation like colons or parentheses.',
    '- Description should read like a concise brief (3-5 sentences) and must NOT mention timeframes or duration.',
    '- Do not include markdown, commentary, or explanations outside of the JSON response.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

function createOpenAI() {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function generateProjectWithOpenAI(input: { interests: string; tags: string[] }) {
  const client = createOpenAI();
  if (!client) {
    return {
      project: FALLBACK_PROJECT,
      source: 'fallback' as const,
      errorMessage: 'OPENAI_API_KEY missing'
    };
  }

  const prompt = buildPrompt(input);

  try {
    const response = await client.responses.create({
      model: 'gpt-5-nano-2025-08-07',
      instructions:
        'You are an expert career mentor generating project briefs. Always respond with valid JSON.',
      input: prompt,
      text: { format: PROJECT_SCHEMA }
    });

    const output = response.output_text;
    if (!output) throw new Error('No content returned from model');

    const parsed = JSON.parse(output) as Project;
    if (!isProject(parsed)) throw new Error('Model response did not match expected schema');

    return { project: parsed, source: 'generated' as const, errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { project: FALLBACK_PROJECT, source: 'fallback' as const, errorMessage: message };
  }
}

/* --------------------------- Auth/Credits gate --------------------------- */

type GateOk = {
  ok: true;
  userId: string | null; // null when auth not required
  credits: number | null; // null when credits not required
  supabase: ReturnType<typeof createSupabaseServerClient>;
  deductOne: () => Promise<number | null>; // returns remaining credits or null when not enforced
};

type GateBlocked = { ok: false; response: Response };

async function gateUserAndCredits(cookies): Promise<GateOk | GateBlocked> {
  const supabase = createSupabaseServerClient(cookies);

  // If we don't require auth, we still instantiate supabase for DB access,
  // but we won't check user or credits.
  if (!REQUIRE_AUTH && !REQUIRE_CREDITS) {
    return {
      ok: true,
      userId: null,
      credits: null,
      supabase,
      deductOne: async () => null
    };
  }

  // Auth check (if required)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (REQUIRE_AUTH && (userError || !user?.id)) {
    return {
      ok: false,
      response: json(
        { message: 'Sign in to claim your free project credit (0 / 1 credits).' },
        { status: 401 }
      )
    };
  }

  const userId = user?.id ?? null;

  // Credits check (if required)
  if (!REQUIRE_CREDITS) {
    return {
      ok: true,
      userId,
      credits: null,
      supabase,
      deductOne: async () => null
    };
  }

  // Fetch or provision credits
  const { data: row, error: fetchErr } = await supabase
    .from('users')
    .select('credits')
    .eq('user_id', userId!)
    .maybeSingle();

  if (fetchErr) {
    console.error('Failed to fetch user credits', fetchErr);
    return { ok: false, response: error(500, 'Unable to check credits') as unknown as Response };
  }

  let credits = typeof row?.credits === 'number' ? row.credits : null;

  // Provision row if missing
  if (row === null) {
    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert({ user_id: userId, credits: INITIAL_CREDITS })
      .select('credits')
      .single();

    if (insertErr) {
      if ((insertErr as any).code === '23505') {
        const { data: existing } = await supabase
          .from('users')
          .select('credits')
          .eq('user_id', userId!)
          .single();
        credits = existing?.credits ?? 0;
      } else {
        console.error('Failed to provision initial credits', insertErr);
        return { ok: false, response: error(500, 'Unable to prepare credits') as unknown as Response };
      }
    } else {
      credits = inserted?.credits ?? 0;
    }
  }

  if (!credits || credits <= 0) {
    return {
      ok: false,
      response: json(
        { message: 'You are out of credits. Visit your profile to review your balance.' },
        { status: 402 }
      )
    };
  }

  // Provide a deduct function to call only on success
  const deductOne = async () => {
    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update({ credits: credits! - 1 })
      .eq('user_id', userId!)
      .select('credits')
      .single();

    if (updateErr) {
      console.error('Failed to deduct credit', updateErr);
      return (credits! - 1); // best-effort local math
    }
    return typeof updated?.credits === 'number' ? updated.credits : credits! - 1;
  };

  return { ok: true, userId, credits, supabase, deductOne };
}

/* --------------------------------- Handler --------------------------------- */

export const POST: RequestHandler = async ({ request, cookies }) => {
  // Parse input
  let payload: { interests?: unknown; tags?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const interests = typeof payload.interests === 'string' ? payload.interests : '';
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter((t): t is string => typeof t === 'string')
    : [];

  if (!interests.trim() && tags.length === 0) {
    throw error(400, 'Provide interests or tags to generate a project');
  }

  // const gate = await gateUserAndCredits(cookies);
  // if (!gate.ok) return gate.response;

  const { project, source, errorMessage } = await generateProjectWithOpenAI({ interests, tags });

  // let remainingCreditsHeader: string | undefined;
  // if (REQUIRE_CREDITS) {
  //   const remaining = await gate.deductOne();
  //   if (typeof remaining === 'number') {
  //     remainingCreditsHeader = String(Math.max(remaining, 0));
  //   }
  // } else if (gate.credits != null) {
  //   // If we had a number (rare when REQUIRE_CREDITS=false), send what we saw
  //   remainingCreditsHeader = String(gate.credits);
  // }

  const headers: Record<string, string> = {
    'x-vector-project-source': source
  };
  // if (remainingCreditsHeader) headers['x-vector-user-credits'] = remainingCreditsHeader;
  if (source === 'fallback' && errorMessage) {
    headers['x-vector-project-error'] = encodeURIComponent(errorMessage);
  }

  return json(project, { headers });
};
