import { writable } from 'svelte/store';

export type ResumeData = {
	file: File | null;
	url: string | null;      // URL.createObjectURL(file)
	text: string;
	filename: string | null;
};

const initial: ResumeData = {
	file: null,
	url: null,
	text: '',
	filename: null
};

export const resumeStore = writable<ResumeData>(initial);

export function setResume(file: File, text: string) {
	const url = URL.createObjectURL(file);
	resumeStore.set({ file, url, text, filename: file.name });
}

export function clearResume() {
	resumeStore.update((s) => {
		if (s.url) URL.revokeObjectURL(s.url);
		return { ...initial };
	});
}
