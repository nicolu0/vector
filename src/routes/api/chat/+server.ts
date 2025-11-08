import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase';

const SYSTEM_PROMPT =
	'You are a knowledgable teacher. Respond concisely and help the user make progress on their milestones and tasks by answering any questions.';

type ConversationRow = { id: string; user_id: string };
type MessageRow = { id: string; role: 'assistant' | 'user'; content: string; created_at: string };

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => { throw error(400, 'Invalid JSON body'); });

	const conversationId =
		typeof body.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
	const content = typeof body.message === 'string' ? body.message.trim() : '';
	const suppliedUserId =
		typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null;

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
		{ role: 'system', content: SYSTEM_PROMPT },
		...(history ?? []).map((m) => ({
			// coerce any legacy/invalid roles to allowed ones
			role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
			content: m.content
		}))
	];

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
