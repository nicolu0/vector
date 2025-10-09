<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import projectData from '$lib/mock/project.sample.json';
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import { isProject, type Project } from '$lib/types/project';
	import { getContext } from 'svelte';

	type AuthUI = {
		openAuthModal: () => void;
		closeAuthModal: () => void;
	};

	const { openAuthModal } = getContext<AuthUI>('auth-ui');
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

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	async function saveToDashboard() {
		if (saving) return;
		saveError = null;
		saving = true;

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (!user) {
				saveError = 'Sign in to save projects to your dashboard.';
				saving = false;
				goto('/dashboard');
				return;
			}

			const insertPayload = {
				user_id: user.id,
				title: project.title,
				difficulty: project.difficulty,
				timeline: project.timeline,
				description: project.description,
				jobs: project.jobs,
				skills: project.skills
			};

			const { error } = await supabase.from('projects').insert([insertPayload]);

			if (error) throw error;

			dashboardProjects.invalidate();
			saving = false;
			await goto('/dashboard');
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Unable to save project right now.';
			saving = false;
		}
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
	<div class="mx-auto w-full max-w-4xl space-y-8">
		{#if usingFallback}
			<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
				We couldn't find a freshly generated project for this session, so you're viewing the sample
				preview. Head back to tailor a new one.
			</div>
		{/if}

		<ProjectDetail
			{project}
			showSaveButton={true}
			{saving}
			{saveError}
			on:save={saveToDashboard}
			{openAuthModal}
		/>
	</div>
</div>
