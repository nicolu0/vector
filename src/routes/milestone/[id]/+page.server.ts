import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { error, redirect } from '@sveltejs/kit';

const FALLBACK_MILESTONE = {
	title: 'Example Milestone',
	summary: 'Milestones are the scope of your daily tasks. Click the arrow to expand the milestone and show the tasks. Click the Example task.'
}
export const load: PageServerLoad = async ({ params, cookies }) => {
	if (params.id === 'tutorial') {
		return { milestone: FALLBACK_MILESTONE };
	}
	const supabase = createSupabaseServerClient(cookies);

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw redirect(303, '/');

	const { data: milestone, error: qerr } = await supabase
		.from('milestones')
		.select('id, title, summary')
		.eq('user_id', user?.id)
		.eq('id', params.id)
		.maybeSingle();

	if (qerr) throw error(500, qerr.message);
	if (!milestone) { return FALLBACK_MILESTONE };

	return { milestone };
};
