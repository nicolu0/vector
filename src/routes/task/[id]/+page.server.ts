import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { error, redirect } from '@sveltejs/kit';

const FALLBACK_TASK = {
	title: 'Example Task',
	description: 'You get 1 task per day. Tasks have varying scope and todos. To complete a task, click the circle next to it.'
}
export const load: PageServerLoad = async ({ params, cookies }) => {
	if (params.id === 'tutorial') {
		return { task: FALLBACK_TASK };
	}

	const supabase = createSupabaseServerClient(cookies);

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw redirect(303, '/');

	const { data: task, error: qerr } = await supabase
		.from('tasks')
		.select('id, title, description')
		.eq('user_id', user.id)
		.eq('id', params.id)
		.maybeSingle();

	if (qerr) throw error(500, qerr.message);
	if (!task) throw error(404, 'Task not found');

	return { task };
};
