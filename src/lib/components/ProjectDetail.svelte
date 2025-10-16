<script lang="ts">
	import type { Project } from '$lib/types/project';
	import { formatProjectStatus, projectStatusClasses } from '$lib/utils/projectStatus';
	import type { Difficulty } from '$lib/types/project';

	function difficultyBadgeClasses(level: Difficulty): string {
		switch (level) {
			case 'Easy':
				return 'border-emerald-200 bg-emerald-50 text-emerald-600';
			case 'Medium':
				return 'border-amber-200 bg-amber-50 text-amber-600';
			case 'Hard':
				return 'border-rose-200 bg-rose-50 text-rose-600';
			case 'Expert':
				return 'border-purple-200 bg-purple-50 text-purple-600';
			default:
				return 'border-stone-200 bg-stone-50 text-stone-600';
		}
	}

	const {
		project,
		status = 'not_started',
		showSaveButton = false,
		saving = false,
		saveError = null,
		saveProject
	} = $props<{
		project: Project;
		status?: string | null;
		showSaveButton?: boolean;
		saving?: boolean;
		saveError?: string | null;
		saveProject?: () => void;
	}>();

	console.log('project: ', project);

	function timelineClasses(label: string): string {
		const normalized = label.toLowerCase();
		if (normalized.includes('week')) return 'bg-sky-50 text-sky-600 border-sky-200';
		if (normalized.includes('month')) return 'bg-indigo-200 text-indigo-800';
		return 'bg-stone-200 text-stone-800';
	}

	function openLink(url: string) {
		if (!url) return;
		if (typeof window !== 'undefined') {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}
</script>

<div class="space-y-6 pr-5">
	<div class="flex flex-col items-start gap-1">
		<div class="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-stone-900">
			{project.title}
		</div>

		<div class="flex min-w-[280px] shrink-0 items-start justify-start gap-2">
			<div
				class={'inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium ' +
					difficultyBadgeClasses(project.difficulty)}
			>
				{project.difficulty}
			</div>
			<div
				class={'inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium ' +
					timelineClasses(project.timeline)}
			>
				{project.timeline}
			</div>
			<div
				class={'inline-flex items-center rounded-lg border px-3 py-1 text-xs font-medium ' +
					projectStatusClasses(status)}
			>
				{formatProjectStatus(status)}
			</div>
			<div
				class="inline-flex items-center rounded-full bg-stone-800 px-3 py-1 text-xs font-medium text-stone-50"
			>
				<svg
					class="mr-2 h-4 w-4 shrink-0"
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="currentColor"
					><path
						d="M12 2C6.477 2 2 6.588 2 12.253c0 4.525 2.865 8.363 6.839 9.72.5.095.683-.22.683-.49 0-.242-.009-.882-.014-1.732-2.782.615-3.369-1.35-3.369-1.35-.455-1.176-1.11-1.49-1.11-1.49-.907-.633.069-.62.069-.62 1.003.072 1.53 1.05 1.53 1.05.892 1.559 2.341 1.109 2.91.848.091-.66.35-1.109.636-1.364-2.221-.257-4.555-1.136-4.555-5.055 0-1.117.388-2.03 1.026-2.747-.103-.258-.445-1.296.098-2.7 0 0 .84-.27 2.75 1.048A9.37 9.37 0 0 1 12 6.84c.852.004 1.709.116 2.511.34 1.909-1.318 2.748-1.048 2.748-1.048.544 1.404.202 2.442.1 2.7.64.717 1.025 1.63 1.025 2.747 0 3.93-2.338 4.795-4.566 5.047.36.317.68.942.68 1.898 0 1.37-.013 2.474-.013 2.812 0 .272.18.589.69.489A10.03 10.03 0 0 0 22 12.253C22 6.588 17.523 2 12 2z"
					/></svg
				>
				<span>Link GitHub</span>
			</div>
		</div>
	</div>

	<div class="rounded-lg border border-stone-200 bg-white p-5">
		<div class="mb-2 text-xs font-semibold tracking-tight text-stone-900">Project brief</div>
		<div class="text-xs leading-7 text-stone-700">
			{project.description}
		</div>
	</div>

	<div class="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
		<div class="flex items-center justify-between">
			<div class="text-xs font-semibold tracking-tight text-stone-900">Jobs this maps to</div>
			<div class="text-xs text-stone-500">
				{project.jobs.length} source{project.jobs.length === 1 ? '' : 's'}
			</div>
		</div>

		{#if project.jobs.length === 0}
			<div class="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
				No job links provided. Generate again with listings to make this laser-targeted.
			</div>
		{:else}
			<div class="divide-y divide-stone-200">
				{#each project.jobs as job}
					<div
						class="flex items-center justify-between bg-white py-3 first:rounded-t-xl last:rounded-b-xl"
					>
						<div class="min-w-0">
							<div class="truncate text-xs text-stone-700">
								{job.title}
							</div>
							<div class="truncate text-xs text-stone-400">{job.url}</div>
						</div>
						{#if job.url}
							<button
								class="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-700 transition hover:bg-stone-50"
								onclick={() => openLink(job.url)}
							>
								Open
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="rounded-lg border border-stone-200 bg-white p-5">
		<div class="mb-3 text-xs font-semibold tracking-tight text-stone-900">
			Skills you’ll use/learn
		</div>

		{#if project.skills.length === 0}
			<div class="text-sm text-stone-600">
				No skills attached. Add a skills list when generating.
			</div>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				{#each project.skills as skill}
					<div
						class="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700"
					>
						{skill}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showSaveButton}
		<div class="flex flex-col items-end gap-2">
			<button
				type="button"
				disabled={saving}
				class="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
				onclick={() => saveProject(project)}
			>
				{saving ? 'Saving…' : 'Save to dashboard'}
			</button>
			{#if saveError}
				<p class="text-xs text-rose-600">{saveError}</p>
			{/if}
		</div>
	{/if}
</div>
