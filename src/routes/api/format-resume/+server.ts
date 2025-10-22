import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { resumeProjectsJsonSchema } from '$lib/types/resume';

function createOpenAI() {
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
}

export const POST: RequestHandler = async ({ request }) => {
    const { text } = await request.json() as { text: string };

    if (!text || !text.trim()) {
        return json({ error: 'No text provided' }, { status: 400 });
    }

    const system = `
You are a resume parser and reviewer.
Goal: extract *projects only* from raw resume text, normalize them, and rate each project for resume quality.
- Prefer project-like, real-world experience over coursework, unless clearly a project.
- Keep bullets action-oriented, quantified, and concise. Bullet points should come from resume text.
- "stack" is a short comma-delimited list (null if unknown).
- "rating.label" rubric:
    - "No change" - excellent bullets, metrics, context clear
    - "Small tweaks" - decent, needs a metric or minor clarity
    - "Needs Improvement" - vague, missing impact or context
- "notes" should be concrete edits (e.g., add metrics, baseline, latency).
- If no projects exist, return an empty array and set overall_strength to "Needs Work".
`;

    const user = `
RAW RESUME TEXT:
${text}

Output MUST be valid JSON matching the provided JSON schema exactly.
Only include projects (ignore skills, awards, non-project experience or internships).
Try to produce 2-4 projects per resume, or however many are on the resume.
`;
    const prompt = `${system}\n\n${user}`;

    const client = createOpenAI();
    if (!client) return json({ error: 'Failed to create OpenAI client' }, { status: 500 });

    try {
        const response = await client.responses.create({
            model: 'gpt-5-nano-2025-08-07',
            instructions: 'You are a resume parser and reviewer. Follow the instructions carefully and output valid JSON matching the provided JSON schema exactly.',
            input: prompt,
            text: { format: resumeProjectsJsonSchema }
        });

        const output = (response as any).output_text as string | undefined;
        if (!output) return json({ overall_strength: 'Needs Work', projects: [] });

        const data = JSON.parse(output);
        console.log(data);
        return json(data);
    } catch (e: any) {
        console.error(e);
        return json({ error: e?.message ?? 'OpenAI call failed' }, { status: 500 });
    }
};