// src/routes/api/mentor/+server.ts
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { createSkillEngine } from '$lib/skill-engine';

const MODEL_ID = 'gpt-5-nano-2025-08-07';

const MENTOR_SCHEMA = {
	type: 'json_schema',
	name: 'mentor_message',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['title', 'content', 'action'],
		properties: {
			title: { type: 'string', minLength: 1, maxLength: 80 },
			content: { type: 'string', minLength: 1, maxLength: 600 },
			action: {
				type: 'object',
				additionalProperties: false,
				required: ['type', 'note', 'topics', 'ratings'],
				properties: {
					type: { type: 'string', enum: ['none', 'assess_skills', 'update_ratings', 'recommend_skills'] },
					note: { type: 'string' },
					topics: {
						type: 'array',
						minItems: 1,
						items: { type: 'string', minLength: 1, maxLength: 64 }
					},
					ratings: {
						type: 'array',
						minItems: 1,
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['topic', 'rating', 'confidence'],
							properties: {
								topic: { type: 'string', minLength: 1, maxLength: 64 },
								rating: { type: 'number', minimum: 0, maximum: 5 },
								confidence: { type: 'number', minimum: 0, maximum: 1 }
							}
						}
					}
				}
			}
		}
	}
} as const;

/* ---------------- Canonical topics used by the Skill Engine ------------------- */
const CANONICAL: Record<string, string> = {
	python: 'py.basics.syntax',
	syntax: 'py.basics.syntax',
	functions: 'py.basics.functions',
	classes: 'py.basics.classes',
	venv: 'py.env.venv',
	'virtual env': 'py.env.venv',
	pip: 'py.pkg.pip',
	pygame: 'py.graphics.pygame',
	'game loop': 'py.game.loop',
	loop: 'py.game.loop',
	timing: 'py.timing.fps',
	fps: 'py.timing.fps',
	keyboard: 'py.input.keyboard',
	input: 'py.input.keyboard',
	'file structure': 'py.project.layout',
	layout: 'py.project.layout'
};
function canonicalize(t: string) {
	const k = String(t ?? '').trim().toLowerCase();
	return CANONICAL[k] ?? t;
}

/* ----------------------------- Types & helpers -------------------------------- */
type Rating = { topic: string; rating: number; confidence: number };
type MentorAction =
	| { type: 'none'; note?: string }
	| { type: 'assess_skills'; topics: string[]; note?: string }
	| { type: 'update_ratings'; ratings: Rating[]; note?: string }
	| { type: 'recommend_skills'; topics: string[]; note?: string };

function validateAction(a: any): MentorAction {
	if (!a || typeof a !== 'object') return { type: 'none' as const };
	switch (a.type) {
		case 'assess_skills':
		case 'recommend_skills':
			return Array.isArray(a.topics) && a.topics.length ? a : { type: 'none' as const };
		case 'update_ratings':
			return Array.isArray(a.ratings) && a.ratings.length ? a : { type: 'none' as const };
		case 'none':
		default:
			return { type: 'none' as const, note: a?.note };
	}
}

/* --------------------------------- Handler ----------------------------------- */
export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = locals.supabase;
	const user = locals.user;
	if (!supabase || !user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid JSON' }, { status: 400 });

	const { project, messages } = body as {
		project: { title: string; description: string; skills?: string[] };
		messages: Array<{ role: 'user' | 'mentor'; content: string }>;
	};
	if (!project || !messages?.length) return json({ error: 'Missing project/messages' }, { status: 400 });

	// Pull current ratings to adapt tone/explanations (but DO NOT gate progress)
	const { data: ratingsData } = await supabase
		.from('user_ratings')
		.select('topic,rating,confidence')
		.eq('user_id', user.id);

	const currentRatings: Rating[] = (ratingsData ?? []).map((r: any) => ({
		topic: canonicalize(r.topic),
		rating: Number(r.rating) || 0,
		confidence: typeof r.confidence === 'number' ? r.confidence : 0.6
	}));

	const client = new OpenAI({ apiKey: OPENAI_API_KEY });

	/* -------------------------- Mentor personality/policy ----------------------- */
	const system = [
		'You are the Mentor for a tiny Python game project on a learning platform.',
		'NORTH STAR: guide the learner to FINISH the project end-to-end.',
		'START NOW: begin with the practical implementation setup immediately (no separate diagnostic phase).',
		'ADAPTIVITY: if the learner’s message shows confusion or missing prerequisite, briefly teach that specific concept and continue.',
		'PACE: one precise next step at a time; keep replies short and focused.',
		'',
		'NO-CODE POLICY:',
		'- Do NOT provide copy-pasteable code or shell commands.',
		'- Do NOT use fenced code blocks or multi-line code-like snippets.',
		'INSTEAD, reference files, functions, modules, and simple verification checks.',
		'',
		'STRUGGLE DETECTION → RATINGS:',
		'- Interpret natural language as skill evidence and update ratings when appropriate.',
		'- Examples → update_ratings:',
		'  • “what’s venv?” → [{ topic: "py.env.venv", rating: 0, confidence: 0.8 }]',
		'  • “never used pygame” → [{ topic: "py.graphics.pygame", rating: 1, confidence: 0.7 }]',
		'  • “kinda know pip” → [{ topic: "py.pkg.pip", rating: 2, confidence: 0.6 }]',
		'  • “comfortable with game loops” → [{ topic: "py.game.loop", rating: 4, confidence: 0.6 }]',
		'  • “I shipped a pygame app” → [{ topic: "py.graphics.pygame", rating: 5, confidence: 0.7 }]',
		'- If you need a single clarifying check, you may use action { "type": "assess_skills", "topics": [...] } sparingly.',
		'- Otherwise, prefer { "type": "none" } when no rating change is warranted.',
		'',
		'OUTPUT FORMAT: Return ONLY JSON that matches the schema (title, content, action).',
		'TITLE = the specific thing the user is doing now (e.g., “Create project folder”, “Initialize event loop”).'
	].join('\n');

	const prompt = [
		`Project: ${project.title}`,
		project.description,
		project.skills?.length ? `Skills: ${project.skills.join(', ')}` : '',
		'',
		'Known ratings (use to adapt tone/level; do not gate progress):',
		JSON.stringify(currentRatings),
		'',
		'Conversation:',
		...messages.map((m) => `${m.role === 'mentor' ? 'Mentor' : 'User'}: ${m.content}`)
	].join('\n');

	try {
		const res = await client.responses.create({
			model: MODEL_ID,
			instructions: system,
			input: prompt,
			text: { format: MENTOR_SCHEMA }
		});

		const out = (res.output_text ?? '').trim();
		if (!out) return json({ error: 'Empty model response' }, { status: 502 });

		const parsed = JSON.parse(out) as { title: string; content: string; action: any };
		const action = validateAction(parsed.action);

		// Execute the Skill Engine action under the caller’s session (RLS applies)
		const engine = createSkillEngine(supabase);
		const exec = await engine.executeAction(user.id, action);

		return json(
			{
				title: parsed.title,
				content: parsed.content,
				action: exec.action,    // echo what actually ran
				result: exec.result ?? null
			},
			{ status: 200 }
		);
	} catch (e) {
		console.error('mentor endpoint error:', e);
		return json(
			{
				title: 'Continue',
				content: 'Something went wrong. What would you like to do next?',
				action: { type: 'none' as const },
				result: null
			},
			{ status: 200 }
		);
	}
};
