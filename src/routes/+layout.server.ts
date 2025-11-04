import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

type Project = { id: string; title: string; description: string } | null;

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
	let project: Project = null;

	if (user?.id) {
		const { data: profile } = await supabase
			.from('users')
			.select('goal')
			.eq('user_id', user.id)
			.maybeSingle();

		if (profile?.goal) goal = String(profile.goal).trim();

		const { data: projectRow } = await supabase
			.from('projects')
			.select('id, title, description')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		project = projectRow ?? null;

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

	return {
		user: user ? { id: user.id } : null,
		goal,
		project,
	};
};
