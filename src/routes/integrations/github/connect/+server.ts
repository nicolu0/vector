import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

const GITHUB_APP_SLUG = 'joinvector-ai';

export const GET: RequestHandler = async (event) => {
    const { locals } = event;
    const supabase = locals.supabase;
    const user = locals.user;

    if (!user) {
        throw redirect(303, '/');
    }

    const state = randomUUID();
    
    const { error: insertErr } = await supabase
        .from('github_connect_states')
        .insert({state, user_id: user.id});

    if (insertErr) {
        console.error('Failed to insert GitHub connect state:', insertErr);
        throw error(500, insertErr.message);
    }

    const installUrl = new URL(`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`);

    installUrl.searchParams.set('state', state);
    
    throw redirect(302, installUrl.toString());
}