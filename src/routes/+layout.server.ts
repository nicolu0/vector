import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const supabase = createSupabaseServerClient(cookies);
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();

	let credits: number | null = null;

	if (!userError && user?.id) {
		const { data, error } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', user.id)
			.maybeSingle();

		if (!error && data && typeof data.credits === 'number') {
			credits = data.credits;
		}
	}

	return {
		user: user ?? null,
		credits
	};
};
