import type { LayoutServerLoad } from './$types';

const TEMPLATE_USER_ID = 'f2220d60-80e9-48ca-8b0c-bded229d141b';
const TEMPLATE_PROJECT_ID = 'fde711f8-20b6-49a8-80c9-7a51fbce54c2';
const DEFAULT_GOAL = 'Share a professional landing page with milestones that stay on track.';

type Project = {
	id: string;
	title: string;
	description?: string | null;
	skills?: string[] | null;
	difficulty?: string | null;
	domain?: string | null;
	metadata?: Record<string, unknown> | null;
} & Record<string, unknown>;

type Milestone = {
	id: string;
	title: string;
	description?: string | null;
	project_id: string;
	done: boolean | null;
	ordinal: number | null;
} & Record<string, unknown>;

type Task = {
	id: string;
	title: string;
	description?: string | null;
	project_id: string;
	milestone_id: string;
	done: boolean | null;
	ordinal: number | null;
} & Record<string, unknown>;

type Todo = {
	id: string;
	title: string;
	description?: string | null;
	project_id: string;
	milestone_id?: string | null;
	task_id: string;
	done: boolean | null;
	ordinal: number | null;
} & Record<string, unknown>;

function extractGoal(metadata: Project['metadata']): string {
	if (metadata && typeof metadata === 'object') {
		const goal = (metadata as Record<string, unknown>).goal;
		if (typeof goal === 'string' && goal.trim().length > 0) {
			return goal.trim();
		}
	}
	return DEFAULT_GOAL;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	const payload = {
		user: { id: 'demo-user', email: 'demo@vector.dev' },
		tutorial: false,
		goal: DEFAULT_GOAL,
		project: null as Project | null,
		milestones: [] as Milestone[],
		tasks: [] as Task[],
		todos: [] as Todo[],
		tasksByMilestone: {} as Record<string, Task[]>,
		todosByTask: {} as Record<string, Todo[]>,
		currentMilestoneId: null as string | null,
		currentTaskId: null as string | null,
		chat: { conversationId: null, messages: [] as { id: string; role: string; content: string }[] }
	};

	if (!supabase) {
		return payload;
	}

	const { data: projectRow, error: projectErr } = await supabase
		.from('projects')
		.select('*')
		.eq('user_id', TEMPLATE_USER_ID)
		.eq('id', TEMPLATE_PROJECT_ID)
		.maybeSingle();

	if (projectErr) {
		console.error('Failed to fetch demo project', projectErr.message);
	}

	let projectData = projectRow;

	if (!projectData) {
		const { data: fallbackProject, error: fallbackErr } = await supabase
			.from('projects')
			.select('*')
			.eq('user_id', TEMPLATE_USER_ID)
			.order('created_at', { ascending: true })
			.limit(1)
			.maybeSingle();

		if (fallbackErr) {
			console.error('Failed to fetch fallback demo project', fallbackErr.message);
		}
		projectData = fallbackProject ?? null;
	}

	if (!projectData) {
		return payload;
	}

	const normalizedProject: Project = {
		...projectData,
		skills: Array.isArray(projectData.skills) ? projectData.skills : []
	};

	payload.project = normalizedProject;
	payload.goal = extractGoal(normalizedProject.metadata);

	const projectId = normalizedProject.id;

	const { data: milestoneRows, error: milestoneErr } = await supabase
		.from('milestones')
		.select('*')
		.eq('project_id', projectId)
		.order('ordinal', { ascending: true });

	if (milestoneErr) {
		console.error('Failed to load demo milestones', milestoneErr.message);
		return payload;
	}

	const milestones: Milestone[] = (milestoneRows ?? []).map((row) => ({
		...row,
		done: !!row.done,
		ordinal: row.ordinal ?? null
	}));
	payload.milestones = milestones;
	payload.currentMilestoneId = milestones.length ? milestones[0].id : null;

	const { data: taskRows, error: taskErr } = await supabase
		.from('tasks')
		.select('*')
		.eq('project_id', projectId)
		.order('ordinal', { ascending: true });

	if (taskErr) {
		console.error('Failed to load demo tasks', taskErr.message);
		return payload;
	}

	const tasks: Task[] = (taskRows ?? []).map((row) => ({
		...row,
		done: !!row.done,
		ordinal: row.ordinal ?? null
	}));
	payload.tasks = tasks;
	payload.currentTaskId = tasks.length ? tasks[0].id : null;

	const { data: todoRows, error: todoErr } = await supabase
		.from('todos')
		.select('*')
		.eq('project_id', projectId)
		.order('ordinal', { ascending: true });

	if (todoErr) {
		console.error('Failed to load demo todos', todoErr.message);
		return payload;
	}

	const todos: Todo[] = (todoRows ?? []).map((row) => ({
		...row,
		done: !!row.done,
		ordinal: row.ordinal ?? null
	}));
	payload.todos = todos;

	const tasksByMilestone: Record<string, Task[]> = {};
	for (const milestone of milestones) {
		tasksByMilestone[milestone.id] = [];
	}
	for (const task of tasks) {
		(tasksByMilestone[task.milestone_id] ??= []).push(task);
	}
	payload.tasksByMilestone = tasksByMilestone;

	const todosByTask: Record<string, Todo[]> = {};
	for (const task of tasks) {
		todosByTask[task.id] = [];
	}
	for (const todo of todos) {
		(todosByTask[todo.task_id] ??= []).push(todo);
	}
	payload.todosByTask = todosByTask;

	return payload;
};
