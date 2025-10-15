import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
// If your exported types are still the old schema, avoid importing them here.
// import { isProject, type Project } from '$lib/types/project';
import sampleProject from '$lib/mock/project.sample.json';

/* ---------- Local types for the NEW schema (decoupled from old app types) ---------- */

type WhatAndHow = {
  file: string;
  spec: string;
  how_to_implement?: string[];
};

type Section = {
  name: string;
  overview: string;
  learning_materials?: string[];
  code_snippets?: string[] | Array<{ filename?: string; code?: string }>;
  what_and_how?: WhatAndHow[];
};

type NewProject = {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  timeline: string;
  description: string;
  jobs: Array<{ title: string; url: string }>;
  skills: string[];
  metadata: Section[];
};

function isNewProject(x: unknown): x is NewProject {
  try {
    const p = x as NewProject;
    return (
      p &&
      typeof p.title === 'string' &&
      typeof p.difficulty === 'string' &&
      typeof p.timeline === 'string' &&
      typeof p.description === 'string' &&
      Array.isArray(p.jobs) &&
      Array.isArray(p.skills) &&
      Array.isArray(p.metadata) &&
      p.metadata.every(
        s => s && typeof s.name === 'string' && typeof s.overview === 'string'
      )
    );
  } catch {
    return false;
  }
}

/* ---------- Fallback (ensure your sample matches NEW schema) ---------- */
const FALLBACK_PROJECT = sampleProject as unknown as NewProject;

/* ---------- JSON Schema for the NEW shape ---------- */
const PROJECT_SCHEMA = {
  type: 'json_schema',
  name: 'project_brief_v2',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'difficulty', 'timeline', 'description', 'jobs', 'skills', 'metadata'],
    properties: {
      title: {
        type: 'string',
        minLength: 4,
        maxLength: 64,
        pattern: '^[A-Za-z0-9+\\-]+(?:\\s+[A-Za-z0-9+\\-]+){0,3}$'
      },
      difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard', 'Expert'] },
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
        minItems: 3,
        maxItems: 12,
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 40,
          pattern: '^[A-Za-z0-9][A-Za-z0-9+\\-/ ]{0,50}$'
        }
      },
      // NEW: metadata is an ARRAY of sections
      metadata: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'overview'],
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 120 },
            overview: { type: 'string', minLength: 12, maxLength: 1200 },
            learning_materials: {
              type: 'array',
              minItems: 0,
              maxItems: 40,
              items: { type: 'string', minLength: 4, maxLength: 300 }
            },
            code_snippets: {
              type: 'array',
              minItems: 0,
              maxItems: 40,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  filename: { type: 'string', minLength: 1, maxLength: 120 },
                  code: { type: 'string', minLength: 1, maxLength: 20000 }
                }
              }
            },
            what_and_how: {
              type: 'array',
              minItems: 0,
              maxItems: 40,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['file', 'spec'],
                properties: {
                  file: { type: 'string', minLength: 1, maxLength: 200 },
                  spec: { type: 'string', minLength: 4, maxLength: 1200 },
                  how_to_implement: {
                    type: 'array',
                    minItems: 0,
                    maxItems: 20,
                    items: { type: 'string', minLength: 2, maxLength: 400 }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  strict: true
} as const;

/* ---------- Prompt builder updated for NEW schema ---------- */

function buildPrompt({ interests, tags }: { interests: string; tags: string[] }) {
  const focus = (interests ?? '').trim();
  const tagList = (tags ?? []).filter(Boolean);

  const interestSection = focus ? `Primary interests or goals:\n${focus}\n` : '';
  const tagSection = tagList.length
    ? `Key focus tags:\n${tagList.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  const guidance = [
    'Generate ONE standout technical project tailored to the candidate.',
    'Quality bars: concrete deliverables, measurable outcomes, and realistic tools/datasets.'
  ].join(' ');

  const rules = [
    'Title: ≤4 words, descriptive technical terms only.',
    'Difficulty: one of Easy, Medium, Hard, Expert.',
    'Timeline: short estimate like "1-2 weeks". (Weeks or months only.)',
    'Description: a concise high level overview (3–5 sentences) that does NOT mention timeframes or duration.',
    'Jobs: 1–6 realistic job titles with best-guess URLs if unknown.',
    'Skills array: specific technical concepts (1–5 words each). Include tech stack items (e.g., "C++", "Regex", "BPE").',
    'Metadata: an ARRAY of sections. Each section MUST include:',
    '  - name (string) and overview (paragraph).',
    '  - Optional arrays: learning_materials, code_snippets (strings or {filename, code})',
    '  - Optional what_and_how: array of { file, spec, how_to_implement[] } describing implementation steps/files.',
    'No "prerequisites" key. No milestones.',
    'Output strictly valid JSON per the schema. No markdown, no extra keys, no explanations.'
  ].join('\n- ');

  return [guidance, interestSection, tagSection, 'Follow these additional rules:', `- ${rules}`]
    .filter(Boolean)
    .join('\n\n');
}

/* ---------- OpenAI client ---------- */

function createOpenAI() {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/* ---------- Generation ---------- */

async function generateProjectWithOpenAI(input: { interests: string; tags: string[] }) {
  // TEMP: short-circuit for local dev. Ensure FALLBACK_PROJECT matches the NEW schema.
  return { project: FALLBACK_PROJECT, source: 'generated' as const, errorMessage: null };

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

    const parsed = JSON.parse(output) as unknown;

    // If you have updated `$lib/types/project` to the new shape, you can swap in that guard.
    if (!isNewProject(parsed)) throw new Error('Model response did not match expected schema');

    return { project: parsed as NewProject, source: 'generated' as const, errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { project: FALLBACK_PROJECT, source: 'fallback' as const, errorMessage: message };
  }
}

/* ---------- Handler ---------- */

export const POST: RequestHandler = async ({ request }) => {
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

  const { project, source, errorMessage } = await generateProjectWithOpenAI({ interests, tags });

  const headers: Record<string, string> = { 'x-vector-project-source': source };
  if (source === 'fallback' && errorMessage) {
    headers['x-vector-project-error'] = encodeURIComponent(errorMessage);
  }

  return json(project, { headers });
};
