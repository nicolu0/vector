import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { isProject, type Project } from '$lib/types/project';
import sampleProject from '$lib/mock/project.sample.json';
import { createSupabaseServerClient } from '$lib/server/supabase';

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

const FALLBACK_PROJECT = sampleProject as Project;

function createOpenAI() {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function buildPrompt({ interests, tags }: { interests: string; tags: string[] }) {
  const focus = interests ? interests.trim() : '';
  const tagList = tags.filter(Boolean);

  const interestSection = focus ? `Primary interests or goals:\n${focus}\n` : '';
  const tagSection = tagList.length
    ? `Key focus tags:\n${tagList.map((tag) => `- ${tag}`).join('\n')}\n`
    : '';

  const guidance = `Generate a single standout technical project tailored to the candidate. ` +
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

export const POST: RequestHandler = async ({ request, cookies }) => {
  let payload: { interests?: unknown; tags?: unknown };

  try {
    payload = await request.json();
  } catch (err) {
    throw error(400, 'Invalid JSON body');
  }

  const interests = typeof payload.interests === 'string' ? payload.interests : '';
  const tags = Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === 'string') : [];

  if (!interests.trim() && tags.length === 0) {
    throw error(400, 'Provide interests or tags to generate a project');
  }

  const supabase = createSupabaseServerClient(cookies);
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return json(
      { message: 'Sign in to claim your free project credit (0 / 1 credits).' },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  const { data: userRow, error: userFetchError } = await supabase
    .from('users')
    .select('credits')
    .eq('user_id', userId)
    .maybeSingle();

  if (userFetchError) {
    console.error('Failed to fetch user credits', userFetchError);
    throw error(500, 'Unable to check credits');
  }

  let credits = typeof userRow?.credits === 'number' ? userRow.credits : null;

  if (userRow === null) {
    const { data: insertedRow, error: insertError } = await supabase
      .from('users')
      .insert({ user_id: userId, credits: 1 })
      .select('credits')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: existingRow } = await supabase
          .from('users')
          .select('credits')
          .eq('user_id', userId)
          .single();
        credits = existingRow?.credits ?? 0;
      } else {
        console.error('Failed to provision initial credits', insertError);
        throw error(500, 'Unable to prepare credits');
      }
    } else {
      credits = insertedRow?.credits ?? 0;
    }
  }

  if (!credits || credits <= 0) {
    return json(
      { message: 'You are out of credits. Visit your profile to review your balance.' },
      { status: 402 }
    );
  }

  const client = createOpenAI();
  if (!client) {
    console.warn('OPENAI_API_KEY missing; returning fallback project.');
    return json(FALLBACK_PROJECT, {
      headers: {
        'x-vector-project-source': 'fallback',
        'x-vector-user-credits': String(credits)
      }
    });
  }
  const prompt = buildPrompt({ interests, tags });

  try {
    const response = await client.responses.create({
      model: 'gpt-5-nano-2025-08-07',
      instructions:
        'You are an expert career mentor generating project briefs. Always respond with valid JSON.',
      input: prompt,
      text: {
        format: PROJECT_SCHEMA
      }
    });

    const output = response.output_text;

    if (!output) {
      throw new Error('No content returned from model');
    }

    let project: Project;
    try {
      project = JSON.parse(output) as Project;
    } catch (err) {
      throw new Error('Model response was not valid JSON');
    }

    if (!isProject(project)) {
      throw new Error('Model response did not match expected schema');
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from('users')
      .update({ credits: credits - 1 })
      .eq('user_id', userId)
      .select('credits')
      .single();

    if (updateError) {
      console.error('Failed to deduct credit', updateError);
    }

    const remainingCredits = typeof updatedRow?.credits === 'number' ? updatedRow.credits : credits - 1;

    const validatedProject: Project = project;
    return json(validatedProject, {
      headers: {
        'x-vector-project-source': 'generated',
        'x-vector-user-credits': String(Math.max(remainingCredits, 0))
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to generate project, serving fallback.', err);
    return json(FALLBACK_PROJECT, {
      headers: {
        'x-vector-project-source': 'fallback',
        'x-vector-project-error': encodeURIComponent(message)
      }
    });
  }
};
