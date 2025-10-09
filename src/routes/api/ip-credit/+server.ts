import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { getIpCreditStatus } from '$lib/server/ipCredits';

type CreditSource = 'user' | 'ip';

export const GET: RequestHandler = async ({ cookies, getClientAddress }) => {
	const supabase = createSupabaseServerClient(cookies);

	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();

	if (user && !userError) {
		const { data, error } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', user.id)
			.maybeSingle<{ credits: number | null }>();

		if (error) {
			console.error('Failed to fetch user credits', error);
			return json(
				{ available: false, remaining: 0, source: 'user' as CreditSource, ip: null },
				{ status: 500 }
			);
		}

		const remaining = typeof data?.credits === 'number' ? data.credits : 0;
		return json(
			{
				available: remaining > 0,
				remaining,
				source: 'user' as CreditSource,
				ip: getClientAddress()
			},
			{ status: 200 }
		);
	}

	const ip = getClientAddress?.();
	if (!ip) {
		return json(
			{ available: false, remaining: 0, source: 'ip' as CreditSource, ip: null },
			{ status: 200 }
		);
	}

	const status = await getIpCreditStatus(supabase, ip, { initialCredits: 1 });

	if (!status) {
		return json(
			{ available: false, remaining: 0, source: 'ip' as CreditSource, ip },
			{ status: 500 }
		);
	}

	return json({ ...status, source: 'ip' as CreditSource }, { status: 200 });
};

