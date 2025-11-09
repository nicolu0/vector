import type { LayoutServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

type Project = { id: string; title: string; description: string; skills: string[]; difficulty: string; domain: string } | null;
type Milestone = { id: string; title: string; project_id: string };
type Task = { id: string; title: string; milestone_id: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

export const load: LayoutServerLoad = async (event) => {
	const { cookies, url } = event;
	const supabase = createSupabaseServerClient(cookies);

	// OAuth exchange
	const errDesc = url.searchParams.get('error_description');
	if (errDesc) throw redirect(303, `/${'?auth_error=' + encodeURIComponent(errDesc)}`);
	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		throw redirect(303, url.pathname);
	}

	const {
		data: { user },
	} = await supabase.auth.getUser();
	console.log(user)

	const payload: {
		user: { id: string, email: string | undefined } | null;
		tutorial: boolean;
		goal: string;
		project: Project;
		milestones: Array<{ id: string; title: string }>;
		tasksByMilestone: Record<string, Array<{ id: string; title: string }>>;
		chat: { conversationId: string | null; messages: ChatMessage[] };
	} = {
		user: user ? { id: user.id, email: user.email } : null,
		tutorial: false,
		goal: '',
		project: null,
		milestones: [],
		tasksByMilestone: {},
		chat: { conversationId: null, messages: [] },
	};

	if (!user) return payload;

	const goalCookie = (cookies.get('vector:goal') ?? '').trim();

	const { data: profile } = await supabase
		.from('users')
		.select('goal, tutorial')
		.eq('user_id', user.id)
		.maybeSingle();

	const tutorialFlag = !!profile?.tutorial;
	payload.tutorial = tutorialFlag;
	let goal = (profile?.goal ? String(profile.goal) : '') || goalCookie;

	if (goalCookie && !profile) {
		const { error: insertErr } = await supabase
			.from('users')
			.insert([{ user_id: user.id, goal: goalCookie }]);
		if (!insertErr) cookies.delete('vector:goal', { path: '/' });
	} else if (goalCookie && profile && !profile.goal) {
		const { error: updateErr } = await supabase
			.from('users')
			.update({ goal: goalCookie })
			.eq('user_id', user.id);
		if (!updateErr) cookies.delete('vector:goal', { path: '/' });
	} else if (goalCookie) {
		cookies.delete('vector:goal', { path: '/' });
	}
	payload.goal = goal;

	if (!profile) {
		const { error: ensureProfileErr } = await supabase
			.from('users')
			.upsert({ user_id: user.id, goal: goal || null }, { onConflict: 'user_id' });
		if (ensureProfileErr) {
			console.error('Failed to ensure user profile', ensureProfileErr.message);
		}
	}

	const path = url.pathname;
	if (tutorialFlag) {
		if (path === '/' || path === '') throw redirect(303, '/tutorial');
	} else if (path === '/tutorial' || path === '/tutorial/') {
		throw redirect(303, '/');
	}

	// Ensure conversation exists and fetch messages
	let conversationId: string | null = null;
	const { data: existingConversation, error: fetchConvErr } = await supabase
		.from('conversations')
		.select('id')
		.eq('user_id', user.id)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (fetchConvErr) {
		console.error('Failed to fetch conversation', fetchConvErr.message);
	} else if (existingConversation) {
		conversationId = existingConversation.id;
	}

	if (!conversationId) {
		const { data: insertedConversation, error: insertConvErr } = await supabase
			.from('conversations')
			.insert({ user_id: user.id })
			.select('id')
			.single();

		if (insertConvErr) {
			console.error('Failed to insert conversation', insertConvErr.message);
			const { data: fallbackConversation } = await supabase
				.from('conversations')
				.select('id')
				.eq('user_id', user.id)
				.order('created_at', { ascending: true })
				.limit(1)
				.maybeSingle();
			if (fallbackConversation) conversationId = fallbackConversation.id;
		} else {
			conversationId = insertedConversation.id;
		}
	}

	if (conversationId) {
		const { data: chatMessages, error: messagesErr } = await supabase
			.from('messages')
			.select('id, role, content, created_at')
			.eq('conversation_id', conversationId)
			.order('created_at', { ascending: true });

		if (messagesErr) {
			console.error('Failed to load conversation messages', messagesErr.message);
		} else if (chatMessages) {
			payload.chat = {
				conversationId,
				messages: chatMessages.map((m) => ({
					id: m.id,
					role: m.role as ChatMessage['role'],
					content: typeof m.content === 'string' ? m.content : '',
					created_at: m.created_at,
				})),
			};
		} else {
			payload.chat = { conversationId, messages: [] };
		}
	}

	// Include 'skills' in the select list
	const { data: projRow, error: projErr } = await supabase
		.from('projects')
		.select('id,title,description,skills,difficulty,domain')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (projErr) return payload;

	// Normalize to ensure skills is always an array
	payload.project = projRow
		? {
			id: projRow.id,
			title: projRow.title,
			description: projRow.description,
			skills: Array.isArray(projRow.skills) ? projRow.skills : [],
			difficulty: projRow.difficulty,
			domain: projRow.domain,
		}
		: null;

	if (!payload.project) return payload;

	// Milestones
	const { data: msRows, error: msErr } = await supabase
		.from('milestones')
		.select('id,title,project_id')
		.eq('project_id', payload.project.id)
		.order('ordinal', { ascending: true });

	if (msErr || !msRows?.length) return payload;

	const milestones: Milestone[] = msRows;
	payload.milestones = milestones.map(({ id, title }) => ({ id, title }));

	// Tasks grouped by milestone
	const milestoneIds = milestones.map((m) => m.id);
	const { data: taskRows, error: taskErr } = await supabase
		.from('tasks')
		.select('id,title,milestone_id,done')
		.in('milestone_id', milestoneIds)
		.order('ordinal', { ascending: true });

	if (taskErr || !taskRows) return payload;

	const byMilestone: Record<string, Array<{ id: string; title: string }>> = {};
	for (const m of milestoneIds) byMilestone[m] = [];
	for (const t of taskRows as Task[]) {
		(byMilestone[t.milestone_id] ??= []).push({ id: t.id, title: t.title });
	}
	console.log(byMilestone);
	payload.tasksByMilestone = byMilestone;

	return payload;
};
