import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

const SYSTEM_INSTRUCTIONS = `
You are a task generator for Vector, an education platform that helps students build advanced projects with daily tasks tailored to their interests, goals, and skill.

Your job:
Given a project and the current milestone context, generate ONE concrete next task for that milestone.

You will receive a JSON input from the user with:
- project_title: the real title of the project
- project_description: the real description of the project
- curr_milestone_title
- curr_milestone_description
- next_milestone_title (may be null)
- next_milestone_description (may be null)
- completed_tasks (array of task titles already completed in the current milestone; may be empty)
- prev_task_title (most recent completed task across the project; may be null)
- prev_task_description (may be null)
- prev_task_todos (array of todo titles from prev task; may be empty)
- prev_task_t2c (human readable string or seconds; may be null)

Task scope and difficulty:
Estimate the student’s skill level from prev_task_t2c and adjust the scope and difficulty of the new task accordingly.
We want each task to be around 15–30 minutes of focused work for a motivated student.
If they finished faster, assume higher skill and increase scope slightly.
If they finished slower, assume lower skill and reduce scope while still making progress.

Task design:
- The new task must be a meaningful unit of progress within the current milestone (not a vague meta-task).
- It must connect logically after completed_tasks.
- Do not duplicate work already covered by completed_tasks.

Milestone completion:
- If the goals of the current milestone are clearly achieved based on completed_tasks and current milestone description, set suggest_complete_milestone to true and briefly justify in advance_reason.
- Otherwise set suggest_complete_milestone to false and advance_reason to an empty string.

CRITICAL RULES:
- Do NOT mention difficulty, scope, or estimated time in the task.
- Do NOT mention variable names or that you were given JSON.
- Refer to the project and milestone naturally.
- Do NOT include templating syntax like {{...}} in your output.

Output format (STRICT):
Return ONE JSON object matching the schema provided.
Keep the title extremely concise (3–4 words). Keep todos concise (aim ~5; 4–7 max).
Return ONLY the JSON object, nothing else.
`.trim();

const TASK_SCHEMA = {
	type: 'json_schema',
	name: 'task_with_skill_v2',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: [
			'estimated_elo',
			'estimated_skill',
			'title',
			'description',
			'todos',
			'suggest_complete_milestone',
			'advance_reason'
		],
		properties: {
			estimated_elo: { type: 'integer', minimum: 0 },
			estimated_skill: {
				type: 'string',
				enum: ['beginner', 'intermediate', 'advanced', 'expert']
			},
			title: { type: 'string', minLength: 3, maxLength: 60 },
			description: { type: 'string', minLength: 40, maxLength: 800 },
			todos: {
				type: 'array',
				items: { type: 'string', minLength: 3, maxLength: 200 },
				minItems: 4,
				maxItems: 7
			},
			suggest_complete_milestone: { type: 'boolean' },
			advance_reason: { type: 'string', maxLength: 240 }
		}
	},
	strict: true
} as const;

function humanizeT2C(sec: number | null | undefined) {
	if (!sec || sec <= 0) return null;
	const mins = Math.round(sec / 60);
	if (mins < 60) return `${mins} minutes`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h ${m}m` : `${h}h`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Parse body
	let body: { projectId?: unknown; milestoneId?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const projectId = typeof body.projectId === 'string' ? body.projectId : null;
	const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : null;
	if (!projectId || !milestoneId) throw error(400, 'projectId and milestoneId are required');

	// Auth
	const supabase = createSupabaseServerClient(cookies);
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw error(401, 'Not signed in');

	// Fetch project
	const { data: project, error: projErr } = await supabase
		.from('projects')
		.select('id,title,description,user_id')
		.eq('id', projectId)
		.maybeSingle();
	if (projErr) throw error(500, projErr.message);
	if (!project || project.user_id !== user.id) throw error(403, 'Project not found');

	// Fetch current milestone
	const { data: currMilestone, error: msErr } = await supabase
		.from('milestones')
		.select('id,title,description,ordinal,project_id,user_id,done')
		.eq('id', milestoneId)
		.maybeSingle();
	if (msErr) throw error(500, msErr.message);
	if (
		!currMilestone ||
		currMilestone.user_id !== user.id ||
		currMilestone.project_id !== project.id
	) {
		throw error(403, 'Milestone not found');
	}

	// Fetch next milestone (by ordinal)
	const currOrd = currMilestone.ordinal ?? null;
	let nextMilestone:
		| { id: string; title: string; description: string | null; ordinal: number | null }
		| null = null;

	if (currOrd != null) {
		const { data: nm } = await supabase
			.from('milestones')
			.select('id,title,description,ordinal')
			.eq('project_id', project.id)
			.eq('user_id', user.id)
			.gt('ordinal', currOrd)
			.order('ordinal', { ascending: true })
			.limit(1)
			.maybeSingle();
		nextMilestone = nm ?? null;
	}

	// Completed tasks in current milestone
	const { data: completedTaskRows } = await supabase
		.from('tasks')
		.select('title')
		.eq('milestone_id', currMilestone.id)
		.eq('done', true)
		.order('ordinal', { ascending: true });

	const completedTasks = (completedTaskRows ?? []).map((t) => t.title);

	// Most recent completed task across the project (for skill estimate)
	const { data: prevTask } = await supabase
		.from('tasks')
		.select('id,title,description,todo,t2c_seconds,completed_at')
		.eq('project_id', project.id)
		.eq('done', true)
		.order('completed_at', { ascending: false, nullsFirst: false })
		.limit(1)
		.maybeSingle();

	const prevTodos =
		(Array.isArray(prevTask?.todo) ? (prevTask!.todo as string[]) : []) ?? [];
	const prevT2CSeconds =
		typeof prevTask?.t2c_seconds === 'number' ? prevTask!.t2c_seconds : null;

	// Build JSON input for the model
	const modelInput = {
		project_title: project.title,
		project_description: project.description ?? null,
		curr_milestone_title: currMilestone.title,
		curr_milestone_description: currMilestone.description ?? null,
		next_milestone_title: nextMilestone?.title ?? null,
		next_milestone_description: nextMilestone?.description ?? null,
		completed_tasks: completedTasks,
		prev_task_title: prevTask?.title ?? null,
		prev_task_description: prevTask?.description ?? null,
		prev_task_todos: prevTodos,
		prev_task_t2c: prevT2CSeconds != null ? humanizeT2C(prevT2CSeconds) : null
	};

	// Model call
	type ModelOut = {
		estimated_elo: number;
		estimated_skill: 'beginner' | 'intermediate' | 'advanced' | 'expert';
		title: string;
		description: string;
		todos: string[];
		suggest_complete_milestone: boolean;
		advance_reason: string;
	};

	let task: ModelOut | null = null;

	if (OPENAI_API_KEY) {
		const client = new OpenAI({ apiKey: OPENAI_API_KEY });

		const resp = await client.responses.create({
			model: 'gpt-5-nano-2025-08-07',
			instructions: SYSTEM_INSTRUCTIONS,
			input: JSON.stringify(modelInput),
			text: { format: TASK_SCHEMA }
		});

		const txt = resp.output_text?.trim() ?? '';
		try {
			const parsed = JSON.parse(txt);
			if (parsed?.title && parsed?.description && Array.isArray(parsed?.todos)) {
				task = parsed as ModelOut;
			}
		} catch {
			task = null;
		}
	}

	// Fallback if model fails
	if (!task) {
		task = {
			estimated_elo: 1200,
			estimated_skill: 'beginner',
			title: 'Next milestone task',
			description: `Make concrete progress on ${currMilestone.title} for ${project.title}. Produce a tangible artifact within a focused session.`,
			todos: [
				'Define the next concrete step',
				'Implement it',
				'Validate output',
				'Record findings',
				'Commit results'
			],
			suggest_complete_milestone: false,
			advance_reason: ''
		};
	}

	// Decide insertion milestone
	let targetMilestoneId = currMilestone.id;

	if (task.suggest_complete_milestone && nextMilestone) {
		// Mark current milestone done
		await supabase.from('milestones').update({ done: true }).eq('id', currMilestone.id);

		// Switch insertion to next milestone
		targetMilestoneId = nextMilestone.id;
	}

	// Compute next ordinal for target milestone
	const { count: targetCount } = await supabase
		.from('tasks')
		.select('*', { count: 'exact', head: true })
		.eq('milestone_id', targetMilestoneId)
		.eq('user_id', user.id);

	const nextOrdinal = (targetCount ?? 0) + 1;

	// Insert task
	const { data: insertedTask, error: taskErr } = await supabase
		.from('tasks')
		.insert({
			user_id: user.id,
			project_id: project.id,
			milestone_id: targetMilestoneId,
			ordinal: nextOrdinal,
			title: task.title,
			description: task.description,
			todo: task.todos,
			done: false,
			metadata: {
				estimated_elo: task.estimated_elo,
				estimated_skill: task.estimated_skill,
				suggest_complete_milestone: task.suggest_complete_milestone,
				advance_reason: task.advance_reason
			}
		})
		.select('id, title, description, milestone_id, ordinal, todo')
		.single();

	if (taskErr) throw error(500, taskErr.message);

	// Insert todos as rows (one per item)
	const todoRows = (task.todos ?? []).map((title, i) => ({
		user_id: user.id,
		project_id: project.id,
		milestone_id: targetMilestoneId,
		task_id: insertedTask.id,
		ordinal: i + 1,
		title,
		done: false
	}));

	const { error: todosErr } = await supabase.from('todos').insert(todoRows);
	if (todosErr) throw error(500, todosErr.message);

	return json({
		task: insertedTask,
		todos: todoRows,
		suggest_complete_milestone: task.suggest_complete_milestone,
		advance_reason: task.advance_reason,
		next_milestone_id: task.suggest_complete_milestone ? nextMilestone?.id ?? null : null
	});
};
