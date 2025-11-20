import { writable } from 'svelte/store';

export type MilestoneEntry = {
	id: string;
	title: string;
	ordinal?: number | null;
	project_id?: string;
} & Record<string, unknown>;

export const milestonesStore = writable<MilestoneEntry[]>([]);
