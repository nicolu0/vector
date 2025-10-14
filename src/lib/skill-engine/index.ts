import type { SupabaseClient } from '@supabase/supabase-js';

export type TopicRating = { topic: string; rating: number; confidence?: number };

export type MentorAction =
	| { type: 'none'; note?: string }
	| { type: 'assess_skills'; topics: string[]; note?: string }
	| { type: 'update_ratings'; ratings: TopicRating[]; note?: string }
	| { type: 'recommend_skills'; topics: string[]; note?: string };

export function clampRating(x: number) {
	return Math.max(0, Math.min(5, Math.round(x)));
}
export function clampConf(x?: number) {
	return typeof x === 'number' && !Number.isNaN(x) ? Math.max(0, Math.min(1, x)) : undefined;
}

// Optional alias → canonical mapping
const CANONICAL: Record<string, string> = {
	venv: 'py.env.venv',
	pip: 'py.pkg.pip',
	pygame: 'py.graphics.pygame',
	keyboard: 'py.input.keyboard',
	fps: 'py.timing.fps',
	loops: 'py.basics.loops'
};

function canonicalize(raw: string) {
	const k = String(raw ?? '').trim().toLowerCase();
	return CANONICAL[k] ?? k; // also lowercases custom topics
}

export function createSkillEngine(supabase: SupabaseClient) {
	async function upsertRatings(user_id: string, ratings: TopicRating[]) {
		if (!ratings?.length) return { updated_count: 0 };

		const rows = ratings.map(({ topic, rating, confidence }) => ({
			user_id,
			topic: canonicalize(topic),
			rating: clampRating(rating),
			confidence: clampConf(confidence)
		}));

		const { error } = await supabase
			.from('user_ratings')
			.upsert(rows, { onConflict: 'user_id,topic' });

		if (error) throw error;
		return { updated_count: rows.length };
	}

	async function executeAction(user_id: string, action: MentorAction) {
		switch (action?.type) {
			case 'update_ratings': {
				const res = await upsertRatings(user_id, action.ratings ?? []);
				return { action, result: res };
			}
			case 'assess_skills': {
				return { action, result: { requested: (action.topics ?? []).map(canonicalize) } };
			}
			case 'recommend_skills': {
				return { action, result: { recommended: (action.topics ?? []).map(canonicalize) } };
			}
			case 'none':
			default:
				return { action: { type: 'none', note: action?.note }, result: null };
		}
	}

	return { executeAction };
}
