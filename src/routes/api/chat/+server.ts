import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

const SYSTEM_PROMPT =
	'You are a knowledgable teacher. Respond concisely and help the user make progress on their milestones and tasks by answering any questions.';

type ConversationRow = { id: string; user_id: string };
type MessageRow = { id: string; role: 'assistant' | 'user'; content: string; created_at: string };
type ProjectContext = { id?: string; title?: string; description?: string; skills?: string[] };
type MilestoneContext = { id?: string; title?: string; summary?: string };
type TaskContext = { id?: string; title?: string; goal?: string };
type SanitizedContext = {
	project?: ProjectContext;
	milestone?: MilestoneContext;
	task?: TaskContext;
};
type ActiveSurface = 'task' | 'milestone' | null;

const toNonEmptyString = (value: unknown) => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
};

const toStringArray = (value: unknown) =>
	Array.isArray(value)
		? value
				.map((entry) => toNonEmptyString(entry))
				.filter((entry): entry is string => !!entry)
		: [];

const sanitizeProject = (value: unknown): ProjectContext | undefined => {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const project: ProjectContext = {};
	const id = toNonEmptyString(record.id);
	if (id) project.id = id;
	const title = toNonEmptyString(record.title);
	if (title) project.title = title;
	const description = toNonEmptyString(record.description);
	if (description) project.description = description;
	const skills = toStringArray(record.skills);
	if (skills.length) project.skills = skills;
	return Object.keys(project).length ? project : undefined;
};

const sanitizeMilestone = (value: unknown): MilestoneContext | undefined => {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const milestone: MilestoneContext = {};
	const id = toNonEmptyString(record.id);
	if (id) milestone.id = id;
	const title = toNonEmptyString(record.title);
	if (title) milestone.title = title;
	const summary = toNonEmptyString(record.summary);
	if (summary) milestone.summary = summary;
	return Object.keys(milestone).length ? milestone : undefined;
};

const sanitizeTask = (value: unknown): TaskContext | undefined => {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const task: TaskContext = {};
	const id = toNonEmptyString(record.id);
	if (id) task.id = id;
	const title = toNonEmptyString(record.title);
	if (title) task.title = title;
	const goal = toNonEmptyString(record.goal);
	if (goal) task.goal = goal;
	return Object.keys(task).length ? task : undefined;
};

const sanitizeContext = (value: unknown): SanitizedContext | null => {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const context: SanitizedContext = {};
	const project = sanitizeProject(record.project);
	if (project) context.project = project;
	const milestone = sanitizeMilestone(record.milestone);
	if (milestone) context.milestone = milestone;
	const task = sanitizeTask(record.task);
	if (task) context.task = task;
	return Object.keys(context).length ? context : null;
};

const formatSection = (title: string, lines: string[]) =>
	`${title}:\n${lines.map((line) => `- ${line}`).join('\n')}`;

const determineActiveSurface = (context: SanitizedContext | null): ActiveSurface => {
	if (!context) return null;
	const hasTask = !!context.task;
	const hasMilestone = !!context.milestone;
	if (hasTask && !hasMilestone) return 'task';
	if (hasMilestone && !hasTask) return 'milestone';
	return null;
};

const buildContextSummary = (context: SanitizedContext | null): { summary: string | null; active: ActiveSurface } => {
	if (!context) return { summary: null, active: null };
	const sections: string[] = [];
	const active = determineActiveSurface(context);

	if (active) {
		sections.push(
			formatSection('Current View', [
				active === 'task'
					? 'The user is currently focused on a specific task.'
					: 'The user is currently focused on a milestone overview.'
			])
		);
	}

	if (context.project) {
		const lines: string[] = [];
		if (context.project.title) lines.push(`Title: ${context.project.title}`);
		if (context.project.description) lines.push(`Description: ${context.project.description}`);
		if (context.project.skills?.length) lines.push(`Skills: ${context.project.skills.join(', ')}`);
		if (context.project.id) lines.push(`ID: ${context.project.id}`);
		if (lines.length) sections.push(formatSection('Project', lines));
	}

	if (context.milestone) {
		const lines: string[] = [];
		if (context.milestone.title) lines.push(`Title: ${context.milestone.title}`);
		if (context.milestone.summary) lines.push(`Summary: ${context.milestone.summary}`);
		if (context.milestone.id) lines.push(`ID: ${context.milestone.id}`);
		if (lines.length) sections.push(formatSection('Milestone', lines));
	}

	if (context.task) {
		const lines: string[] = [];
		if (context.task.title) lines.push(`Title: ${context.task.title}`);
		if (context.task.goal) lines.push(`Goal: ${context.task.goal}`);
		if (context.task.id) lines.push(`ID: ${context.task.id}`);
		if (lines.length) sections.push(formatSection('Task', lines));
	}

	return {
		summary: sections.length ? sections.join('\n\n') : null,
		active
	};
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => { throw error(400, 'Invalid JSON body'); });

	const conversationId =
		typeof body.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
	const content = typeof body.message === 'string' ? body.message.trim() : '';
	const suppliedUserId =
		typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null;
	const context = sanitizeContext(body.context);

	if (!conversationId) throw error(400, 'conversationId is required');
	if (!content) throw error(400, 'Message is required');

	const supabase = createSupabaseServerClient(cookies);
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw error(401, 'Not signed in');
	if (suppliedUserId && suppliedUserId !== user.id) throw error(403, 'User mismatch');

	const { data: conversation, error: conversationErr } = await supabase
		.from('conversations')
		.select('id,user_id')
		.eq('id', conversationId)
		.maybeSingle();
	if (conversationErr) throw error(500, conversationErr.message);
	if (!conversation || (conversation as ConversationRow).user_id !== user.id) throw error(403, 'Conversation not found');

	// 1) Save user message
	const { data: insertedUserMessage, error: insertUserErr } = await supabase
		.from('messages')
		.insert({
			conversation_id: conversationId,
			role: 'user',                // <- valid role
			content,
			user_id: user.id
		})
		.select('id, role, content, created_at')
		.single();
	if (insertUserErr) throw error(500, insertUserErr.message);

	// 2) Load history
	const { data: history, error: historyErr } = await supabase
		.from('messages')
		.select('role, content')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true });
	if (historyErr) throw error(500, historyErr.message);

	// 3) Build chat messages
	const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{ role: 'system', content: SYSTEM_PROMPT }
	];
	const { summary: contextSummary, active: activeSurface } = buildContextSummary(context);
	if (contextSummary) {
		chatMessages.push({
			role: 'system',
			content: `Workspace context that may help:\n${contextSummary}\nGround your answer in this information when useful.`
		});
	}
	if (activeSurface === 'task') {
		chatMessages.push({
			role: 'system',
			content: 'The user is inside a task view, so offer concrete next steps tied to that task.'
		});
	} else if (activeSurface === 'milestone') {
		chatMessages.push({
			role: 'system',
			content: 'The user is reviewing a milestone, so focus on milestone-level planning and progress.'
		});
	}
	chatMessages.push(
		...(history ?? []).map((m) => ({
			role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
			content: m.content
		}))
	);

	// 4) Call OpenAI (Chat Completions)
	let aiReply = 'I’m having trouble responding right now. Please try again in a moment.';
	if (OPENAI_API_KEY) {
		try {
			const client = new OpenAI({ apiKey: OPENAI_API_KEY });
			const completion = await client.chat.completions.create({
				model: 'gpt-5-2025-08-07',
				messages: chatMessages
			});
			aiReply = completion.choices[0]?.message?.content?.trim() || aiReply;
		} catch (e) {
			console.error('Chat completion failed', e);
		}
	}

	// 5) Save assistant message
	const { data: insertedAssistantMessage, error: insertAssistantErr } = await supabase
		.from('messages')
		.insert({
			conversation_id: conversationId,
			role: 'assistant',          // <- valid role
			content: aiReply,
			user_id: user.id
		})
		.select('id, role, content, created_at')
		.single();
	if (insertAssistantErr) throw error(500, insertAssistantErr.message);

	return json({
		userMessage: insertedUserMessage as MessageRow,
		assistantMessage: insertedAssistantMessage as MessageRow
	});
};
