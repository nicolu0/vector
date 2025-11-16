import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';

type UserRow = { user_id: string; name: string | null };
type Project = {
	id: string;
	user_id: string;
	title: string | null;
	description: string | null;
};

export const load: PageServerLoad = async (event) => {
	const supabase = createSupabaseServerClient(event.cookies);
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { needsAuth: true as const };

	const { data: row } = await supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle();
	if (!row || row.role !== 'admin') { throw error(403, 'Forbidden'); }

	const { data: users } = await supabase.rpc('admin_list_known_users');
	const { data: projects } = await supabase.from('projects').select('id, title, description, user_id');
	const { data: milestones } = await supabase.from('milestones').select('id, project_id, title, description');
	const { data: tasks } = await supabase.from('tasks').select('id, milestone_id, ordinal, title, description');
	const { data: todos } = await supabase.from('todos').select('id, task_id, ordinal, title');

	const projectsByUser = Object.create(null) as Record<string, { name: string | null, projects: Project[] }>;
	const hasProjects = new Set((projects ?? []).map(p => p.user_id));

	for (const u of (users ?? []) as UserRow[]) {
		if (!hasProjects.has(u.user_id)) continue;
		projectsByUser[u.user_id] = { name: u.name ?? null, projects: [] };
	}
	for (const p of (projects ?? []) as Project[]) {
		if (!projectsByUser[p.user_id]) {
			projectsByUser[p.user_id] = { name: null, projects: [] };
		}
		projectsByUser[p.user_id].projects.push(p);
	}
	// ---- Types for the fields you selected (adjust if you select more) ----
	type Project = {
		id: string;
		user_id: string;
		title: string;
		description: string | null;
		milestones?: Milestone[];
	};

	type Milestone = {
		id: string;
		project_id: string;
		title: string;
		description: string | null;
		tasks?: Task[];
	};

	type Task = {
		id: string;
		milestone_id: string;
		ordinal: number | null;
		title: string;
		description: string | null;
		todos?: Todo[];
	};

	type Todo = {
		id: string;
		task_id: string;
		ordinal: number | null;
		title: string;
	};

	// ---- Build indexes once ----
	const milestonesByProject: Record<string, Milestone[]> = Object.create(null);
	const milestoneIndex: Record<string, Milestone> = Object.create(null);

	for (const m of (milestones ?? []) as Milestone[]) {
		const withSlots: Milestone = { ...m, tasks: [] };
		(milestonesByProject[m.project_id] ??= []).push(withSlots);
		milestoneIndex[m.id] = withSlots;
	}

	const taskIndex: Record<string, Task> = Object.create(null);

	for (const t of (tasks ?? []) as Task[]) {
		const parent = milestoneIndex[t.milestone_id];
		if (!parent) continue; // milestone might be filtered out or missing
		const withSlots: Task = { ...t, todos: [] };
		(parent.tasks ??= []).push(withSlots);
		taskIndex[t.id] = withSlots;
	}

	for (const td of (todos ?? []) as Todo[]) {
		const parent = taskIndex[td.task_id];
		if (!parent) continue; // task might be filtered out or missing
		(parent.todos ??= []).push(td);
	}

	// ---- Attach milestones to each project in your per-user buckets ----
	for (const [userId, info] of Object.entries(projectsByUser)) {
		info.projects = (info.projects ?? []).map((p) => {
			const wired: Project = { ...p };
			wired.milestones = milestonesByProject[p.id] ?? [];
			return wired;
		});
	}


	return {
		needsAuth: false as const,
		users: projectsByUser
	};
};
