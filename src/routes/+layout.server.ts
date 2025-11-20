import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

type ProjectRecord = {
	id: string;
	title: string;
	description: string;
	skills: string[];
	difficulty: string;
	domain: string;
} & Record<string, unknown>;

type Project = ProjectRecord | null;

type Milestone = {
	id: string;
	title: string;
	done: boolean;
	ordinal: number | null;
	description?: string;
} & Record<string, unknown>;

type Task = {
	id: string;
	title: string;
	milestone_id: string;
	project_id?: string | null;
	done: boolean;
	ordinal: number | null;
	tutorial?: boolean;
	description?: string | null;
} & Record<string, unknown>;

type Todo = {
	id: string;
	task_id: string;
	title: string;
	done: boolean;
	ordinal: number | null;
	hints: string[] | null;
} & Record<string, unknown>;

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

type CurrentSelectionDetail = {
	project_id: string | null;
	project_title: string | null;
	milestone_id: string | null;
	milestone_title: string | null;
	task_id: string | null;
	task_title: string | null;
	task_done: boolean;
};

type ProjectDetailPayload = {
	project: ProjectRecord;
	milestones: Milestone[];
	tasks: Task[];
	tasksByMilestone: Record<string, Task[]>;
	todosByTask: Record<string, Todo[]>;
};

export const load: LayoutServerLoad = async (event) => {
	const { cookies, url } = event;
	const isDemoRoute = event.route.id === '/demo';

    const supabase = event.locals.supabase;
    const user = event.locals.user;

	// OAuth exchange
	const errDesc = url.searchParams.get('error_description');
	if (errDesc) throw redirect(303, `/${'?auth_error=' + encodeURIComponent(errDesc)}`);
	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}

	const payload: {
		user: { id: string, email: string | undefined } | null;
		tutorial: boolean;
		goal: string;
		project: Project;
		projects: ProjectRecord[];
		projectDetails: Record<string, ProjectDetailPayload>;
		milestones: Milestone[];
		tasks: Task[];
		todos: Todo[];
		tasksByMilestone: Record<string, Task[]>;
		todosByTask: Record<string, Todo[]>;
		currentMilestoneId: string | null;
		currentTaskId: string | null;
		currentSelectionDetail: CurrentSelectionDetail | null;
		currentProjectId: string | null;
		chat: { conversationId: string | null; messages: ChatMessage[] };
		isDemoRoute: boolean;
		githubConnected: boolean;
	} = {
		user: user ? { id: user.id, email: user.email } : null,
		tutorial: false,
		goal: '',
		project: null,
		projects: [] as ProjectRecord[],
		projectDetails: {},
		milestones: [] as Milestone[],
		tasks: [] as Task[],
		todos: [] as Todo[],
		tasksByMilestone: {},
		todosByTask: {},
		currentMilestoneId: null,
		currentTaskId: null,
		currentSelectionDetail: null,
		currentProjectId: null,
		chat: { conversationId: null, messages: [] },
		isDemoRoute,
		githubConnected: false,
	};

	if (isDemoRoute) {
		payload.user = null;
		return payload;
	}

	if (!user) return payload;

    const { data: githubInstallations, error: githubInstallationsErr } = await supabase
        .from('github_installations')
        .select('installation_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (githubInstallationsErr) {
        console.error('Failed to fetch GitHub installations:', githubInstallationsErr.message);
    }
    
    (payload as any).githubConnected = !!githubInstallations;

	const goalCookie = (cookies.get('vector:goal') ?? '').trim();

	const { data: profile } = await supabase
		.from('users')
		.select('goal, tutorial, current_milestone, current_task, current_project')
		.eq('user_id', user.id)
		.maybeSingle();

	const tutorialFlag = !!profile?.tutorial;
	payload.tutorial = tutorialFlag;
	let goal = (profile?.goal ? String(profile.goal) : '') || goalCookie;
	payload.currentMilestoneId = profile?.current_milestone ?? null;
	payload.currentTaskId = profile?.current_task ?? null;
	payload.currentProjectId = profile?.current_project ?? null;

	if (goalCookie && !profile) {
		const { error: insertErr } = await supabase
			.from('users')
			.insert([{ user_id: user.id, goal: goalCookie }]);
		if (!insertErr) cookies.delete('vector:goal', { path: '/' });
	} else if (goalCookie && profile && !profile.goal) {
		const { error: updateErr } = await supabase
			.from('users')
			.update({ goal: goalCookie })
			.eq('user_id', user.id);
		if (!updateErr) cookies.delete('vector:goal', { path: '/' });
	} else if (goalCookie) {
		cookies.delete('vector:goal', { path: '/' });
	}
	payload.goal = goal;

	if (!profile) {
		const { error: ensureProfileErr } = await supabase
			.from('users')
			.upsert({ user_id: user.id, goal: goal || null }, { onConflict: 'user_id' });
		if (ensureProfileErr) {
			console.error('Failed to ensure user profile', ensureProfileErr.message);
		}
	}


	// Ensure conversation exists and fetch messages
	let conversationId: string | null = null;
	const { data: existingConversation, error: fetchConvErr } = await supabase
		.from('conversations')
		.select('id')
		.eq('user_id', user.id)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (fetchConvErr) {
		console.error('Failed to fetch conversation', fetchConvErr.message);
	} else if (existingConversation) {
		conversationId = existingConversation.id;
	}

	if (!conversationId) {
		const { data: insertedConversation, error: insertConvErr } = await supabase
			.from('conversations')
			.insert({ user_id: user.id })
			.select('id')
			.single();

		if (insertConvErr) {
			console.error('Failed to insert conversation', insertConvErr.message);
			const { data: fallbackConversation } = await supabase
				.from('conversations')
				.select('id')
				.eq('user_id', user.id)
				.order('created_at', { ascending: true })
				.limit(1)
				.maybeSingle();
			if (fallbackConversation) conversationId = fallbackConversation.id;
		} else {
			conversationId = insertedConversation.id;
		}
	}

	if (conversationId) {
		const { data: chatMessages, error: messagesErr } = await supabase
			.from('messages')
			.select('id, role, content, created_at')
			.eq('conversation_id', conversationId)
			.order('created_at', { ascending: true });

		if (messagesErr) {
			console.error('Failed to load conversation messages', messagesErr.message);
		} else if (chatMessages) {
			payload.chat = {
				conversationId,
				messages: chatMessages.map((m) => ({
					id: m.id,
					role: m.role as ChatMessage['role'],
					content: typeof m.content === 'string' ? m.content : '',
					created_at: m.created_at,
				})),
			};
		} else {
			payload.chat = { conversationId, messages: [] };
		}
	}

	const { data: projectRows, error: projectsErr } = await supabase
		.from('projects')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (projectsErr) {
		console.error('Failed to fetch projects', projectsErr.message);
		return payload;
	}

	const normalizedProjects: ProjectRecord[] = (projectRows ?? []).map((proj) => ({
		...proj,
		skills: Array.isArray(proj.skills) ? proj.skills : [],
	}));
	payload.projects = normalizedProjects;
	const projectLookup = Object.fromEntries(normalizedProjects.map((p) => [p.id, p]));
	const projectIds = normalizedProjects.map((p) => p.id);
	if (projectIds.length === 0) return payload;

	// Milestones for all projects
	const { data: msRows, error: msErr } = await supabase
		.from('milestones')
		.select('*')
		.in('project_id', projectIds)
		.order('project_id', { ascending: true })
		.order('ordinal', { ascending: true });

	if (msErr) {
		console.error('Failed to fetch milestones', msErr.message);
		return payload;
	}

	const milestonesByProject: Record<string, Milestone[]> = Object.create(null);
	const milestoneLookup = new Map<string, Milestone>();
	const milestoneToProject = new Map<string, string>();
	const milestoneIds: string[] = [];
	for (const row of msRows ?? []) {
		const normalized: Milestone = {
			...row,
			done: !!row.done,
			ordinal: row.ordinal ?? null
		};
		milestoneLookup.set(normalized.id, normalized);
		milestoneToProject.set(normalized.id, row.project_id);
		milestoneIds.push(normalized.id);
		(milestonesByProject[row.project_id] ??= []).push(normalized);
	}

	// Tasks for all milestones
	const tasksByProject: Record<string, Task[]> = Object.create(null);
	const tasksByMilestone: Record<string, Task[]> = Object.create(null);
	const taskProjectMap = new Map<string, string>();
	const { data: taskRows, error: taskErr } = milestoneIds.length
		? await supabase
				.from('tasks')
				.select('*')
				.in('milestone_id', milestoneIds)
				.order('ordinal', { ascending: true })
		: { data: [] as Task[], error: null };

	if (taskErr) {
		console.error('Failed to fetch tasks', taskErr.message);
		return payload;
	}

	const normalizedTasks: Task[] = (taskRows as Task[]).map((task) => ({
		...task,
		done: !!task.done,
		ordinal: task.ordinal ?? null,
		todo: Array.isArray(task.todo) ? task.todo : task.todo ?? [],
	}));
	for (const task of normalizedTasks) {
		const projectId = task.project_id ?? milestoneToProject.get(task.milestone_id) ?? null;
		if (!projectId) continue;
		taskProjectMap.set(task.id, projectId);
		(tasksByProject[projectId] ??= []).push(task);
		(tasksByMilestone[task.milestone_id] ??= []).push(task);
	}

	// Todos for all tasks
	const taskIds = normalizedTasks.map((t) => t.id);
	const todosByTask: Record<string, Todo[]> = Object.create(null);
	if (taskIds.length) {
		const { data: todoRows, error: todoErr } = await supabase
			.from('todos')
			.select('*')
			.in('task_id', taskIds)
			.eq('user_id', user.id)
			.order('ordinal', { ascending: true });

		if (todoErr) {
			console.error('Failed to fetch todos', todoErr.message);
			return payload;
		}

		const normalizedTodos: Todo[] = (todoRows as Todo[]).map((todo) => ({
			...todo,
			done: !!todo.done,
			ordinal: todo.ordinal ?? null,
			hints: Array.isArray(todo.hints) ? todo.hints : [],
		}));

		for (const td of normalizedTodos) {
			(todosByTask[td.task_id] ??= []).push(td);
		}
	}

	// Build project detail payloads
	const projectDetails: Record<string, ProjectDetailPayload> = Object.create(null);
	for (const projectId of projectIds) {
		const project = projectLookup[projectId];
		const ms = milestonesByProject[projectId] ?? [];
		const projTasks = tasksByProject[projectId] ?? [];
		const projTasksByMilestone: Record<string, Task[]> = Object.create(null);
		for (const milestone of ms) {
			projTasksByMilestone[milestone.id] = tasksByMilestone[milestone.id] ?? [];
		}
		const projTodosByTask: Record<string, Todo[]> = Object.create(null);
		for (const task of projTasks) {
			projTodosByTask[task.id] = todosByTask[task.id] ?? [];
		}
		projectDetails[projectId] = {
			project,
			milestones: ms,
			tasks: projTasks,
			tasksByMilestone: projTasksByMilestone,
			todosByTask: projTodosByTask,
		};
	}
	payload.projectDetails = projectDetails;

	// Determine active project
	const prioritizedProjectId =
		(payload.currentProjectId && projectDetails[payload.currentProjectId] && payload.currentProjectId) ||
		projectIds[0];
	if (!payload.currentProjectId) {
		payload.currentProjectId = prioritizedProjectId ?? null;
	}
	const activeDetail = prioritizedProjectId ? projectDetails[prioritizedProjectId] : null;
	payload.project = activeDetail?.project ?? null;
	payload.milestones = activeDetail?.milestones ?? [];
	payload.tasks = activeDetail?.tasks ?? [];
	payload.tasksByMilestone = activeDetail?.tasksByMilestone ?? {};
	payload.todosByTask = activeDetail?.todosByTask ?? {};
	payload.todos = Object.values(payload.todosByTask).flat();

	// Current selection detail sourced from all tasks
	let currentSelectionDetail: CurrentSelectionDetail | null = null;
	if (payload.currentTaskId) {
		const foundTask = normalizedTasks.find((task) => task.id === payload.currentTaskId);
		if (foundTask) {
			const milestone = milestoneLookup.get(foundTask.milestone_id);
			const project =
				projectLookup[foundTask.project_id ?? milestoneToProject.get(foundTask.milestone_id) ?? ''];
			currentSelectionDetail = {
				project_id: foundTask.project_id ?? milestoneToProject.get(foundTask.milestone_id) ?? project?.id ?? null,
				project_title: project?.title ?? null,
				milestone_id: foundTask.milestone_id ?? null,
				milestone_title: milestone?.title ?? null,
				task_id: foundTask.id,
				task_title: foundTask.title,
				task_done: !!foundTask.done
			};
		}
		if (!currentSelectionDetail) {
			const { data: fallbackTask } = await supabase
				.from('tasks')
				.select('id, title, done, milestone_id, project_id')
				.eq('id', payload.currentTaskId)
				.maybeSingle();
			if (fallbackTask) {
				let milestoneTitle: string | null =
					milestoneLookup.get(fallbackTask.milestone_id)?.title ?? null;
				if (!milestoneTitle && fallbackTask.milestone_id) {
					const { data: fallbackMilestone } = await supabase
						.from('milestones')
						.select('id, title')
						.eq('id', fallbackTask.milestone_id)
						.maybeSingle();
					milestoneTitle = fallbackMilestone?.title ?? null;
				}
				const project = projectLookup[fallbackTask.project_id as string];
				currentSelectionDetail = {
					project_id: fallbackTask.project_id ?? null,
					project_title: project?.title ?? null,
					milestone_id: fallbackTask.milestone_id ?? null,
					milestone_title: milestoneTitle,
					task_id: fallbackTask.id,
					task_title: fallbackTask.title,
					task_done: !!fallbackTask.done
				};
			}
		}
	}
	if (!payload.currentProjectId && currentSelectionDetail?.project_id) {
		payload.currentProjectId = currentSelectionDetail.project_id;
	}
	payload.currentSelectionDetail = currentSelectionDetail;

	return payload;
};
