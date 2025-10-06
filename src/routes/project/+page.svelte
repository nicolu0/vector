<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import projectData from '$lib/mock/project.sample.json';
	import { isProject, type Project, type Difficulty } from '$lib/types/project';

	const fallbackProject = projectData as Project;
	const navigationState = import.meta.env.SSR
		? undefined
		: (get(page).state as { project?: unknown; fallback?: boolean } | undefined);
	const generatedCandidate = navigationState?.project;
	const hasGeneratedProject = isProject(generatedCandidate);
	const project = $state<Project>(
		hasGeneratedProject ? (generatedCandidate as Project) : fallbackProject
	);
	const usingFallback = $state(navigationState?.fallback === true || !hasGeneratedProject);

	let copied = $state(false);
	async function copyBrief() {
		try {
			await navigator.clipboard.writeText(`${project.title}\n\n${project.description}`);
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {}
	}

	function openLink(u: string) {
		if (u) window.open(u, '_blank', 'noopener,noreferrer');
	}

	function difficultyClasses(level: Difficulty): string {
		switch (level) {
			case 'Easy':
				return 'bg-emerald-300 text-emerald-800';
			case 'Medium':
				return 'bg-amber-200 text-amber-800';
			case 'Hard':
				return 'bg-rose-200 text-rose-700';
			case 'Expert':
				return 'bg-purple-200 text-purple-800';
			default:
				return 'bg-stone-700 text-white border-stone-800';
		}
	}

	function timelineClasses(label: string): string {
		const normalized = label.toLowerCase();
		if (normalized.includes('week')) return 'bg-sky-200 text-sky-800';
		if (normalized.includes('month')) return 'bg-indigo-200 text-indigo-800';
		return 'bg-stone-200 text-stone-800';
	}
</script>

<!-- page -->
<div class="min-h-dvh w-full bg-stone-50 px-4 pb-8 text-stone-800">
	<button
		type="button"
		class=" inline-flex items-center gap-2 p-4 text-sm text-stone-600 transition hover:text-stone-900"
		aria-label="Back"
		onclick={() => goto('/')}
	>
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Back
	</button>
	<div class="mx-auto w-full max-w-4xl">
		{#if usingFallback}
			<div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
				We couldn't find a freshly generated project for this session, so you're viewing the sample
				preview. Head back to tailor a new one.
			</div>
		{/if}
		<!-- title row -->
		<div class="flex flex-col gap-5 md:flex-row md:items-center">
			<div class="text-2xl font-semibold tracking-tight text-stone-900 sm:text-2xl lg:text-4xl">
				{project.title}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<div
					class={'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ' +
						difficultyClasses(project.difficulty)}
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

		<!-- brief card -->
		<div
			class="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
		>
			<div class="mb-2 text-sm font-semibold tracking-tight text-stone-900">Project brief</div>
			<div class="text-[15px] leading-7 text-stone-700">
				{project.description}
			</div>
		</div>

		<!-- jobs card -->
		<div
			class="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-5"
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
					{#each project.jobs as j, i}
						<div
							class="flex items-center justify-between bg-white px-2 py-3 first:rounded-t-xl last:rounded-b-xl"
						>
							<div class="min-w-0">
								<div class="truncate text-[15px] font-medium text-stone-800">
									{j.title}
								</div>
								<div class="truncate text-xs text-stone-500">
									{j.url}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- skills card -->
		<div
			class="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
		>
			<div class="mb-3 text-sm font-semibold tracking-tight text-stone-900">
				Skills you’ll use/learn
			</div>

			{#if project.skills.length === 0}
				<div class="text-sm text-stone-600">
					No skills attached. Add a skills list when generating.
				</div>
			{:else}
				<div class="flex flex-wrap items-center gap-2">
					{#each project.skills as s}
						<div
							class="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700"
						>
							{s}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- actions -->
		<div class="mt-8 flex flex-wrap justify-end gap-3">
			<button
				class="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-900 active:scale-[0.98]"
				onclick={() => {
					/* hook: save to dashboard */
				}}
			>
				Save to dashboard
			</button>
		</div>
	</div>
</div>
