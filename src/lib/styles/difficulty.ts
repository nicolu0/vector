import type { Difficulty } from '$lib/types/project';

export function difficultyBadgeClasses(level: Difficulty): string {
	switch (level) {
		case 'Easy':
			return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		case 'Medium':
			return 'border-amber-200 bg-amber-50 text-amber-700';
		case 'Hard':
			return 'border-rose-200 bg-rose-50 text-rose-700';
		case 'Expert':
			return 'border-purple-200 bg-purple-50 text-purple-700';
		default:
			return 'border-stone-200 bg-stone-50 text-stone-700';
	}
}
