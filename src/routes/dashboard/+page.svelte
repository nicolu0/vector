<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { Project } from '$lib/types/project';
	import { difficultyBadgeClasses } from '$lib/styles/difficulty';
	import { fly } from 'svelte/transition';
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';

	type StoredProject = Project & {
		id: string;
		created_at: string | null;
	};

	let loading = $state(true);
	let projects = $state<StoredProject[]>([]);
	let loadError = $state<string | null>(null);
	let sessionExists = $state(false);
	let selectedProject = $state<StoredProject | null>(null);

	async function loadProjects() {
		loading = true;
		loadError = null;

		try {
			const {
				data: { session },
				error: sessionError
			} = await supabase.auth.getSession();

			if (sessionError) throw sessionError;

			if (!session) {
				sessionExists = false;
				projects = [];
				loading = false;
				return;
			}

			sessionExists = true;

			const { data, error } = await supabase
				.from('projects')
				.select('id, title, difficulty, timeline, description, jobs, skills, created_at')
				.eq('user_id', session.user.id)
				.order('created_at', { ascending: false });

			if (error) throw error;

			projects = (data ?? []) as StoredProject[];
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Unable to load projects right now.';
		} finally {
			loading = false;
		}
	}

	function formatCreatedAt(value: string | null): string {
		if (!value) return '';
		try {
			const date = new Date(value);
			return new Intl.DateTimeFormat('en', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			}).format(date);
		} catch {
			return '';
		}
	}

	async function signIn() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo:
					typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined
			}
		});
	}

	function viewProject(project: StoredProject) {
		selectedProject = project;
	}

	onMount(() => {
		loadProjects();
	});
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<div class="min-h-dvh w-full bg-stone-50 px-6 py-4 text-stone-800">
	<div class="mx-auto w-full max-w-5xl">
		{#if selectedProject}
			<button
				type="button"
				class="inline-flex items-center gap-2 text-sm text-stone-600 transition hover:text-stone-900"
				onclick={() => (selectedProject = null)}
				aria-label="Back to dashboard"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Back
			</button>

			<div class="mt-6 space-y-4">
				{#if selectedProject.created_at}
					<p class="text-xs text-stone-500">
						Saved {formatCreatedAt(selectedProject.created_at)}
					</p>
				{/if}
				<ProjectDetail project={selectedProject} />
			</div>
		{:else}
			<div class="flex items-center justify-between gap-3">
				<div>
					<h1 class="text-3xl font-semibold tracking-tight text-stone-800">Dashboard</h1>
				</div>
			</div>

			{#if loading}
				<div class="mt-10"></div>
			{:else if !sessionExists}
				<div class="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
					<p class="text-stone-700">
						Sign in to save your generated projects and receive guidance.
					</p>
					<button
						class="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
						onclick={signIn}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="#4285F4"
								d="M23.25 12.273c0-.815-.066-1.411-.21-2.028H12.24v3.674h6.318c-.128 1.02-.82 2.556-2.357 3.588l-.021.138 3.422 2.652.237.024c2.178-1.924 3.411-4.756 3.411-8.248"
							/>
							<path
								fill="#34A853"
								d="M12.24 24c3.096 0 5.695-1.025 7.593-2.785l-3.62-2.803c-.968.673-2.266 1.144-3.973 1.144-3.036 0-5.613-2.025-6.53-4.82l-.135.011-3.542 2.732-.046.128C2.97 21.83 7.245 24 12.24 24"
							/>
							<path
								fill="#FBBC05"
								d="M5.71 14.736a7.32 7.32 0 0 1-.377-2.293c0-.799.138-1.57.363-2.293l-.006-.153-3.583-2.78-.117.053A11.735 11.735 0 0 0 0 12.443c0 1.924.463 3.741 1.27 5.27z"
							/>
							<path
								fill="#EA4335"
								d="M12.24 4.754c2.154 0 3.605.93 4.434 1.707l3.237-3.16C17.92 1.24 15.336 0 12.24 0 7.245 0 2.97 2.17 1.27 7.173l3.426 2.707c.918-2.796 3.495-5.126 7.544-5.126"
							/>
						</svg>
						Sign in with Google
					</button>
				</div>
			{:else if projects.length === 0}
				<div class="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
					No saved projects yet. Generate one and hit “Save to dashboard”.
				</div>
			{:else}
				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					{#each projects as project, index}
						<div
							in:fly|global={{ y: 10, duration: 500, easing: cubicOut, delay: index * 100 }}
							class="flex min-h-[120px] cursor-pointer flex-col items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-stone-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:outline-none"
							onclick={() => viewProject(project)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									viewProject(project);
								}
							}}
						>
							<div class="flex w-full items-center justify-between">
								<h2
									class="w-full truncate text-lg font-medium tracking-tight text-stone-800"
									title={project.title}
								>
									{project.title}
								</h2>
								<div class="flex flex-row gap-2 self-end pr-5">
									<span
										class={`rounded-md border px-2 py-1 text-[10px] ${difficultyBadgeClasses(project.difficulty)}`}
									>
										{project.difficulty}
									</span>
									<span
										class={`shrink-0 rounded-md border border-stone-400 bg-stone-100 px-2 py-1 text-[10px] text-stone-500`}
									>
										Not Started
									</span>
								</div>
							</div>

							<div class="flex flex-wrap gap-2">
								{#each project.skills.slice(0, 2) as skill}
									<span
										class="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-700"
									>
										{skill}
									</span>
								{/each}
								{#if project.skills.length > 2}
									<span
										class="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-600"
									>
										+{project.skills.length - 2} more
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
