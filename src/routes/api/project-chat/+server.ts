import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Metadata, Milestone } from '$lib/types/project';
import type { RequestHandler } from './$types';

const MODEL_ID = 'gpt-5-nano-2025-08-07';

type ChatRole = 'user' | 'mentor';
type ChatMessage = { role: ChatRole; content: string };

type ProjectPayload = {
	title: string;
	description: string;
	difficulty: string;
	timeline: string;
	skills: string[];
	prerequisites?: string[];
	metadata: Metadata;
	jobs: Array<{ title: string; url: string }>;
};

type Stage = 'Introduction' | 'Implementation';

const MENTOR_REPLY_SCHEMA = {
	type: 'json_schema',
	name: 'mentor_reply',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['content', 'stage'],
		properties: {
			content: {
				type: 'string',
				minLength: 1,
				maxLength: 600 // ~100–120 words; keeps answers concise but useful
			},
			stage: {
				type: 'string',
				enum: ['Introduction', 'Implementation']
			}
		}
	}
} as const;

function formatProjectContext(project: ProjectPayload) {
	const prereqs = (project.prerequisites ?? []).filter((p) => typeof p === 'string' && p.trim());
	const milestones = (project.metadata?.milestones ?? []).map((m: Milestone, i: number) => {
		const metrics = (m.success_metrics ?? []).map((s) => `- ${s}`).join('\n');
		return `${i + 1}. ${m.name}\nObjective: ${m.objective}\n${metrics ? `Success:\n${metrics}` : ''}`;
	});
	return [
		`Title: ${project.title}`,
		`Difficulty: ${project.difficulty}`,
		`Timeline: ${project.timeline}`,
		`Description: ${project.description}`,
		project.skills.length ? `Skills:\n- ${project.skills.join('\n- ')}` : null,
		prereqs.length ? `Prerequisites:\n- ${prereqs.join('\n- ')}` : null,
		milestones.length ? `Milestones:\n${milestones.join('\n\n')}` : null
	]
		.filter(Boolean)
		.join('\n\n');
}

function formatConversation(messages: ChatMessage[]) {
	return messages.map((m) => `${m.role === 'mentor' ? 'Mentor' : 'User'}: ${m.content}`).join('\n');
}

function extractStageFromLastMentor(messages: ChatMessage[]): Stage | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role !== 'mentor') continue;
		try {
			const o = JSON.parse(m.content) as { content?: string; stage?: Stage };
			if (o && (o.stage === 'Introduction' || o.stage === 'Implementation')) return o.stage;
		} catch {
			// ignore legacy/non-JSON mentor content
		}
	}
	return null;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid JSON payload.' }, { status: 400 });

	const { project, messages } = body as {
		project: ProjectPayload | null;
		messages: ChatMessage[];
	};

	if (!project || !Array.isArray(messages) || messages.length === 0) {
		return json({ error: 'Project context and messages are required.' }, { status: 400 });
	}

	const currentStage: Stage = extractStageFromLastMentor(messages) ?? 'Introduction';

	const client = new OpenAI({ apiKey: OPENAI_API_KEY });

	const instructions = [
		'You are a concise, practical mentor for a Python Tetris project.',
		'Return ONLY JSON matching the provided schema. No extra text.',
		'Guidelines:',
		'- Keep content 1–3 short sentences.',
		'- Ask at most one question if needed.',
		'- Introduction: assess Python experience; guide setup to completion if needed.',
		'- Switch to Implementation once env ready (Python installed, venv created, deps installed, run loop scaffolded).',
		'- Implementation: guide concrete feature steps (loop, input, gravity, rotation, scoring).'
	].join('\n');

	const prompt = [
		instructions,
		'',
		`Current stage: ${currentStage}`,
		'',
		'Project context:',
		formatProjectContext(project),
		'',
		'Conversation:',
		formatConversation(messages)
	].join('\n');

	try {
		const res = await client.responses.create({
			model: MODEL_ID,
			instructions: 'Follow the schema exactly. No prose outside the JSON.',
			input: prompt,
			text: { format: MENTOR_REPLY_SCHEMA }
		});

		// With text.format + strict schema, this should already be valid JSON.
		const output = (res.output_text ?? '').trim();

		if (!output) {
			// graceful fallback keeps UX moving
			return json(
				currentStage === 'Introduction'
					? {
						content:
							'Do you have Python installed and can you create a virtual environment?',
						stage: 'Introduction' as Stage,
						format_ok: false
					}
					: {
						content:
							'Let’s implement the game loop: window, tick/update/draw. Ready?',
						stage: 'Implementation' as Stage,
						format_ok: false
					},
				{ status: 200 }
			);
		}

		// Parse to return fields as primitives (client stores stringified already)
		const parsed = JSON.parse(output) as { content: string; stage: Stage };
		return json(parsed, { status: 200 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		// Fallback keeps conversation usable
		return json(
			currentStage === 'Introduction'
				? {
					content:
						'Do you have Python installed and can you create a virtual environment?',
					stage: 'Introduction' as Stage,
					error: message
				}
				: {
					content:
						'Let’s implement the game loop: window, tick/update/draw. Ready?',
					stage: 'Implementation' as Stage,
					error: message
				},
			{ status: 200 }
		);
	}
};
