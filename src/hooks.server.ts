// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';

export const handle: Handle = async ({ event, resolve }) => {
	// event.locals.supabase = createSupabaseServerClient(event.cookies);
	//
	// const { data, error } = await event.locals.supabase.auth.getUser();
	// if (error) console.error('getUser error:', error.message);
	// event.locals.user = data.user ?? null;
	//
	return resolve(event);
};
