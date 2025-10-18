import { get, writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { normalizeProjectStatusValue } from '$lib/utils/projectStatus';

export type StoredProject = Project & {
	id: string;
	created_at: string | null;
	status: string | null;
};


export type Deliverable = {
	task: string;
	spec: string;
	implementation: string[];
	code: string;
};

export type LearningMaterial = {
	title: string;
	body: string;
};

export type Section = {
	name: string;
	overview: string;
	deliverables: Deliverable[];
	learning_materials: LearningMaterial[];
};

export type Metadata = Section[];

export type Project = {
	id?: string;
	title: string;
	difficulty: string | null;
	timeline: string | null;
	description: string | null;
	jobs: { title: string; url: string }[];
	skills: string[];
	metadata: Metadata;
	status?: string | null;
	created_at?: string | null;
};


export type DashboardProjectsState = {
	status: 'idle' | 'loading' | 'refreshing' | 'loaded' | 'error';
	sessionExists: boolean;
	projects: StoredProject[];
	error: string | null;
	lastLoadedAt: number | null;
	userId: string | null;
};

const CACHE_TTL = 5 * 60 * 1000;

const initialState: DashboardProjectsState = {
	status: 'idle',
	sessionExists: false,
	projects: [],
	error: null,
	lastLoadedAt: null,
	userId: null
};

const store = writable<DashboardProjectsState>({ ...initialState });

let inFlight: Promise<StoredProject[] | null> | null = null;

function isCacheFresh(state: DashboardProjectsState) {
	if (!state.lastLoadedAt) return false;
	return Date.now() - state.lastLoadedAt < CACHE_TTL;
}

function ensureStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function sanitizeJobs(value: unknown): Project['jobs'] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const { title, url } = item as Record<string, unknown>;
			if (typeof title !== 'string' || typeof url !== 'string') return null;
			return { title, url };
		})
		.filter(Boolean) as Project['jobs'];
}

/**
 * Sanitize and validate metadata according to the new schema structure.
 * Metadata should be an array of sections with deliverables and learning_materials.
 */
function sanitizeMetadata(value: unknown): Project['metadata'] {
	if (!Array.isArray(value)) return [];

	return value.map((section: unknown) => {
		if (!section || typeof section !== 'object') {
			return {
				name: 'Unknown Section',
				overview: 'No overview available',
				deliverables: [],
				learning_materials: []
			};
		}

		const s = section as Record<string, unknown>;

		return {
			name: typeof s.name === 'string' ? s.name : 'Unknown Section',
			overview: typeof s.overview === 'string' ? s.overview : 'No overview available',
			deliverables: Array.isArray(s.deliverables) ? s.deliverables.map((d: unknown) => {
				if (!d || typeof d !== 'object') {
					return {
						task: 'Unknown Task',
						spec: 'No specification',
						implementation: [],
						code: ''
					};
				}
				const deliverable = d as Record<string, unknown>;
				return {
					task: typeof deliverable.task === 'string' ? deliverable.task : 'Unknown Task',
					spec: typeof deliverable.spec === 'string' ? deliverable.spec : 'No specification',
					implementation: Array.isArray(deliverable.implementation) ? deliverable.implementation.filter((item: unknown) => typeof item === 'string') : [],
					code: typeof deliverable.code === 'string' ? deliverable.code : ''
				};
			}) : [],
			learning_materials: Array.isArray(s.learning_materials) ? s.learning_materials.map((m: unknown) => {
				if (!m || typeof m !== 'object') {
					return {
						title: 'Unknown Material',
						body: 'No content available'
					};
				}
				const material = m as Record<string, unknown>;
				return {
					title: typeof material.title === 'string' ? material.title : 'Unknown Material',
					body: typeof material.body === 'string' ? material.body : 'No content available'
				};
			}) : []
		};
	});
}

async function load(options?: { force?: boolean }) {
	const force = options?.force ?? false;
	const currentState = get(store);

	if (!force && currentState.status === 'loaded' && isCacheFresh(currentState)) {
		return currentState.sessionExists ? currentState.projects : [];
	}

	if (inFlight) {
		if (!force) {
			return inFlight;
		}
		inFlight = null;
	}

	store.update((value) => {
		const hasProjects = value.projects.length > 0;
		return {
			...value,
			status: hasProjects ? 'refreshing' : 'loading',
			error: null
		};
	});

	const promise = (async () => {
		try {
			const {
				data: { session },
				error: sessionError
			} = await supabase.auth.getSession();

			if (sessionError) throw sessionError;

			if (!session) {
				store.set({
					status: 'loaded',
					sessionExists: false,
					projects: [],
					error: null,
					lastLoadedAt: Date.now(),
					userId: null
				});
				return [];
			}

			const { data, error } = await supabase
				.from('projects')
				.select(
					'id, title, difficulty, timeline, description, jobs, skills, metadata, status, created_at'
				)
				.eq('user_id', session.user.id)
				.order('created_at', { ascending: false });

			if (error) throw error;

			const projects = (data ?? []).map((project) => {
				const typed = project as Partial<StoredProject>;

				return {
					...typed,
					jobs: sanitizeJobs(typed.jobs),
					skills: ensureStringArray(typed.skills),
					metadata: sanitizeMetadata(typed.metadata),
					status: normalizeProjectStatusValue(typed.status ?? null)
				};
			}) as StoredProject[];

			store.set({
				status: 'loaded',
				sessionExists: true,
				projects,
				error: null,
				lastLoadedAt: Date.now(),
				userId: session.user.id
			});

			return projects;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unable to load projects right now.';

			store.update((value) => {
				const hasProjects = value.projects.length > 0;
				return {
					...value,
					status: hasProjects ? 'loaded' : 'error',
					error: message
				};
			});

			return null;
		} finally {
			inFlight = null;
		}
	})();

	inFlight = promise;
	const result = await promise;
	return result;
}

function refresh() {
	return load({ force: true });
}

function invalidate() {
	store.update((value) => ({
		...value,
		status: 'idle',
		lastLoadedAt: null
	}));
}

function clear() {
	store.set({ ...initialState });
}

export const dashboardProjects = {
	subscribe: store.subscribe,
	load,
	refresh,
	invalidate,
	clear,
	getSnapshot: () => get(store),
	setProjectStatus(projectId: string, status: string) {
		const normalized = normalizeProjectStatusValue(status);
		store.update((value) => ({
			...value,
			projects: value.projects.map((project) =>
				project.id === projectId ? { ...project, status: normalized } : project
			)
		}));
	}
};

if (typeof window !== 'undefined') {
	const {
		data: { subscription }
	} = supabase.auth.onAuthStateChange((event, session) => {
		if (event === 'SIGNED_OUT') {
			clear();
			store.update((value) => ({
				...value,
				status: 'loaded',
				sessionExists: false,
				lastLoadedAt: Date.now()
			}));
			return;
		}

		if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
			store.update((value) => ({
				...value,
				sessionExists: Boolean(session),
				userId: session?.user.id ?? null,
				status: 'idle'
			}));
			void refresh();
		}
	});

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			subscription.unsubscribe();
		});
	}
}
