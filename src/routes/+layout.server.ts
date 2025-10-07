import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const supabase = createSupabaseServerClient(cookies);
	const {
		data: { session }
	} = await supabase.auth.getSession();

	let credits: number | null = null;

	if (session?.user?.id) {
		const { data, error } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (!error && data && typeof data.credits === 'number') {
			credits = data.credits;
		}
	}

	return {
		session,
		credits
	};
};
