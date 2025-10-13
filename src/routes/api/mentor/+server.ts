// src/routes/api/mentor/+server.ts
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { createSkillEngine } from '$lib/skill-engine';

const MODEL_ID = 'gpt-5-nano-2025-08-07';

// JSON Schema for text.format (no oneOf/anyOf; single object w/ enum + optional fields)
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

// Narrow action at runtime since schema can’t enforce conditional fields
function validateAction(a: any):
	| { type: 'none'; note?: string }
	| { type: 'assess_skills'; topics: string[]; note?: string }
	| { type: 'update_ratings'; ratings: { topic: string; rating: number; confidence?: number }[]; note?: string }
	| { type: 'recommend_skills'; topics: string[]; note?: string } {
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

export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = locals.supabase;
	const user = locals.user;
	if (!supabase || !user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid JSON' }, { status: 400 });

	// server-side before calling the model
	const { data: ratings } = await supabase
		.from('user_ratings')
		.select('topic,rating,confidence')
		.eq('user_id', user.id);

	const { project, messages } = body as {
		project: { title: string; description: string; skills?: string[] };
		messages: Array<{ role: 'user' | 'mentor'; content: string }>;
	};
	if (!project || !messages?.length) return json({ error: 'Missing project/messages' }, { status: 400 });

	const client = new OpenAI({ apiKey: OPENAI_API_KEY });

	const system = [
		'You are the Mentor for a tiny Python game project on a learning platform.',
		'NORTH STAR: guide the learner to finish the project end-to-end.',
		'ADAPTIVITY: diagnose their current skill; if a prerequisite is missing, teach it first.',
		'PACE: one precise next step at a time; keep replies short and focused.',
		'FORMAT: reference files, functions, modules, and checks — not code dumps.',
		'HARD RULES:',
		'- Do NOT provide copy-pasteable code or shell commands.',
		'- Do NOT use fenced code blocks or multi-line code-like snippets.',
		'- Keep content concrete: “create file X”, “add function Y with purpose Z”, “verify by …”.',
		'ASSESS/UPDATE SKILLS:',
		'- When you probe knowledge, set action: { type: "assess_skills", topics: [...] }.',
		'- When skill is demonstrated/learned, set action: { type: "update_ratings", ratings: [{ topic, rating, confidence }] }.',
		'- You may recommend topics with { type: "recommend_skills", topics: [...] }.',
		'OUTPUT: Return ONLY JSON that matches the provided schema.',
	].join('\n');

	const prompt = [
		`Project: ${project.title}`,
		project.description,
		project.skills?.length ? `Skills: ${project.skills.join(', ')}` : '',
		`Use the user's current skill ratings: ${JSON.stringify(ratings ?? [])}`,
		'Adjust your pace and material that you cover to help the user fill skills that are lacking and complete the project',
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

		const parsed = JSON.parse(out) as {
			title: string;
			content: string;
			action: any;
		};

		const action = validateAction(parsed.action);

		// Execute Skill Engine action under caller’s session (RLS applies)
		const engine = createSkillEngine(supabase);
		const exec = await engine.executeAction(user.id, action);

		// Return the same (validated) action so the client can display what happened
		return json(
			{ title: parsed.title, content: parsed.content, action: exec.action },
			{ status: 200 }
		);
	} catch (e) {
		console.error('mentor endpoint error:', e);
		return json(
			{
				title: 'Continue',
				content: 'Something went wrong. Tell me your next question about the task.',
				action: { type: 'none' as const }
			},
			{ status: 200 }
		);
	}
};
