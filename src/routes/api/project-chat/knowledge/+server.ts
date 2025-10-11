import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { isProject, type Metadata, type Milestone } from '$lib/types/project';

const KNOWLEDGE_SCHEMA = {
	type: 'json_schema',
	name: 'knowledge_update',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['updates'],
		properties: {
			updates: {
				type: 'array',
				maxItems: 5,
				items: {
					type: 'object',
					required: ['topic', 'intent', 'rating_delta', 'confidence_delta', 'reason', 'trigger'],
					additionalProperties: false,
					properties: {
						topic: { type: 'string', minLength: 2, maxLength: 80 },
						intent: {
							type: 'string',
							enum: ['knowledge_gap', 'proficiency_claim', 'uncertain', 'question']
						},
						trigger: {
							type: 'string',
							enum: ['mentor_question', 'user_question', 'self_report']
						},
						rating_delta: { type: 'integer', minimum: -400, maximum: 400 },
						confidence_delta: { type: 'number', minimum: -0.5, maximum: 0.5 },
						reason: { type: 'string', minLength: 10, maxLength: 300 }
					}
				}
			}
		}
	},
	strict: true
} as const;

const RATING_FLOOR = 400;
const RATING_CEILING = 1600;

type HistoryMessage = {
	role: 'user' | 'mentor';
	content: string;
};

type KnowledgeUpdate = {
	topic: string;
	intent: 'knowledge_gap' | 'proficiency_claim' | 'uncertain' | 'question';
	trigger: 'mentor_question' | 'user_question' | 'self_report';
	rating_delta: number;
	confidence_delta: number;
	reason: string;
};

function normalizeTopic(value: string) {
	return value.trim().toLowerCase();
}

function buildTopicCatalog(project: {
	prerequisites: string[];
	skills: string[];
	metadata: Metadata;
}) {
	const catalog = new Set<string>();

	for (const item of project.prerequisites ?? []) {
		if (typeof item === 'string' && item.trim()) catalog.add(item.trim());
	}

	for (const item of project.skills ?? []) {
		if (typeof item === 'string' && item.trim()) catalog.add(item.trim());
	}

	if (project.metadata?.milestones?.length) {
		for (const milestone of project.metadata.milestones as Milestone[]) {
			if (milestone?.name?.trim()) catalog.add(milestone.name.trim());
			if (milestone?.objective?.trim()) catalog.add(milestone.objective.trim());
			if (Array.isArray(milestone?.success_metrics)) {
				for (const metric of milestone.success_metrics) {
					if (typeof metric === 'string' && metric.trim()) catalog.add(metric.trim());
				}
			}
		}
	}

	return Array.from(catalog);
}

function createOpenAI() {
	if (!OPENAI_API_KEY) return null;
	return new OpenAI({ apiKey: OPENAI_API_KEY });
}

async function runLLMAnalysis({
	project,
	history,
	userMessage
}: {
	project: {
		title: string;
		prerequisites: string[];
		skills: string[];
		metadata: Metadata;
	};
	history: HistoryMessage[];
	userMessage: string;
}): Promise<KnowledgeUpdate[] | null> {
	const client = createOpenAI();
	if (!client) return null;

	const topicCatalog = buildTopicCatalog(project);
	const historySummary = history
		.map((entry) => `${entry.role === 'mentor' ? 'Mentor' : 'User'}: ${entry.content}`)
		.join('\n');

	const promptSections = [
		`You are a skill profiler that tracks learner readiness on a chess-like rating scale.`,
		`Rating anchors: 400=new, 800=beginner, 1000=intermediate, 1200=advanced, 1400+=expert.`,
		`Candidate topics (prefer closest match; reuse exact phrasing when relevant):`,
		topicCatalog.length ? topicCatalog.map((topic) => `- ${topic}`).join('\n') : '- (none provided)',
		`Conversation (newest last):\n${historySummary || '(no prior messages)'}`,
		`Latest learner message:\n${userMessage}`,
		`Decide if the learner expressed confidence, uncertainty, or a knowledge gap about any topic.`,
		`Rules:`,
		`- If this is the learner answering a mentor proficiency check, set trigger to "mentor_question".`,
		`- If the learner asks "what/how/why" about a topic, treat as knowledge gap (trigger "user_question").`,
		`- Use positive rating_delta (100–250) for firm proficiency claims; negative (-200 to -100) for gaps.`,
		`- Keep confidence deltas modest (±0.1 to ±0.2).`,
		`- Never invent topics outside the catalog unless the learner references a clearly named concept; if unsure, skip.`,
		`- If no actionable signal, return an empty updates array.`
	];

	try {
		const response = await client.responses.create({
			model: 'gpt-5-nano-2025-08-07',
			instructions:
				'Analyze learner proficiency statements and produce rating adjustments using the provided JSON schema.',
			input: promptSections.join('\n\n'),
			text: { format: KNOWLEDGE_SCHEMA }
		});

		const output = response.output_text;
		if (!output) return null;

		const parsed = JSON.parse(output) as { updates?: KnowledgeUpdate[] };
		if (!Array.isArray(parsed.updates)) return [];
		return parsed.updates;
	} catch (err) {
		console.error('[knowledge] LLM analysis failed', err);
		return null;
	}
}

function applyFallbackHeuristics({
	project,
	userMessage
}: {
	project: { prerequisites: string[]; skills: string[]; metadata: Metadata };
	userMessage: string;
}): KnowledgeUpdate[] {
	const catalog = buildTopicCatalog(project);

	const questionMatch = /(what|how|why|where|when)\s+(is|are|do|does|should)\s+([a-z0-9\- ]+)/i.exec(
		userMessage
	);

	if (!questionMatch) return [];

	const phrase = questionMatch[3]?.trim();
	if (!phrase) return [];

	let matchedTopic = catalog.find((topic) => normalizeTopic(topic).includes(phrase.toLowerCase()));
	if (!matchedTopic && phrase.length > 2) {
		matchedTopic = phrase;
	}

	if (!matchedTopic) return [];

	return [
		{
			topic: matchedTopic,
			intent: 'knowledge_gap',
			trigger: 'user_question',
			rating_delta: -150,
			confidence_delta: -0.1,
			reason: 'Learner asked a fundamental question suggesting low familiarity.'
		}
	];
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createSupabaseServerClient(cookies);

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid JSON payload.' }, { status: 400 });
	}

	const { conversation_id, project, message, history } = body as {
		conversation_id?: string;
		project?: unknown;
		message?: { id?: string; content?: string | null };
		history?: HistoryMessage[];
	};

	if (!conversation_id || typeof conversation_id !== 'string') {
		return json({ error: 'conversation_id is required.' }, { status: 400 });
	}

	if (!message?.id || typeof message.id !== 'string' || typeof message.content !== 'string') {
		return json({ error: 'message id and content are required.' }, { status: 400 });
	}

	if (!project || !isProject(project)) {
		return json({ error: 'Valid project payload is required.' }, { status: 400 });
	}

	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();

	if (userError) {
		return json({ error: userError.message }, { status: 500 });
	}

	if (!user?.id) {
		return json({ error: 'Not authenticated.' }, { status: 401 });
	}

	// Ensure the message exists and belongs to the conversation.
	const { data: messageRow, error: messageFetchError } = await supabase
		.from('messages')
		.select('id, user_id, conversation_id, action')
		.eq('id', message.id)
		.eq('conversation_id', conversation_id)
		.single();

	if (messageFetchError) {
		return json({ error: messageFetchError.message }, { status: 500 });
	}

	if (!messageRow) {
		return json({ error: 'Message not found.' }, { status: 404 });
	}

	if (messageRow.user_id !== user.id) {
		return json({ error: 'Cannot modify another user’s message.' }, { status: 403 });
	}

	if (
		messageRow.action &&
		typeof messageRow.action === 'object' &&
		(messageRow.action as { type?: string | null })?.type === 'user_rating_update'
	) {
		return json({ action: messageRow.action, updates: [] }, { status: 200 });
	}

	const historyMessages = Array.isArray(history)
		? history
				.filter(
					(entry): entry is HistoryMessage =>
						entry != null &&
						(entry.role === 'user' || entry.role === 'mentor') &&
						typeof entry.content === 'string'
				)
		: [];

	let updates = await runLLMAnalysis({
		project,
		history: historyMessages,
		userMessage: message.content
	});

	if (updates === null) {
		updates = applyFallbackHeuristics({ project, userMessage: message.content });
	}

	if (!updates || updates.length === 0) {
		return json({ action: null, updates: [] }, { status: 200 });
	}

	const { data: existingRatings, error: ratingsError } = await supabase
		.from('user_ratings')
		.select('topic, rating, confidence')
		.eq('user_id', user.id);

	if (ratingsError) {
		return json({ error: ratingsError.message }, { status: 500 });
	}

	const ratingMap = new Map<
		string,
		{ topic: string; rating: number | null; confidence: number | null }
	>();
	for (const row of existingRatings ?? []) {
		if (!row?.topic || typeof row.topic !== 'string') continue;
		ratingMap.set(normalizeTopic(row.topic), {
			topic: row.topic,
			rating: typeof row.rating === 'number' ? row.rating : null,
			confidence: typeof row.confidence === 'number' ? row.confidence : null
		});
	}

	type AppliedUpdate = {
		topic: string;
		old_rating: number | null;
		new_rating: number;
		rating_delta: number;
		old_confidence: number | null;
		new_confidence: number;
		confidence_delta: number;
		intent: KnowledgeUpdate['intent'];
		trigger: KnowledgeUpdate['trigger'];
		reason: string;
	};

	const appliedUpdates: AppliedUpdate[] = [];

	for (const update of updates) {
		if (!update?.topic || typeof update.topic !== 'string') continue;
		const topic = update.topic.trim();
		if (!topic) continue;

		const key = normalizeTopic(topic);
		const existing = ratingMap.get(key);

		const oldRating = existing?.rating ?? null;
		const baselineRating = oldRating ?? RATING_FLOOR;
		const proposedDelta = Number.isFinite(update.rating_delta) ? update.rating_delta : 0;
		let newRating = Math.round(baselineRating + proposedDelta);
		if (!existing && proposedDelta > 0) {
			newRating = Math.max(RATING_FLOOR, Math.round(RATING_FLOOR + proposedDelta));
		}
		newRating = Math.max(RATING_FLOOR, Math.min(RATING_CEILING, newRating));

		const oldConfidence = existing?.confidence ?? null;
		const baselineConfidence = oldConfidence ?? 0.25;
		const proposedConfidenceDelta =
			typeof update.confidence_delta === 'number' ? update.confidence_delta : 0;
		let newConfidence = baselineConfidence + proposedConfidenceDelta;
		newConfidence = Math.max(0, Math.min(1, newConfidence));

		const storedTopic = existing?.topic ?? topic;

		appliedUpdates.push({
			topic: storedTopic,
			old_rating: oldRating,
			new_rating: newRating,
			rating_delta: newRating - (oldRating ?? RATING_FLOOR),
			old_confidence: oldConfidence,
			new_confidence: newConfidence,
			confidence_delta: newConfidence - (oldConfidence ?? 0.25),
			intent: update.intent,
			trigger: update.trigger,
			reason: update.reason
		});

		ratingMap.set(key, {
			topic: storedTopic,
			rating: newRating,
			confidence: newConfidence
		});
	}

	if (appliedUpdates.length === 0) {
		return json({ action: null, updates: [] }, { status: 200 });
	}

	const upsertPayload = appliedUpdates.map((update) => ({
		user_id: user.id,
		topic: update.topic,
		rating: update.new_rating,
		confidence: update.new_confidence
	}));

	const { error: upsertError } = await supabase
		.from('user_ratings')
		.upsert(upsertPayload, { onConflict: 'user_id,topic' });

	if (upsertError) {
		return json({ error: upsertError.message }, { status: 500 });
	}

	const actionPayload = {
		type: 'user_rating_update',
		source: 'mentor_proficiency_classifier',
		updates: appliedUpdates
	};

	const { error: actionUpdateError } = await supabase
		.from('messages')
		.update({ action: actionPayload })
		.eq('id', message.id)
		.eq('conversation_id', conversation_id);

	if (actionUpdateError) {
		return json({ error: actionUpdateError.message }, { status: 500 });
	}

	return json({ action: actionPayload, updates: appliedUpdates }, { status: 200 });
};
