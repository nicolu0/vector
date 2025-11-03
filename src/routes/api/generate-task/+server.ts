import { error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

type PreviousTask = { title?: string; description?: string; outcome?: string; };

type TaskPayload = {
	endGoal: string;
	previousTask?: PreviousTask;
};

type DailyTask = { title: string; description: string; outcome: string; };

function isDailyTask(value: unknown): value is DailyTask {
	if (!value || typeof value !== 'object') return false;
	const { title, description, outcome } = value as Record<string, unknown>;
	return (
		typeof title === 'string' && title.trim().length > 0 &&
		typeof description === 'string' && description.trim().length > 0 &&
		typeof outcome === 'string' && outcome.trim().length > 0
	);
}

const FALLBACK_TASK: DailyTask = {
	title: 'Rapid Skill Gap Review',
	description:
		'Spend 30 focused minutes identifying one concrete skill gap blocking progress toward the end goal. Review your recent work, jot down missing capabilities, and pick a single micro-skill to practice today. Draft a short action checklist and skim one reputable resource to guide the work.',
	outcome:
		'A prioritized micro-skill target, a checklist of immediate actions, and at least one vetted resource to reference during execution.'
};

const TASK_SCHEMA = {
	type: 'json_schema',
	name: 'daily_task_v1',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['title', 'description', 'outcome'],
		properties: {
			title: { type: 'string', minLength: 4, maxLength: 80 },
			description: { type: 'string', minLength: 40, maxLength: 800 },
			outcome: { type: 'string', minLength: 20, maxLength: 400 }
		}
	},
	strict: true
} as const;

const SYSTEM_INSTRUCTIONS =
	'You are an expert mentor who designs concise 30-minute skill-building tasks that help the user reach their goal.';


function buildPrompt({ endGoal, previousTask }: TaskPayload) {
	const trimmedGoal = endGoal.trim();

	const sections: string[] = [
		`Candidate end goal:\n${trimmedGoal || 'Not provided. Infer a reasonable professional goal.'}`
	];

	sections.push(
		'Current skill level summary:\nNot provided. Assume the candidate has intermediate competency with notable gaps.'
	);

	if (previousTask) {
		const { title, description, outcome } = previousTask;
		const parts = [
			title ? `Title: ${title}` : null,
			description ? `Description: ${description}` : null,
			outcome ? `Outcome: ${outcome}` : null
		].filter(Boolean);
		if (parts.length > 0) sections.push(`Previous task details:\n${parts.join('\n')}`);
	}

	const baseRequirements = [
		'Task requirements:',
		'- Propose exactly one task that fits into 30 focused minutes.',
		'- The task must help the user close a skill gap and move measurably toward the stated end goal.',
		'- Focus on actionable steps that generate an artifact or practice outcome by the end of the session.',
		'- Assume the user works individually with common online tools available.'
	];
	if (previousTask) {
		baseRequirements.push(
			'- Today’s task must be distinct from the previous task, slightly more challenging, and introduce at least one new micro-skill that advances the user toward the end goal.'
		);
	}
	sections.push(baseRequirements.join('\n'));

	sections.push(
		[
			'Output format:',
			'- title: short, motivating, includes the skill being developed.',
			'- description: 3-5 sentences covering the key activities for the 30-minute block.',
			'- outcome: 1-2 sentences summarizing what should exist at the end (artifact, insight, checklist, etc.).',
			'Return JSON only, matching the enforced schema.'
		].join('\n')
	);

	return sections.join('\n\n');
}

function createOpenAI() {
	const apiKey = OPENAI_API_KEY;
	if (!apiKey) return null;
	return new OpenAI({ apiKey });
}

/* -------------------------------
   Incremental JSON extractor
   Emits:
	 {t:'section', k:'title'|'description'|'outcome', phase:'start'|'end'}
	 {t:'kv', k:'title'|'description'|'outcome', v:'…'}
-------------------------------- */
type Key = 'title' | 'description' | 'outcome';

function makeExtractor(targets: Key[]) {
	let buf = '';
	let key: Key | null = null;
	let inString = false;
	let esc = false;
	const values: Record<Key, string> = { title: '', description: '', outcome: '' };

	function findKey(): Key | null {
		const win = buf.slice(-256);
		for (const k of targets) {
			const rx = new RegExp(`"(?:${k})"\\s*:\\s*$`);
			if (rx.test(win)) return k;
		}
		return null;
	}

	function feed(chunk: string, emit: (e: any) => void) {
		for (let i = 0; i < chunk.length; i++) {
			const ch = chunk[i];
			buf += ch;

			if (key === null) {
				const maybe = findKey();
				if (maybe) key = maybe;
				continue;
			}

			if (!inString) {
				if (ch === '"') {
					inString = true; esc = false;
					values[key] = '';
					emit({ t: 'section', k: key, phase: 'start' });
				}
				continue;
			}

			if (esc) {
				values[key] += ch;
				esc = false;
				emit({ t: 'kv', k: key, v: values[key] });
				continue;
			}

			if (ch === '\\') { esc = true; continue; }

			if (ch === '"') {
				inString = false;
				const finished = key;
				key = null;
				emit({ t: 'kv', k: finished, v: values[finished] });
				emit({ t: 'section', k: finished, phase: 'end' });
				continue;
			}

			values[key] += ch;
			emit({ t: 'kv', k: key, v: values[key] });
		}
	}

	return { feed };
}

export const POST: RequestHandler = async ({ request }) => {
	// Parse payload
	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const endGoal = typeof payload.endGoal === 'string' ? payload.endGoal.trim() : '';
	const previousTaskRaw = payload.previousTask;

	let previousTask: PreviousTask | undefined;
	if (previousTaskRaw && typeof previousTaskRaw === 'object') {
		const candidate = previousTaskRaw as Record<string, unknown>;
		const title =
			typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : undefined;
		const description =
			typeof candidate.description === 'string' && candidate.description.trim()
				? candidate.description.trim()
				: undefined;
		const outcome =
			typeof candidate.outcome === 'string' && candidate.outcome.trim()
				? candidate.outcome.trim()
				: undefined;
		if (title || description || outcome) previousTask = { title, description, outcome };
	}

	if (!endGoal) throw error(400, 'Provide an end goal to generate a task');

	const client = createOpenAI();
	const enc = new TextEncoder();

	if (!client) {
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(enc.encode(JSON.stringify({ t: 'error', v: 'OPENAI_API_KEY missing' }) + '\n'));
				controller.enqueue(enc.encode(JSON.stringify({ t: 'final', v: FALLBACK_TASK, source: 'fallback' }) + '\n'));
				controller.enqueue(enc.encode(JSON.stringify({ t: 'done' }) + '\n'));
				controller.close();
			}
		});
		return new Response(body, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache, no-transform',
				'Connection': 'keep-alive',
				'x-vector-task-source': 'fallback'
			}
		});
	}

	const prompt = buildPrompt({ endGoal, previousTask });

	const upstream = await client.responses.create({
		model: 'gpt-5-nano-2025-08-07',
		instructions: SYSTEM_INSTRUCTIONS,
		input: prompt,
		text: { format: TASK_SCHEMA },
		stream: true
	});

	const extractor = makeExtractor(['title', 'description', 'outcome']);

	const body = new ReadableStream({
		async start(controller) {
			controller.enqueue(enc.encode('{}\n')); // open the pipe fast

			let raw = ''; // accumulate the full JSON for final parse/validate
			try {
				for await (const ev of upstream as AsyncIterable<any>) {
					const t = String(ev?.type);

					if (t === 'response.output_text.delta') {
						const d: string = ev.delta ?? '';
						if (d) {
							raw += d;

							// optional: still forward the raw delta
							controller.enqueue(enc.encode(JSON.stringify({ t: 'delta', v: d }) + '\n'));

							// structured per-field streaming
							extractor.feed(d, (msg) => {
								controller.enqueue(enc.encode(JSON.stringify(msg) + '\n'));
							});
						}
						continue;
					}

					if (t === 'response.error' || t === 'error') {
						controller.enqueue(enc.encode(JSON.stringify({ t: 'error', v: ev.error ?? 'unknown' }) + '\n'));
						continue;
					}

					// ignore other event types; we'll finalize after the loop
				}

				// Finalize: parse/validate or fallback
				let finalTask: DailyTask | null = null;
				let source: 'generated' | 'fallback' = 'generated';
				let errMsg: string | null = null;

				try {
					const parsed = JSON.parse(raw) as unknown;
					if (isDailyTask(parsed)) {
						finalTask = parsed as DailyTask;
					} else {
						source = 'fallback';
						errMsg = 'Model response did not match expected schema';
					}
				} catch (e) {
					source = 'fallback';
					errMsg = `Parse error: ${String(e)}`;
				}

				if (!finalTask) finalTask = FALLBACK_TASK;
				if (errMsg) controller.enqueue(enc.encode(JSON.stringify({ t: 'warn', v: errMsg }) + '\n'));

				controller.enqueue(enc.encode(JSON.stringify({ t: 'final', v: finalTask, source }) + '\n'));
				controller.enqueue(enc.encode(JSON.stringify({ t: 'done' }) + '\n'));
				controller.close();
			} catch (e) {
				controller.enqueue(enc.encode(JSON.stringify({ t: 'error', v: String(e) }) + '\n'));
				controller.enqueue(enc.encode(JSON.stringify({ t: 'final', v: FALLBACK_TASK, source: 'fallback' }) + '\n'));
				controller.enqueue(enc.encode(JSON.stringify({ t: 'done' }) + '\n'));
				controller.close();
			}
		}
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'application/x-ndjson',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive'
		}
	});
};
