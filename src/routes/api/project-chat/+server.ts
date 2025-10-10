import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import {
	OPENAI_API_KEY
} from '$env/static/private';
import type { RequestHandler } from './$types';

const MODEL_ID = 'gpt-5-nano-2025-08-07';

type ChatRole = 'user' | 'mentor';

type ChatMessage = {
	role: ChatRole;
	content: string;
};

type ProjectPayload = {
	title: string;
	description: string;
	difficulty: string;
	timeline: string;
	skills: string[];
	jobs: Array<{ title: string; url: string }>;
};

const BASE_INSTRUCTIONS =
	'You are a seasoned engineering mentor. Offer concise, practical guidance tailored to the project context. Reference concrete next steps, resources, or feedback. Keep responses under 180 words.';

function formatProjectContext(project: ProjectPayload) {
	const lines = [
		`Title: ${project.title}`,
		`Difficulty: ${project.difficulty}`,
		`Timeline: ${project.timeline}`,
		`Description: ${project.description}`,
		project.skills.length ? `Key skills:\n- ${project.skills.join('\n- ')}` : null,
		project.jobs.length
			? `Related roles:\n${project.jobs.map((job) => `- ${job.title} (${job.url})`).join('\n')}`
			: null
	].filter(Boolean);

	return lines.join('\n\n');
}

function formatConversation(messages: ChatMessage[]) {
	return messages
		.map((message) => {
			const speaker = message.role === 'mentor' ? 'Mentor' : 'User';
			return `${speaker}: ${message.content}`;
		})
		.join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
	if (!OPENAI_API_KEY) {
		return json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
	}

	const body = await request.json().catch(() => null);
	console.log('body', body);
	if (!body) {
		return json({ error: 'Invalid JSON payload.' }, { status: 400 });
	}

	const { project, messages } = body as {
		project: ProjectPayload | null;
		messages: ChatMessage[];
	};

	if (!project || !messages || !Array.isArray(messages) || messages.length === 0) {
		return json({ error: 'Project context and messages are required.' }, { status: 400 });
	}

	const client = new OpenAI({ apiKey: OPENAI_API_KEY });

	const promptSections = [
		BASE_INSTRUCTIONS,
		'Project context:',
		formatProjectContext(project),
		'Conversation so far:',
		formatConversation(messages),
		'Respond as the mentor to the latest user message.'
	];

	if (messages[messages.length - 1]?.role !== 'user') {
		promptSections.push(
			'Note: The last message was not from the user. If no user question remains, provide proactive guidance.'
		);
	}

	const prompt = promptSections.join('\n\n');

	try {
		const response = await client.responses.create({
			model: MODEL_ID,
			instructions: BASE_INSTRUCTIONS,
			input: prompt
		});

		const text = response.output_text?.trim();
		if (!text) {
			return json({ error: 'Model returned no content.' }, { status: 502 });
		}

		return json({ content: text }, { status: 200 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 502 });
	}
};
