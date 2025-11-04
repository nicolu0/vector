import { error, json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

type PreviousTask = { title?: string; description?: string; outcome?: string; };
type TaskPayload = { endGoal: string; previousTask?: PreviousTask };
type DailyTask = { title: string; description: string; outcome: string };

const TASK_SCHEMA = {
	type: 'json_schema',
	name: 'daily_task_v1',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['title', 'description', 'outcome'],
		properties: {
			title: { type: 'string', minLength: 4, maxLength: 80 },
			description: { type: 'string', minLength: 40, maxLength: 800 },
			outcome: { type: 'string', minLength: 20, maxLength: 400 }
		}
	},
	strict: true
} as const;

const FALLBACK_TASK: DailyTask = {
	title: 'Rapid Skill Gap Review',
	description:
		'Spend 30 focused minutes identifying one concrete skill gap blocking progress toward the end goal. Review your recent work, jot down missing capabilities, and pick a single micro-skill to practice today. Draft a short action checklist and skim one reputable resource to guide the work.',
	outcome:
		'A prioritized micro-skill target, a checklist of immediate actions, and at least one vetted resource to reference during execution.'
};

const SYSTEM_INSTRUCTIONS =
	'You are an expert mentor who designs concise 30-minute skill-building tasks that help the user reach their goal.';

function isDailyTask(v: unknown): v is DailyTask {
	if (!v || typeof v !== 'object') return false;
	const r = v as Record<string, unknown>;
	return (
		typeof r.title === 'string' && r.title.trim() &&
		typeof r.description === 'string' && r.description.trim() &&
		typeof r.outcome === 'string' && r.outcome.trim()
	) as boolean;
}

function buildPrompt({ endGoal, previousTask }: TaskPayload) {
	const sections: string[] = [
		`Candidate end goal:\n${endGoal.trim() || 'Not provided. Infer a reasonable professional goal.'}`,
		'Current skill level summary:\nNot provided. Assume intermediate with notable gaps.',
		[
			'Task requirements:',
			'- Exactly one task that fits 30 focused minutes.',
			'- Close a skill gap and produce a tangible outcome.',
			'- Actionable steps; individual work; common online tools.'
		].join('\n'),
		[
			'Output format:',
			'- Return JSON only with keys: title, description, outcome.',
			'No prose outside JSON.'
		].join('\n')
	];
	if (previousTask) {
		const parts = [
			previousTask.title && `Title: ${previousTask.title}`,
			previousTask.description && `Description: ${previousTask.description}`,
			previousTask.outcome && `Outcome: ${previousTask.outcome}`
		].filter(Boolean);
		if (parts.length) sections.splice(2, 0, `Previous task details:\n${parts.join('\n')}`);
		sections[2] += '\n- Make today distinct and slightly more challenging.';
	}
	return sections.join('\n\n');
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	// Optional OAuth code exchange if this endpoint can be a redirect target
	const code = url.searchParams.get('code');
	if (code) {
		const supabase = createSupabaseServerClient(cookies);
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}

	// Parse payload
	let body: TaskPayload;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const endGoal = body.endGoal?.trim();
	if (!endGoal) throw error(400, 'Provide an end goal to generate a task');

	// Auth
	const supabase = createSupabaseServerClient(cookies);
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw error(401, 'Not signed in');

	// Model call (non-streaming)
	let task: DailyTask | null = null;
	if (OPENAI_API_KEY) {
		const client = new OpenAI({ apiKey: OPENAI_API_KEY });
		const resp = await client.responses.create({
			model: 'gpt-5-nano-2025-08-07',
			instructions: SYSTEM_INSTRUCTIONS,
			input: buildPrompt(body),
			text: { format: TASK_SCHEMA }, // server validates to schema
		});

		// Pull the JSON text response
		const txt = resp.output_text ?? '';
		try {
			const parsed = JSON.parse(txt);
			if (isDailyTask(parsed)) task = parsed;
		} catch {
			// fall through to fallback
		}
	}

	if (!task) task = FALLBACK_TASK;

	const { data: inserted, error: dberr } = await supabase
		.from('tasks')
		.insert({
			user_id: user.id,
			title: task.title,
			description: task.description,
			outcome: task.outcome
		})
		.select('id, title, description, outcome')
		.single();

	if (dberr) throw error(500, dberr.message);

	return json({ task: inserted });
};
