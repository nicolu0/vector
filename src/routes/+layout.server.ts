import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

type TaskDetails = { title: string; description: string; outcome: string };
type ServerTask = TaskDetails & { id: string; };


export const load: LayoutServerLoad = async (event) => {
	const { cookies, url } = event;
	const supabase = createSupabaseServerClient(cookies);

	// 0) OAuth error / code exchange → set server session, then clean URL
	const errDesc = url.searchParams.get('error_description');
	if (errDesc) throw redirect(303, `/${'?auth_error=' + encodeURIComponent(errDesc)}`);

	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		// strip query params so you don't re-exchange on refresh
		throw redirect(303, url.pathname);
	}

	// 1) Client cookies (SSR fallback)
	const endGoalCookie = (cookies.get('vector_endGoal') ?? '').trim();

	const rawTaskCookie = cookies.get('vector_task') ?? '';
	let cookieTask: TaskDetails | null = null;
	if (rawTaskCookie) {
		try {
			// you set this with encodeURIComponent(JSON.stringify(...)) on the client,
			// so decode before JSON.parse
			cookieTask = JSON.parse(decodeURIComponent(rawTaskCookie)) as TaskDetails;
		} catch {
			cookieTask = null;
		}
	}

	let tutorialDoneDB = false;

	// 2) Current user (server session now present if you just returned from OAuth)
	const { data: { user } } = await supabase.auth.getUser();

	let endGoal = endGoalCookie;
	const tasks: ServerTask[] = [];

	if (user?.id) {
		// 3) Prefer DB values
		const { data: prof } = await supabase
			.from('users')
			.select('goal, tutorial_done')
			.eq('user_id', user.id)
			.maybeSingle();

		if (prof?.goal) endGoal = String(prof.goal).trim();
		tutorialDoneDB = Boolean(prof?.tutorial_done);

		const { data: dbTasks } = await supabase
			.from('tasks')
			.select('id, title, description, outcome, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: true });

		const hasDB = Array.isArray(dbTasks) && dbTasks.length > 0;

		if (hasDB) {
			for (const t of dbTasks) {
				tasks.push({ id: String(t.id), title: t.title, description: t.description, outcome: t.outcome });
			}
			// DB has tasks → cookie task is redundant; clear it
			if (cookieTask) cookies.delete('vector_task', { path: '/' });
		} else if (cookieTask?.title && cookieTask.description && cookieTask.outcome) {
			// First-time: consume cookie task once, then clear cookie
			const { error } = await supabase.from('tasks').insert({
				user_id: user.id,
				title: cookieTask.title,
				description: cookieTask.description,
				outcome: cookieTask.outcome
			});
			if (!error) {
				cookies.delete('vector_task', { path: '/' });
				// push so UI shows immediately on this first authed load
				tasks.push({ id: `cookie-${Date.now()}`, ...cookieTask });
			}
		}

		// Upsert goal from cookie only if DB didn’t have one
		if (!prof?.goal && endGoalCookie) {
			const { error } = await supabase
				.from('users')
				.upsert({ user_id: user.id, goal: endGoalCookie }, { onConflict: 'user_id' });
			if (!error) {
				endGoal = endGoalCookie;
				cookies.delete('vector_endGoal', { path: '/' });
			}
		} else if (endGoalCookie) {
			// DB already has a goal → clear redundant cookie
			cookies.delete('vector_endGoal', { path: '/' });
		}
	} else {
		if (cookieTask) tasks.push({ id: 'cookie-task', ...cookieTask });
	}

	return {
		user: user ? { id: user.id } : null,
		endGoal,
		tasks
	};
};
