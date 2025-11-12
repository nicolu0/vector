import type { Writable } from 'svelte/store';

export type ViewSelection =
	| { type: 'project' }
	| { type: 'milestone'; id: string }
	| { type: 'task'; id: string }

export type ViewerContext = {
	selection: Writable<ViewSelection>;
	selectProject: () => void;
	selectMilestone: (id: string) => void;
	selectTask: (id: string) => void;
};

export const VIEWER_CONTEXT_KEY = Symbol('viewer-selection');
