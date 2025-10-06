<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { Project } from '$lib/types/project';

	type StoredProject = Project & {
		id: string;
		created_at: string | null;
	};

	let loading = $state(true);
	let projects = $state<StoredProject[]>([]);
	let loadError = $state<string | null>(null);
	let sessionExists = $state(false);

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
		goto('/project', {
			state: {
				project,
				fallback: false
			}
		});
	}

	onMount(() => {
		loadProjects();
	});
</script>

<svelte:head>
	<title>Dashboard • Vector</title>
</svelte:head>

<div class="min-h-dvh w-full bg-stone-50 px-6 py-12 text-stone-800">
	<div class="mx-auto w-full max-w-4xl">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight text-stone-900">Your dashboard</h1>
				<p class="mt-3 text-sm text-stone-500">
					Saved projects live here so you can refine and share them anytime.
				</p>
			</div>
		</div>

		{#if loading}
			<div class="mt-10 space-y-4">
				{#each Array.from({ length: 3 }) as _, i}
					<div
						class="h-[120px] animate-pulse rounded-2xl border border-stone-200 bg-white/70"
						aria-hidden="true"
					/>
				{/each}
			</div>
		{:else if loadError}
			<div class="mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
				{loadError}
			</div>
		{:else if !sessionExists}
			<div class="mt-10 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
				<p class="text-stone-700">Sign in to save and revisit your generated projects.</p>
				<button
					class="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
					on:click={signIn}
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
			<div class="mt-10 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
				No saved projects yet. Generate one and hit “Save to dashboard”.
			</div>
		{:else}
			<div class="mt-10 grid gap-4 sm:grid-cols-2">
				{#each projects as project}
					<article
						class="flex min-h-[160px] flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
					>
						<div class="flex items-start justify-between gap-2">
							<text class="w-full truncate text-sm font-semibold tracking-tight text-stone-900">
								{project.title}
							</text>
							<span
								class="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700"
							>
								{project.difficulty}
							</span>
						</div>

						<div class="flex flex-wrap gap-2">
							{#each project.skills.slice(0, 3) as skill}
								<span
									class="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-700"
								>
									{skill}
								</span>
							{/each}
							{#if project.skills.length > 3}
								<span
									class="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-600"
								>
									+{project.skills.length - 3} more
								</span>
							{/if}
						</div>

						<div class="mt-auto flex items-center justify-between text-[11px] text-stone-500">
							{#if project.created_at}
								<span>Saved {formatCreatedAt(project.created_at)}</span>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</div>
