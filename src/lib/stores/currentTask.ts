import { writable } from 'svelte/store';

export type CurrentTaskOverride = {
	status: 'idle' | 'generating';
};

export const currentTaskOverrideStore = writable<CurrentTaskOverride>({ status: 'idle' });
