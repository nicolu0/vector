import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { error, redirect } from '@sveltejs/kit';

const FALLBACK_TASK = {
	title: 'Fallback Task'
}
export const load: PageServerLoad = async ({ params, cookies, url }) => {
	return { task: FALLBACK_TASK };
	const supabase = createSupabaseServerClient(cookies);

	// optional: handle OAuth code here too if this page can be a landing target
	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw redirect(303, '/');

	const { data: task, error: qerr } = await supabase
		.from('tasks')
		.select('id, title, description, outcome')
		.eq('user_id', user.id)
		.eq('id', params.id)
		.maybeSingle();

	if (qerr) throw error(500, qerr.message);
	if (!task) throw error(404, 'Task not found');

	return { task };
};
