import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
    const { url, locals } = event;
    const supabase = locals.supabase;

    const installationIdParam = url.searchParams.get('installation_id');
    const state = url.searchParams.get('state');
    const setupAction = url.searchParams.get('setup_action') ?? 'install';

    if (!state) {
        console.error('GitHub setup callback missing state');
        throw error(400, 'Missing state');
    }

    if (!installationIdParam) {
        console.error('GitHub setup callback missing installation_id');
        throw error(400, 'Missing installation_id');
    }
    
    const installation_id = Number(installationIdParam);

    if (!Number.isFinite(installation_id)) {
        throw error(400, 'Invalid installation_id');
    }

    const { data: stateRow, error: stateErr } = await supabase
        .from('github_connect_states')
        .select('user_id')
        .eq('state', state)
        .maybeSingle();

    if (stateErr) {
        console.error('Failed to fetch GitHub connect state:', stateErr.message);
        throw error(500, 'Failed to verify GitHub connection');
    }

    if (!stateRow) {
        console.error('No GitHub connect state found for state:', state);
        throw error(400, 'Invalid or expired state');
    }

    const user_id = stateRow.user_id;

    const { error: installErr } = await supabase
        .from('github_installations')
        .upsert(
            { installation_id, user_id },
            { onConflict: 'installation_id' }
        );

    if (installErr) {
        console.error('Failed to upsert GitHub installation:', installErr.message);
        throw error(500, 'Failed to save GitHub installation');
    }
    
    const { error: deleteErr } = await supabase
        .from('github_connect_states')
        .delete()
        .eq('state', state);

    if (deleteErr) {
        console.error('Failed to delete GitHub connect state:', deleteErr.message);
    }
    
    throw redirect(303, '/');
}