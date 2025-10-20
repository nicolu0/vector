import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
// If your exported types are still the old schema, avoid importing them here.
// import { isProject, type Project } from '$lib/types/project';
import sampleProject from '$lib/mock/project.sample.json';

/* ---------- Local types for the NEW schema (decoupled from old app types) ---------- */

type Deliverable = {
  task: string;
  spec: string;
  implementation: string[];
  code: string;
};

type LearningMaterial = {
  title: string;
  body: string;
};

type Section = {
  name: string;
  overview: string;
  deliverables: Deliverable[];
  learning_materials: LearningMaterial[];
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
    if (!p ||
        typeof p.title !== 'string' ||
        typeof p.difficulty !== 'string' ||
        typeof p.timeline !== 'string' ||
        typeof p.description !== 'string' ||
        !Array.isArray(p.jobs) ||
        !Array.isArray(p.skills) ||
        !Array.isArray(p.metadata)) {
      return false;
    }

    // Validate jobs
    const allJobsValid = p.jobs.every((job: unknown) => {
      if (!job || typeof job !== 'object') return false;
      const { title, url } = job as Record<string, unknown>;
      return typeof title === 'string' && typeof url === 'string';
    });

    if (!allJobsValid) return false;

    // Validate skills
    const allSkillsValid = p.skills.every((skill: unknown) => typeof skill === 'string');
    if (!allSkillsValid) return false;

    // Validate metadata sections
    const allSectionsValid = p.metadata.every((section: unknown) => {
      if (!section || typeof section !== 'object') return false;
      const { name, overview, deliverables, learning_materials } = section as Record<string, unknown>;

      if (typeof name !== 'string' || typeof overview !== 'string') return false;

      if (!Array.isArray(deliverables)) return false;
      if (!Array.isArray(learning_materials)) return false;

      // Validate deliverables
      const allDeliverablesValid = deliverables.every((deliverable: unknown) => {
        if (!deliverable || typeof deliverable !== 'object') return false;
        const { task, spec, implementation, code } = deliverable as Record<string, unknown>;
        return (
          typeof task === 'string' &&
          typeof spec === 'string' &&
          Array.isArray(implementation) &&
          implementation.every((item: unknown) => typeof item === 'string') &&
          typeof code === 'string'
        );
      });

      // Validate learning materials
      const allLearningMaterialsValid = learning_materials.every((material: unknown) => {
        if (!material || typeof material !== 'object') return false;
        const { title, body } = material as Record<string, unknown>;
        return typeof title === 'string' && typeof body === 'string';
      });

      return allDeliverablesValid && allLearningMaterialsValid;
    });

    return allSectionsValid;
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
          required: ['name', 'overview', 'deliverables', 'learning_materials'],
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 120 },
            overview: { type: 'string', minLength: 12, maxLength: 1200 },
            deliverables: {
              type: 'array',
              minItems: 0,
              maxItems: 40,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['task', 'spec', 'implementation', 'code'],
                properties: {
                  task: { type: 'string', minLength: 1, maxLength: 200 },
                  spec: { type: 'string', minLength: 4, maxLength: 1200 },
                  implementation: {
                    type: 'array',
                    minItems: 0,
                    maxItems: 20,
                    items: { type: 'string', minLength: 2, maxLength: 400 }
                  },
                  code: { type: 'string', minLength: 1, maxLength: 20000 }
                }
              }
            },
            learning_materials: {
              type: 'array',
              minItems: 0,
              maxItems: 40,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'body'],
                properties: {
                  title: { type: 'string', minLength: 1, maxLength: 200 },
                  body: { type: 'string', minLength: 4, maxLength: 2000 }
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
    const focus = (interests ?? "").trim();
    const tagList = (tags ?? []).filter(Boolean);
  
    const interestSection = focus ? `Primary interests or goals:\n${focus}\n` : "";
    const tagSection = tagList.length
      ? `Key focus tags:\n${tagList.map((t) => `- ${t}`).join("\n")}\n`
      : "";
  
    const guidance = [
      "Generate ONE standout technical project tailored to the candidate.",
      "Quality bars: concrete deliverables, measurable outcomes, and realistic tools/datasets."
    ].join(" ");
  
    // Updated rules aligned to PROJECT_SCHEMA (project_brief_v2)
    const rules = [
      "Title: ≤7 words, descriptive technical terms only. Allowed chars: letters, numbers, +, -, spaces.",
      'Difficulty: exactly one of: "Easy", "Medium", "Hard", "Expert".',
      'Timeline: short estimate like "1-2 weeks" (weeks or months only). Pattern: `[0-9]+(-[0-9]+)? (week|weeks|month|months)`.',
      "Description: concise high-level overview (3-5 sentences) that does NOT mention timeframes or duration.",
      "Jobs: array of 1-6 realistic job titles with best-guess URLs (objects with { title, url }).",
      "Skills: array of 3-12 specific technical concepts (1-5 words each). Include tech stack items (e.g., \"C++\", \"Regex\", \"BPE\").",
      "Metadata: an ARRAY of sections (1-20). Each section MUST include:",
      "  - name (string) and overview (paragraph).",
      "  - deliverables: array of 0-40 items; EACH item is an object with:",
      "      { task, spec, implementation, code }",
      "      • task: string",
      "      • spec: string",
      "      • implementation: string[] of concrete steps",
      "      • code: STRING containing code (no markdown fences).",
      "  - learning_materials: array of 0-40 items; EACH item is an object { title, body }.",
      "No extra keys beyond the schema (no prerequisites, no milestones, no notes).",
      "Output strictly valid JSON per the schema. No markdown, no comments, no explanations."


    ].join("\n- ");

    const example = `
Example (schema-compliant JSON; your output must be JSON only, no markdown). The example only shows one project section, but you should generate a full project with multiple sections:

{
  "title": "C++ Orderbook with Advanced Order Types",
  "difficulty": "Medium",
  "timeline": "1-2 weeks",
  "description": "This project focuses on implementing a multi-order type order book from scratch using C++. An order book is a central component in financial exchanges, responsible for matching buy and sell orders. The orderbook will support various order types, going beyond the standard Good Till Cancel orders to include Fill and Kill orders.",
  "jobs": [
    { "title": "Machine Learning Engineer — NLP (Intern/Entry)", "url": "https://example.com/jobs/ml-nlp-intern" },
    { "title": "Research Engineer — Tokenization/Preprocessing", "url": "https://example.com/jobs/research-engineer-tokenization" },
    { "title": "Data Engineer — Text Processing", "url": "https://example.com/jobs/data-engineer-text" }
  ],
  "skills": [
    "C++ fundamentals",
    "Algorithms and data structures",
    "Object-oriented programming",
    "Orderbook mechanics",
    "Pointers and memory management"
  ],
  "metadata": [
    {
        "name": "2. Constants",
        "overview": "Centralize sentinel values used throughout the engine (e.g., an invalid price) in a tiny header so all components share a single source of truth.",
        "deliverables": [
            {
            "task": "include/Constants.h",
            "spec": "Expose project-wide constant(s) such as an invalid price sentinel to indicate an unset or unusable value.",
            "implementation": [
                "Create a lightweight header with \`#pragma once\` so it's safe to include anywhere.",
                "Include the aliases header first (for \`Price\`) and then \`<limits>\` to access \`std::numeric_limits<T>\`.",
                "Follow the repository style by defining a small holder type (e.g., a \`struct Constants\`) and declaring the sentinel as a \`static\` class data member.",
                "Use \`std::numeric_limits<Price>::quiet_NaN()\` exactly as in the repository for the invalid price sentinel (note: this mirrors the repo even though NaN is only meaningful for floating-point types).",
                "Keep dependencies minimal and avoid introducing additional includes beyond \`\"Usings.h\"\` and \`<limits>\`."
            ],
            "code": "#pragma once\n\n#include <limits>\n\n#include \"Usings.h\"\n\nstruct Constants\n{\n    static const Price InvalidPrice = std::numeric_limits<Price>::quiet_NaN();\n};\n"
            }
        ],
        "learning_materials": [
            {
            "title": "Overall goal: one, shared contract for “invalid” values",
            "body": "By defining a single sentinel in one header, the entire codebase checks for invalid or unset prices the same way. This avoids scattered magic numbers (e.g., -1 in one module, 0 in another), makes intent obvious at call sites, and turns future refactors into a one-line change."
            },
            {
            "title": "When (and when not) to use NaN as a sentinel",
            "body": "NaN is ideal for floating-point sentinels because arithmetic with NaN propagates and equality checks fail, making accidental use obvious. However, NaN does not exist for integral types. The repository mirrors a NaN-style pattern for \`Price\` even though \`Price\` is integral; understand this is for fidelity with the repo rather than semantic correctness. If you adopt floating-point prices later, prefer \`std::isnan()\` over \`==\` comparisons."
            },
            {
            "title": "Practical alternatives for integral sentinels",
            "body": "If \`Price\` remains integral, consider: (1) reserving a domain-outside value (e.g., \`std::numeric_limits<Price>::min()\`), (2) wrapping in a tagged type with an explicit validity bit, or (3) using \`std::optional<Price>\` where absence is meaningful. These approaches preserve type correctness without relying on floating-point semantics."
            },
            {
            "title": "Header-only constants without linker headaches",
            "body": "Static data members in headers can trigger ODR issues. If you broaden usage, prefer \`inline\` variables (C++17) for header-defined constants, or move the definition to a \`.cpp\` file. For this project, we mirror the repository's header-only style; if you hit multiple-definition errors, add \`inline\` or refactor to an out-of-line definition."
            },
            {
            "title": "Comparison patterns and test strategy",
            "body": "Centralize all invalid-price checks on \`Constants::InvalidPrice\` (or a helper function) to keep behavior consistent. Add tests that confirm the sentinel is distinct from all valid inputs, that order creation/matching rejects or converts sentinel-priced orders as expected, and that any serialization/deserialization preserves and recognizes the sentinel."
            },
            {
            "title": "Keep foundations lean",
            "body": "This header is included by core types. Limiting includes to \`\"Usings.h\"\` and \`<limits>\` keeps compile times down and avoids dependency tangles. Avoid adding heavy headers (I/O, formatting) to foundational files."
            }
        ]
    }
  ]
}
`.trim();
  
    return [guidance, interestSection, tagSection, "Follow these additional rules:", `- ${rules}`, "Follow this example:", `- ${example}`]
      .filter(Boolean)
      .join("\n\n");
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
//   return { project: FALLBACK_PROJECT, source: 'generated' as const, errorMessage: null };

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
    // console.log(`Project generation output: ${output}`);
    if (!output) throw new Error('No content returned from model');

    const parsed = JSON.parse(output) as unknown;

    // console.log(`Project generation parsed: ${JSON.stringify(parsed)}`);

    // If you have updated `$lib/types/project` to the new shape, you can swap in that guard.
    if (!isNewProject(parsed)) throw new Error('Model response did not match expected schema');

    return { project: parsed as NewProject, source: 'generated' as const, errorMessage: null };
  } catch (err) {
    console.error(err);
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
//   console.log(`Project generation result: ${JSON.stringify({ project, source, errorMessage })}`);

  const headers: Record<string, string> = { 'x-vector-project-source': source };
  if (source === 'fallback' && errorMessage) {
    headers['x-vector-project-error'] = encodeURIComponent(errorMessage);
  }

  return json(project, { headers });
};
