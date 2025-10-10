type NormalizedStatus = 'not_started' | 'in_progress' | 'completed' | 'unknown';

function normalizeProjectStatus(value: string | null | undefined): NormalizedStatus {
	if (!value) return 'unknown';
	const normalized = value.toString().trim().toLowerCase().replace(/\s+/g, '_');
	switch (normalized) {
		case 'not_started':
			return 'not_started';
		case 'in_progress':
			return 'in_progress';
		case 'completed':
			return 'completed';
		default:
			return 'unknown';
	}
}

export function formatProjectStatus(value: string | null | undefined): string {
	switch (normalizeProjectStatus(value)) {
		case 'in_progress':
			return 'In Progress';
		case 'completed':
			return 'Completed';
		case 'not_started':
		case 'unknown':
		default:
			return 'Not Started';
	}
}

export function projectStatusClasses(value: string | null | undefined): string {
	switch (normalizeProjectStatus(value)) {
		case 'in_progress':
			return 'border-sky-300 bg-sky-100 text-sky-700';
		case 'completed':
			return 'border-emerald-300 bg-emerald-100 text-emerald-700';
		case 'not_started':
		case 'unknown':
		default:
			return 'border-stone-400 bg-stone-100 text-stone-500';
	}
}

export function normalizeProjectStatusValue(value: string | null | undefined): string {
	const normalized = normalizeProjectStatus(value);
	switch (normalized) {
		case 'in_progress':
			return 'in_progress';
		case 'completed':
			return 'completed';
		case 'not_started':
		case 'unknown':
		default:
			return 'not_started';
	}
}
