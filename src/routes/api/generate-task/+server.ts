import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

const SYSTEM_INSTRUCTIONS =
	'You are a precise mentor. Return exactly one 30-minute task that moves the user one step closer to the milestone. Be concrete, tool-agnostic when possible, and beginner-friendly but not patronizing. No fluff.';

const TASK_SCHEMA = {
	type: 'json_schema',
	name: 'daily_task_v1',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['title', 'goal'],
		properties: {
			title: { type: 'string', minLength: 4, maxLength: 20 },
			goal: { type: 'string', minLength: 40, maxLength: 800 }
		}
	},
	strict: true
} as const;

function buildPrompt(args: {
	project: { title: string; description?: string | null };
	milestone: { title: string; summary?: string | null; ordinal?: number | null };
	previousTask?: { title: string; goal?: string | null } | null;
}) {
	const { project, milestone, previousTask } = args;

	const lines: string[] = [
		`Project: ${project.title}`,
		project.description ? `Project overview:\n${project.description.trim()}` : '',
		`Current milestone: ${milestone.title}${milestone.ordinal ? ` (step ${milestone.ordinal})` : ''}`,
		milestone.summary ? `Milestone summary:\n${milestone.summary.trim()}` : '',
		'Constraints:',
		'- Exactly ONE task.',
		'- Fits ~30 focused minutes.',
		'- Beginner-safe, but teaches a real skill.',
		'- Must be actionable and produce a tangible outcome within 30 minutes.',
		'- Avoid repo/license boilerplate unless the milestone is setup-specific.',
		'',
	];

	if (previousTask) {
		lines.push(
			'Previous task (most recent):',
			`- Title: ${previousTask.title}`,
			previousTask.goal ? `- Goal: ${previousTask.goal}` : '',
			'',
			'Today:',
			'- Make it distinct from yesterday.',
			'- Slightly harder, but still doable in 30 minutes.',
			''
		);
	} else {
		lines.push('This is the first task of this milestone, make it the first step the user should take.')
	}

	lines.push(
		'Output JSON only with keys: title, goal. No extra prose.'
	);

	return lines.filter(Boolean).join('\n');
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Parse body
	let body: { projectId?: unknown; milestoneId?: unknown };
	try { body = await request.json(); } catch { throw error(400, 'Invalid JSON'); }

	const projectId = typeof body.projectId === 'string' ? body.projectId : null;
	const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : null;
	if (!projectId || !milestoneId) throw error(400, 'projectId and milestoneId are required');

	// Auth
	const supabase = createSupabaseServerClient(cookies);
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw error(401, 'Not signed in');

	// Context: project, milestone, latest task, next ordinal
	const { data: project, error: projErr } = await supabase
		.from('projects')
		.select('id,title,description,user_id')
		.eq('id', projectId)
		.maybeSingle();
	if (projErr) throw error(500, projErr.message);
	if (!project || project.user_id !== user.id) throw error(403, 'Project not found');

	const { data: milestone, error: msErr } = await supabase
		.from('milestones')
		.select('id,title,summary,ordinal,project_id,user_id')
		.eq('id', milestoneId)
		.maybeSingle();
	if (msErr) throw error(500, msErr.message);
	if (!milestone || milestone.user_id !== user.id || milestone.project_id !== project.id) {
		throw error(403, 'Milestone not found');
	}

	const { data: lastTask } = await supabase
		.from('tasks')
		.select('title,goal,milestone_id')
		.eq('milestone_id', milestone.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const { count } = await supabase
		.from('tasks')
		.select('*', { count: 'exact', head: true })
		.eq('milestone_id', milestone.id);
	const nextOrdinal = (count ?? 0) + 1;

	// Model call
	let task: { title: string; goal: string } | null = null;

	if (OPENAI_API_KEY) {
		const client = new OpenAI({ apiKey: OPENAI_API_KEY });
		const prompt = buildPrompt({
			project: { title: project.title, description: project.description },
			milestone: { title: milestone.title, summary: milestone.summary, ordinal: milestone.ordinal },
			previousTask: lastTask ?? null
		});

		const resp = await client.responses.create({
			model: 'gpt-5-nano-2025-08-07',
			instructions: SYSTEM_INSTRUCTIONS,
			input: prompt,
			text: { format: TASK_SCHEMA },
		});

		const txt = resp.output_text?.trim() ?? '';
		try {
			const parsed = JSON.parse(txt);
			if (parsed?.title && parsed?.goal) task = parsed;
		} catch { /* fall through to fallback */ }
	}

	// Fallback if model fails
	if (!task) {
		task = {
			title: `30-min: Next step for ${milestone.title}`,
			goal: `Make incremental progress on "${milestone.title}" for project "${project.title}". Produce a tangible artifact (notes, code diff, config, or measurement).`
		};
	}

	// Insert task
	const { data: inserted, error: dberr } = await supabase
		.from('tasks')
		.insert({
			user_id: user.id,
			project_id: project.id,
			milestone_id: milestone.id,
			ordinal: nextOrdinal,
			title: task.title,
			goal: task.goal
		})
		.select('id, title, goal, milestone_id, ordinal')
		.single();

	if (dberr) throw error(500, dberr.message);

	return json({ task: inserted });
};
