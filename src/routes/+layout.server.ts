import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

type TaskDetails = { title: string; description: string; outcome: string };
type ServerTask = TaskDetails & { id: string; };


export const load: LayoutServerLoad = async (event) => {
	const { cookies, url } = event;
	const supabase = createSupabaseServerClient(cookies);

	const errDesc = url.searchParams.get('error_description');
	if (errDesc) throw redirect(303, `/${'?auth_error=' + encodeURIComponent(errDesc)}`);

	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}


	const { data: { user } } = await supabase.auth.getUser();

	const goalCookie = (cookies.get('vector:goal') ?? '').trim();
	let goal = goalCookie;

	const tasks: ServerTask[] = [];

	if (user?.id) {
		const { data: profile } = await supabase
			.from('users')
			.select('goal, tutorial_done')
			.eq('user_id', user.id)
			.maybeSingle();

		if (profile?.goal) goal = String(profile.goal).trim();

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
		}
		if (!profile?.goal && goal) {
			const { error } = await supabase
				.from('users')
				.upsert({ user_id: user.id, goal: goalCookie }, { onConflict: 'user_id' });
			if (!error) {
				goal = goalCookie;
				cookies.delete('vector:goal', { path: '/' });
			}
		} else if (goalCookie) {
			cookies.delete('vector:goal', { path: '/' });
		}
	}

	const shouldAutoGenerateTask = goal.trim().length > 0 && tasks.length === 0;

	return {
		user: user ? { id: user.id } : null,
		goal,
		tasks,
		autoGenerateTask: shouldAutoGenerateTask
	};
};
