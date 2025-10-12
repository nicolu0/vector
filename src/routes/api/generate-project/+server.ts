import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import {
  OPENAI_API_KEY,
} from '$env/static/private';
import type { RequestHandler } from './$types';
import { isProject, type Project } from '$lib/types/project';
import sampleProject from '$lib/mock/project.sample.json';

const FALLBACK_PROJECT = sampleProject as Project;


const PROJECT_SCHEMA = {
  type: 'json_schema',
  name: 'project_brief',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'difficulty',
      'timeline',
      'description',
      'jobs',
      'skills',
      'prerequisites',
      'metadata'
    ],
    properties: {
      title: {
        type: 'string',
        minLength: 4,
        maxLength: 64,
        pattern: '^[A-Za-z0-9+\\-]+(?:\\s+[A-Za-z0-9+\\-]+){0,3}$'
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
        minItems: 3,
        maxItems: 12,
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 40,
          pattern: '^[A-Za-z0-9][A-Za-z0-9+\\-/ ]{0,4}$'
        }
      },
      prerequisites: {
        type: 'array',
        minItems: 3,
        maxItems: 12,
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 80,
          pattern: '^[A-Za-z0-9][A-Za-z0-9+\\-/ ]{0,4}$'
        }
      },
      metadata: {
        type: 'object',
        additionalProperties: false,
        required: ['milestones'],
        properties: {
          milestones: {
            type: 'array',
            minItems: 3,
            maxItems: 6,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'objective', 'success_metrics'],
              properties: {
                name: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 80
                },
                objective: {
                  type: 'string',
                  minLength: 12,
                  maxLength: 240
                },
                success_metrics: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 3,
                  items: {
                    type: 'string',
                    minLength: 8,
                    maxLength: 160
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

function buildPrompt({ interests, tags }: { interests: string; tags: string[] }) {
  const focus = (interests ?? '').trim();
  const tagList = (tags ?? []).filter(Boolean);

  const interestSection = focus ? `Primary interests or goals:\n${focus}\n` : '';
  const tagSection = tagList.length
    ? `Key focus tags:\n${tagList.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  // Core guidance: one-feature, atomic skills, standardized milestones
  const guidance =
    [
      'Generate ONE standout technical project tailored to the candidate.',
      'Scope: single feature only, deliverable as a minimal working demo. No multi-part or stretch goals.',
      'Fit: assume the learner can complete it in 1 week.',
      'Quality bars: concrete deliverables, measurable outcomes, and realistic tools/datasets.',
    ].join(' ');

  const rules = [
    'Title: ≤4 words, descriptive technical terms only.',
    'Difficulty: one of Easy, Medium, Hard, Expert.',
    'Timeline: short estimate like "1-2 weeks". (Weeks or months only.)',
    'Description: a concise high level overview (3-5 sentences) that does NOT mention timeframes or duration.',
    'Jobs: 1–6 realistic job titles with best-guess URLs if unknown.',
    'Skills array: 3 atomic skills described in 1-5 words. At least one should be the tech stack: "C++". Example: "Threading". No vague tokens: basics, fundamentals.',
    'Prerequisites array: 3 prerequisite skills. Use the same atomic style. Example: "Matrix Multiplication"',
    'Milestones: EXACTLY 5 in this order and with these names — Introduction; Setup; Core Feature; Measure & Optimize; Conclusion.',
    'Each milestone must include: (a) objective (≤1 sentence) and (b) 2–3 success_metrics that are observable and testable (true/false style or concrete checks).',
    'Milestone semantics:',
    ' - Introduction: check knowledge of prerequisites. teach user if necessary. make sure all prerequisites are understood before continuing',
    ' - Setup: toolchain, repo, libraries. then give high level overview of what we will build. teach any new concepts before continuing.',
    ' - Core Feature: implement the single feature end-to-end. make sure concepts are understood and feature is built before continuing.',
    ' - Measure & Optimize: instrument ONE metric, apply ONE optimization, and report before/after.',
    ' - Conclusion: summarize concrete skills learned and include a measurable results sentence: "Increased <metric> by <Y>% via <Z>".',
    'Output strictly valid JSON per the schema. No markdown, no extra keys, no explanations.'
  ].join('\n- ');

  return [
    guidance,
    interestSection,
    tagSection,
    'Follow these additional rules:',
    `- ${rules}`
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
  // return { project: FALLBACK_PROJECT, source: 'generated' as const, errorMessage: null };
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

/* --------------------------------- Handler --------------------------------- */

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

  const headers: Record<string, string> = {
    'x-vector-project-source': source
  };
  if (source === 'fallback' && errorMessage) {
    headers['x-vector-project-error'] = encodeURIComponent(errorMessage);
  }

  return json(project, { headers });
};
