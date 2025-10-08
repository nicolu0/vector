import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Cookies } from '@sveltejs/kit';

function assertEnv(value: string | undefined, name: string): string {
	if (!value) {
		throw new Error(`${name} is not set. Check your environment variables.`);
	}
	return value;
}

export function createSupabaseServerClient(cookies: Cookies) {
	const url = assertEnv(PUBLIC_SUPABASE_URL, 'PUBLIC_SUPABASE_URL');
	const key = assertEnv(PUBLIC_SUPABASE_ANON_KEY, 'PUBLIC_SUPABASE_ANON_KEY');

	return createServerClient(url, key, {
		cookies: {
			get: (name) => cookies.get(name),
			set: (name, value, options) => {
				const cookieOptions: (CookieOptions & { path: string }) = {
					...(options ?? {}),
					path: '/'
				};
				cookies.set(name, value, cookieOptions);
			},
			remove: (name, options) => {
				cookies.delete(name, { ...(options ?? {}), path: '/' });
			}
		}
	});
}
