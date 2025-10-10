import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
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

/* -------------------------------------------------------------------------- */
/*                          Tutor + Navigator Instructions                    */
/* -------------------------------------------------------------------------- */

const BASE_INSTRUCTIONS = `
You are a **Tutor + Navigator** for software projects. Diagnose quickly, choose a path, and direct the user with one perfectly tuned step. Teach them to build it themselves (lego-set mindset).

Behavior:
- Be terse. ≤ 60 words total.
- Use 3–5 bullets (each ≤ 12 words, imperative, neutral).
- Prefer one decisive step over broad planning. Favor vertical slices.
- Ask at most one clarifying question only when essential.
- Include acceptance criteria when proposing work.
- Up to 2 links; prefer official docs.
- If a concept/setup would exceed ~90 words or is foundational/risky, create a mini-doc and keep chat short. Emit exactly: Doc created: "TITLE"
- **Do not provide working code snippets**. Do not paste runnable functions, full components, or long commands. Teach the approach, call out file names, APIs, or docs instead.
- No preambles, apologies, restating the question, or meta commentary.

Formatting: Use **Vector Chat Markdown v1** (strict) exactly. Nothing else.
`;

/**
 * Strict output format the model must follow.
 * We forbid fenced code; only tiny inline identifiers/commands are allowed.
 */
const VECTOR_CHAT_MD_SPEC = `
Vector Chat Markdown v1 (strict)
1) Bullets first: 3–5 lines, each starts with "- " (dash + space). ≤ 12 words each. Imperative voice.
2) Optional mini-doc line (exact form):
   Doc created: "TITLE"
3) Then exactly ONE of:
   **Next action:** ...
   **Question:** ...
4) Optional acceptance criteria line:
   **Done when:** ...

Rules:
- ONLY REPLY WITH helpful material. Every word should be somehow related to responding usefully to the user's input.
- That includes not starting the response with Vector Chat Markdown v1 (strict)
- Total reply ≤ 60 words (excluding link URLs).
- Max 2 markdown links: [text](https://...)
- Inline code allowed only for short identifiers/commands (e.g., \`svelte:store\`, \`npm init\`). **No fenced code blocks** and no multi-line code. If code would be required, create a doc instead.
- No headings, greetings, emoji, blockquotes, tables, footers, or extra sections.
- Do not add any text before bullets or after the final line.
`;


function formatProjectContext(project: ProjectPayload) {
	const lines = [
		`Title: ${project.title}`,
		`Difficulty: ${project.difficulty}`,
		`Timeline: ${project.timeline}`,
		`Description: ${project.description}`,
		project.skills.length ? `Key skills:\n- ${project.skills.join('\n- ')}` : null,
		project.jobs.length
			? `Related roles:\n${project.jobs.map((j) => `- ${j.title} (${j.url})`).join('\n')}`
			: null
	].filter(Boolean);
	return lines.join('\n\n');
}

function formatConversation(messages: ChatMessage[]) {
	return messages
		.map((m) => `${m.role === 'mentor' ? 'Mentor' : 'User'}: ${m.content}`)
		.join('\n');
}

/* -------------------------------------------------------------------------- */
/*                       Minimal server-side format guard                      */
/* -------------------------------------------------------------------------- */

function validateVectorChatMarkdown(text: string) {
	const trimmed = text.trim();

	// Hard block: fenced code (we don't allow runnable code)
	if (/```/.test(trimmed)) {
		return { ok: false, reason: 'fenced_code_block_forbidden' };
	}

	const lines = trimmed.split(/\r?\n/);

	// Must start with 3–5 bullet lines
	const bulletLines: string[] = [];
	for (const line of lines) {
		if (/^-\s+/.test(line)) bulletLines.push(line);
		else break;
	}
	if (bulletLines.length < 3 || bulletLines.length > 5) {
		return { ok: false, reason: 'bullet_count' };
	}

	// After bullets: optional doc line
	let idx = bulletLines.length;
	let sawDoc = false;
	if (idx < lines.length && /^Doc created:\s+"[^"]+"\s*$/.test(lines[idx])) {
		sawDoc = true;
		idx += 1;
	}

	// Then exactly one of Next action / Question
	if (idx >= lines.length) return { ok: false, reason: 'missing_action_or_question' };

	const actionRe = /^\*\*Next action:\*\*\s+.+$/;
	const questionRe = /^\*\*Question:\*\*\s+.+$/;

	const hasAction = actionRe.test(lines[idx]);
	const hasQuestion = questionRe.test(lines[idx]);
	const exactlyOne = hasAction !== hasQuestion;
	if (!exactlyOne) {
		return { ok: false, reason: 'bad_action_or_question' };
	}
	idx += 1;

	// Optional Done when
	if (idx < lines.length) {
		const doneWhenRe = /^\*\*Done when:\*\*\s+.+$/;
		if (!doneWhenRe.test(lines[idx])) {
			// If there is another line, it must be Done when; otherwise invalid
			return { ok: false, reason: 'trailing_garbage' };
		}
		idx += 1;
	}

	// No extra lines after optional Done when
	if (idx !== lines.length) {
		return { ok: false, reason: 'extra_lines' };
	}

	// Soft word-limit check (approx) excluding link URLs
	const wordCount = trimmed.replace(/\(https?:\/\/[^\s)]+\)/g, '').split(/\s+/).filter(Boolean).length;
	if (wordCount > 70) {
		return { ok: false, reason: 'too_long' };
	}

	return { ok: true, sawDoc };
}

/* -------------------------------------------------------------------------- */
/*                                   Route                                    */
/* -------------------------------------------------------------------------- */

export const POST: RequestHandler = async ({ request }) => {
	if (!OPENAI_API_KEY) {
		return json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
	}

	const body = await request.json().catch(() => null);
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
		'Use the following output format rules EXACTLY (Vector Chat Markdown v1):',
		VECTOR_CHAT_MD_SPEC,
		'Project context:',
		formatProjectContext(project),
		'Conversation so far:',
		formatConversation(messages),
		'Respond to the latest user message using the exact format.'
	];

	// If last turn not by user, nudge model to be proactive.
	if (messages[messages.length - 1]?.role !== 'user') {
		promptSections.push(
			'Note: The last message was not from the user. If no user question remains, provide proactive guidance (still using the strict format).'
		);
	}

	const prompt = promptSections.join('\n\n');

	try {
		const response = await client.responses.create({
			model: MODEL_ID,
			instructions: 'Use Vector Chat Markdown v1 exactly. No extra sections. No working code.',
			input: prompt
		});

		const raw = response.output_text?.trim() ?? '';

		// Validate the model output so the UI can rely on the contract.
		const valid = validateVectorChatMarkdown(raw);
		if (!valid.ok) {
			return json(
				{ content: raw, format_ok: false, reason: valid.reason ?? 'invalid' },
				{ status: 200 }
			);
		}

		return json({ content: raw, format_ok: true }, { status: 200 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 502 });
	}
};
