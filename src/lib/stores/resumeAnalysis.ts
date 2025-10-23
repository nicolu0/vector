import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { ProjectItem, ProjectRating, ResumeProjects } from '$lib/types/resume';

type AnalysisStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ResumeAnalysisState = {
	status: AnalysisStatus;
	data: ResumeProjects | null;
	error: string | null;
	lastText: string | null;
	updatedAt: number | null;
};

type StoredAnalysisPayload = {
	text: string;
	data: ResumeProjects;
	updatedAt: number;
};

const initialState: ResumeAnalysisState = {
	status: 'idle',
	data: null,
	error: null,
	lastText: null,
	updatedAt: null
};

const analysisStoreInternal = writable<ResumeAnalysisState>({ ...initialState });

let requestToken = 0;

export const resumeAnalysisStore = {
	subscribe: analysisStoreInternal.subscribe
};

export function resetResumeAnalysis() {
	requestToken += 1;
	analysisStoreInternal.set({ ...initialState });
}

const STORAGE_PREFIX = 'vector:resume-analysis:';

function sanitizeCacheKey(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function storageKey(key: string) {
	return `${STORAGE_PREFIX}${key}`;
}

function loadFromStorage(key: string): StoredAnalysisPayload | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(storageKey(key));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredAnalysisPayload> | null;
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			typeof parsed.text !== 'string' ||
			typeof parsed.updatedAt !== 'number' ||
			!parsed.data
		) {
			return null;
		}
		return {
			text: parsed.text,
			data: normalizeResponse(parsed.data),
			updatedAt: parsed.updatedAt
		};
	} catch {
		return null;
	}
}

function saveToStorage(key: string, payload: StoredAnalysisPayload) {
	if (!browser) return;
	try {
		localStorage.setItem(storageKey(key), JSON.stringify(payload));
	} catch {
		// Ignore storage failures (quota, private mode, etc.)
	}
}

const allowedStrengths: ResumeProjects['overall_strength'][] = ['Strong', 'Average', 'Needs Work'];
const allowedRatings: ProjectRating[] = ['No change', 'Small tweaks', 'Needs Improvement'];

function sanitizeProjects(value: unknown): ProjectItem[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item) => {
			if (!item || typeof item !== 'object') {
				return null;
			}

			const record = item as Record<string, unknown>;

			const title =
				typeof record.title === 'string' && record.title.trim().length > 0
					? record.title.trim()
					: 'Untitled Project';

			const stack =
				record.stack === null || typeof record.stack === 'string'
					? record.stack ?? null
					: null;

			const bullets =
				Array.isArray(record.bullets) && record.bullets.length > 0
					? record.bullets
							.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
							.map((entry) => entry.trim())
					: [];

			const ratingLabelRaw =
				typeof record.rating === 'object' && record.rating !== null
					? (record.rating as Record<string, unknown>).label
					: null;

			const ratingLabel = allowedRatings.includes(ratingLabelRaw as ProjectRating)
				? (ratingLabelRaw as ProjectRating)
				: 'Needs Improvement';

			const notes =
				Array.isArray(record.notes) && record.notes.length > 0
					? record.notes
							.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
							.map((entry) => entry.trim())
					: [];

			return {
				title,
				stack,
				bullets,
				rating: { label: ratingLabel },
				notes
			};
		})
		.filter(Boolean) as ProjectItem[];
}

function normalizeResponse(payload: unknown): ResumeProjects {
	let overall_strength: ResumeProjects['overall_strength'] = 'Average';
	let projects: ProjectItem[] = [];

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>;

		const strengthCandidate = record.overall_strength;
		if (allowedStrengths.includes(strengthCandidate as ResumeProjects['overall_strength'])) {
			overall_strength = strengthCandidate as ResumeProjects['overall_strength'];
		}

		projects = sanitizeProjects(record.projects);
	}

	return {
		overall_strength,
		projects
	};
}

export async function analyzeResume(
	text: string,
	options?: { force?: boolean; cacheKey?: string | null }
): Promise<ResumeProjects | null> {
	const trimmed = text?.trim?.() ?? '';
	const force = options?.force ?? false;
	const cacheKey = sanitizeCacheKey(options?.cacheKey);

	if (!trimmed) {
		resetResumeAnalysis();
		return null;
	}

	const currentState = get(analysisStoreInternal);
	if (!force && currentState.lastText === trimmed) {
		if (currentState.status === 'loaded') {
			return currentState.data;
		}
		if (currentState.status === 'loading') {
			return null;
		}
	}

	const token = ++requestToken;

	analysisStoreInternal.update((state) => ({
		...state,
		status: 'loading',
		error: null,
		lastText: trimmed
	}));

	if (!force && cacheKey) {
		const cached = loadFromStorage(cacheKey);
		if (cached && cached.text === trimmed) {
			if (token === requestToken) {
				analysisStoreInternal.set({
					status: 'loaded',
					data: cached.data,
					error: null,
					lastText: trimmed,
					updatedAt: cached.updatedAt
				});
			}
			return cached.data;
		}
	}

	try {
		const response = await fetch('/api/format-resume', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: trimmed })
		});

		if (!response.ok) {
			throw new Error(`Failed to format resume (status ${response.status})`);
		}

		const payload = await response.json();
		const data = normalizeResponse(payload);

		if (token !== requestToken) {
			return data;
		}

		if (cacheKey) {
			saveToStorage(cacheKey, {
				text: trimmed,
				data,
				updatedAt: Date.now()
			});
		}

		analysisStoreInternal.set({
			status: 'loaded',
			data,
			error: null,
			lastText: trimmed,
			updatedAt: Date.now()
		});

		return data;
	} catch (error) {
		if (token === requestToken) {
			const message =
				error instanceof Error ? error.message : 'Unexpected error while formatting resume';

			analysisStoreInternal.update((state) => ({
				...state,
				status: 'error',
				error: message,
				updatedAt: Date.now()
			}));
		}

		return null;
	}
}
