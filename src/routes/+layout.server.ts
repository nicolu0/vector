import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

type Project = { id: string; title: string; description: string } | null;
type Milestone = { id: string; title: string; project_id: string };
type Task = { id: string; title: string; milestone_id: string };

export const load: LayoutServerLoad = async (event) => {
	const { cookies, url } = event;
	const supabase = createSupabaseServerClient(cookies);

	// OAuth exchange
	const errDesc = url.searchParams.get('error_description');
	if (errDesc) throw redirect(303, `/${'?auth_error=' + encodeURIComponent(errDesc)}`);
	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const payload: {
		user: { id: string } | null;
		goal: string;
		project: Project;
		milestones: Array<{ id: string; title: string }>;
		tasksByMilestone: Record<string, Array<{ id: string; title: string }>>;
	} = {
		user: user ? { id: user.id } : null,
		goal: '',
		project: null,
		milestones: [],
		tasksByMilestone: {},
	};
	if (!user) return payload;
	const goalCookie = (cookies.get('vector:goal') ?? '').trim();


	const { data: profile } = await supabase
		.from('users')
		.select('user_id, goal')
		.eq('user_id', user.id)
		.maybeSingle();
	let goal = (profile?.goal ? String(profile.goal) : '') || goalCookie;
	if (goalCookie && !profile) {
		const { error: insertErr } = await supabase
			.from('users')
			.insert([{ user_id: user.id, goal: goalCookie }]);

		if (!insertErr) {
			cookies.delete('vector:goal', { path: '/' });
		}
	}
	else if (goalCookie && profile && !profile.goal) {
		const { error: updateErr } = await supabase
			.from('users')
			.update({ goal: goalCookie })
			.eq('user_id', user.id);

		if (!updateErr) {
			cookies.delete('vector:goal', { path: '/' });
		}
	}
	else if (goalCookie) {
		cookies.delete('vector:goal', { path: '/' });
	}
	payload.goal = goal;

	const { data: projRow, error: projErr } = await supabase
		.from('projects')
		.select('id,title,description')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (projErr) {
		// Log if you have server logging; keep returning default shape
		return payload;
	}

	payload.project = projRow ?? null;
	if (!payload.project) return payload;

	// 2) Milestones for the project
	const { data: msRows, error: msErr } = await supabase
		.from('milestones')
		.select('id,title,project_id')
		.eq('project_id', payload.project.id)
		.order('ordinal', { ascending: true }); // adjust field if different

	if (msErr || !msRows?.length) return payload;

	const milestones: Milestone[] = msRows;
	payload.milestones = milestones.map(({ id, title }) => ({ id, title }));

	// 3) Tasks for those milestones (one round-trip using IN)
	const milestoneIds = milestones.map((m) => m.id);
	const { data: taskRows, error: taskErr } = await supabase
		.from('tasks')
		.select('id,title,milestone_id')
		.in('milestone_id', milestoneIds);

	if (taskErr || !taskRows) return payload;

	// Group tasks by milestone_id
	const byMilestone: Record<string, Array<{ id: string; title: string }>> = {};
	for (const m of milestoneIds) byMilestone[m] = [];
	for (const t of taskRows as Task[]) {
		(byMilestone[t.milestone_id] ??= []).push({ id: t.id, title: t.title });
	}
	payload.tasksByMilestone = byMilestone;

	return payload;
};
