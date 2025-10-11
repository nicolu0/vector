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
      },
      prerequisites: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: {
          type: 'string',
          minLength: 6,
          maxLength: 80,
          pattern: '^[A-Za-z0-9][A-Za-z0-9\\-/&(),. ]{5,79}$'
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
    `references to real-world tools or datasets when possible. Provide structured mentor-ready metadata ` +
    `to underpin the guidance journey for this project.`;

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
    '- Skills array must capture the 4-12 core capabilities the learner will gain from completing the project. Focus on learnings, not prerequisites.',
    '- Skills must be concise (≤40 chars), alphanumeric with optional spaces, hyphen, or slash. Avoid punctuation like colons or parentheses.',
    '- Include a prerequisites array (2-6 items) covering the critical knowledge or tooling the learner must already possess before starting milestone one. Keep them short, concrete, and outcome-oriented.',
    '- Description should read like a concise brief (3-5 sentences) and must NOT mention timeframes or duration.',
    '- Include a metadata object with a milestones array (3-6 items). Each milestone needs a short name, a concise objective, and 2-3 success metrics describing observable learner achievements.',
    '- Ensure the final milestone explicitly captures the learner completing and delivering the project, including proof of readiness to showcase the work.',
    '- Milestones should progress logically—from setup and research, through build-out, to validation and final delivery—so mentors can track learner momentum.',
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
