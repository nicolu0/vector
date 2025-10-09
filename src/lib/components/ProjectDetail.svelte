<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Project } from '$lib/types/project';
	import { difficultyBadgeClasses } from '$lib/styles/difficulty';

	const {
		project,
		showSaveButton = false,
		saving = false,
		saveError = null,
		openAuthModal
	} = $props<{
		project: Project;
		showSaveButton?: boolean;
		saving?: boolean;
		saveError?: string | null;
		openAuthModal: () => void;
	}>();

	const dispatch = createEventDispatcher<{ save: void; copy: void }>();

	function timelineClasses(label: string): string {
		const normalized = label.toLowerCase();
		if (normalized.includes('week')) return 'bg-sky-200 text-sky-800';
		if (normalized.includes('month')) return 'bg-indigo-200 text-indigo-800';
		return 'bg-stone-200 text-stone-800';
	}

	function saveProject(project: Project) {
		sessionStorage.setItem('vector:cached-project', JSON.stringify(project));
		openAuthModal();
	}

	function openLink(url: string) {
		if (!url) return;
		if (typeof window !== 'undefined') {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-5 md:flex-row md:items-center">
		<div class="text-2xl font-semibold tracking-tight text-stone-900 sm:text-2xl lg:text-4xl">
			{project.title}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div
				class={'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ' +
					difficultyBadgeClasses(project.difficulty)}
			>
				{project.difficulty}
			</div>
			<div
				class={'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ' +
					timelineClasses(project.timeline)}
			>
				{project.timeline}
			</div>
		</div>
	</div>

	<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
		<div class="mb-2 text-sm font-semibold tracking-tight text-stone-900">Project brief</div>
		<div class="text-[15px] leading-7 text-stone-700">
			{project.description}
		</div>
	</div>

	<div
		class="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-5"
	>
		<div class="mb-3 flex items-center justify-between">
			<div class="text-sm font-semibold tracking-tight text-stone-900">Jobs this maps to</div>
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
						class="flex items-center justify-between bg-white px-2 py-3 first:rounded-t-xl last:rounded-b-xl"
					>
						<div class="min-w-0">
							<div class="truncate text-[15px] font-medium text-stone-800">
								{job.title}
							</div>
							<div class="truncate text-xs text-stone-500">{job.url}</div>
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

	<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
		<div class="mb-3 text-sm font-semibold tracking-tight text-stone-900">
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
						class="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
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
