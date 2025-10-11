import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { isProject, type Project, type Milestone, type Metadata } from '$lib/types/project';

const MIN_RATING = 0;
const MIN_CONFIDENCE = 0;

function normalizeTopic(value: string) {
	return value.trim().toLowerCase();
}

function formatList(items: string[]): string {
	if (items.length === 0) return '';
	if (items.length === 1) return items[0];
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function prerequisitePrompt(topic: string) {
	const trimmed = topic.trim().replace(/[?.!]+$/, '');
	const lower = trimmed.toLowerCase();

	if (lower.startsWith('comfortable with')) {
		const rest = trimmed.slice('comfortable with'.length).trim();
		return rest ? `are you comfortable with ${rest}?` : 'are you comfortable with the basics?';
	}

	if (lower.startsWith('experience with')) {
		const rest = trimmed.slice('experience with'.length).trim();
		return rest ? `how much experience do you have with ${rest}?` : 'how much experience do you have with it?';
	}

	if (lower.startsWith('experience using')) {
		const rest = trimmed.slice('experience using'.length).trim();
		return rest
			? `how much experience do you have using ${rest}?`
			: 'how much experience do you have using it?';
	}

	if (lower.startsWith('familiarity with')) {
		const rest = trimmed.slice('familiarity with'.length).trim();
		return rest ? `how familiar are you with ${rest}?` : 'how familiar are you with the basics?';
	}

	return `how comfortable are you with ${trimmed}?`;
}

function extractMilestoneTopics(metadata: Metadata | null | undefined): string[] {
	if (!metadata || !Array.isArray(metadata.milestones)) return [];
	const topics: string[] = [];
	for (const milestone of metadata.milestones as (Milestone | null | undefined)[]) {
		if (!milestone) continue;
		const { name, objective, success_metrics } = milestone;
		if (typeof name === 'string' && name.trim()) topics.push(name.trim());
		if (typeof objective === 'string' && objective.trim()) topics.push(objective.trim());
		if (Array.isArray(success_metrics)) {
			for (const metric of success_metrics) {
				if (typeof metric === 'string' && metric.trim()) {
					topics.push(metric.trim());
				}
			}
		}
	}
	return topics;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createSupabaseServerClient(cookies);

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid JSON payload.' }, { status: 400 });
	}

	const { conversation_id, project } = body as {
		conversation_id?: string;
		project?: unknown;
	};

	if (!conversation_id || typeof conversation_id !== 'string') {
		return json({ error: 'conversation_id is required.' }, { status: 400 });
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

	// Skip if the conversation already has messages.
	const { data: existingMessages, error: messageError } = await supabase
		.from('messages')
		.select('id')
		.eq('conversation_id', conversation_id)
		.limit(1);

	if (messageError) {
		return json({ error: messageError.message }, { status: 500 });
	}

	if (existingMessages && existingMessages.length > 0) {
		return json({ already_initialized: true }, { status: 200 });
	}

	const { data: ratings, error: ratingsError } = await supabase
		.from('user_ratings')
		.select('topic, rating, confidence')
		.eq('user_id', user.id);

	if (ratingsError) {
		return json({ error: ratingsError.message }, { status: 500 });
	}

	const ratingMap = new Map<
		string,
		{
			rating: number | null;
			confidence: number | null;
		}
	>();

	for (const rating of ratings ?? []) {
		if (!rating?.topic || typeof rating.topic !== 'string') continue;
		ratingMap.set(normalizeTopic(rating.topic), {
			rating: typeof rating.rating === 'number' ? rating.rating : null,
			confidence: typeof rating.confidence === 'number' ? rating.confidence : null
		});
	}

	const prerequisites = Array.isArray(project.prerequisites)
		? project.prerequisites.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
		: [];
	const skills = Array.isArray(project.skills)
		? project.skills.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
		: [];
	const milestoneTopics = extractMilestoneTopics(project.metadata);

	function topicKnown(topic: string) {
		const entry = ratingMap.get(normalizeTopic(topic));
		if (!entry) return false;
		const ratingScore = entry.rating ?? 0;
		const confidenceScore = entry.confidence ?? 0;
		return ratingScore >= MIN_RATING && confidenceScore >= MIN_CONFIDENCE;
	}

	const knownPrereqs = prerequisites.filter((topic) => topicKnown(topic));
	const unknownPrereqs = prerequisites.filter((topic) => !topicKnown(topic));

	const knownSkills = skills.filter((topic) => topicKnown(topic));
	const unknownSkills = skills.filter((topic) => !topicKnown(topic));

	const knownMilestones = milestoneTopics.filter((topic) => topicKnown(topic));
	const unknownMilestones = milestoneTopics.filter((topic) => !topicKnown(topic));

	let message: string;

	if (unknownPrereqs.length > 0) {
		const target = unknownPrereqs[0];
		const highlightPrefix = knownPrereqs.length
			? `I noticed you're already confident with ${formatList(knownPrereqs.slice(0, 2))}. `
			: '';
		message = `Hi! ${highlightPrefix}Before we dive into "${project.title}", ${prerequisitePrompt(target)}`;
	} else if (prerequisites.length > 0) {
		const firstMilestone = project.metadata?.milestones?.[0];
		const milestoneName = firstMilestone?.name ?? (unknownMilestones[0] ?? knownMilestones[0] ?? null);
		const highlightSkills = knownSkills.length ? formatList(knownSkills.slice(0, 2)) : null;
		const skillNote = highlightSkills ? ` You're already strong in ${highlightSkills}.` : '';
		if (milestoneName) {
			message = `Hi!${skillNote} Ready to kick off milestone "${milestoneName}" together?`;
		} else {
			message = `Hi!${skillNote} Which part of "${project.title}" would you like to tackle first?`;
		}
	} else if (unknownSkills.length > 0) {
		const targetSkill = unknownSkills[0];
		message = `Hi! I'm curious about your background—how comfortable are you with ${targetSkill}?`;
	} else {
		const fallbackMilestone = project.metadata?.milestones?.[0]?.name ?? null;
		if (fallbackMilestone) {
			message = `Hi! You're set on the fundamentals. Ready to start milestone "${fallbackMilestone}"?`;
		} else {
			message = `Hi! What would you like to explore first within "${project.title}"?`;
		}
	}

	// Determine next sequence value
	const { data: lastMessage, error: sequenceError } = await supabase
		.from('messages')
		.select('sequence')
		.eq('conversation_id', conversation_id)
		.order('sequence', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (sequenceError) {
		return json({ error: sequenceError.message }, { status: 500 });
	}

	const nextSequence = (typeof lastMessage?.sequence === 'number' ? lastMessage.sequence : 0) + 1;

	const { data: inserted, error: insertError } = await supabase
		.from('messages')
		.insert([
			{
				conversation_id,
				user_id: user.id,
				content: message,
				role: 'mentor',
				sequence: nextSequence
			}
		])
		.select('id, conversation_id, user_id, content, sequence, created_at, role')
		.single();

	if (insertError) {
		return json({ error: insertError.message }, { status: 500 });
	}

	return json(
		{
			message: inserted,
			missing_prerequisites: unknownPrereqs,
			known_prerequisites: knownPrereqs,
			known_skills: knownSkills
		},
		{ status: 201 }
	);
};
