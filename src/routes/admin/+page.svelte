<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Auth
	async function adminSignIn() {
		try {
			const redirectTo = `${window.location.origin}/admin`;
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo, queryParams: { prompt: 'select_account' } }
			});
			if (error) throw error;
		} catch (err) {
			console.error(err);
		}
	}

	// Data
	let users = $state(data.users as Record<string, { name: string | null; projects: any[] }>);
	const userEntries = $derived(Object.entries(users));

	// Copy helper
	let copiedUserId: string | null = $state(null);
	async function copyUserId(userId: string) {
		try {
			await navigator.clipboard.writeText(userId);
			copiedUserId = userId;
			setTimeout(() => (copiedUserId = null), 1200);
		} catch (e) {
			console.error('Failed to copy user id', e);
		}
	}

	// Selection (full-screen toggle)
	type Selected = { userId: string; userName: string | null; project: any } | null;
	let selectedProject: Selected = $state(null);

	function selectProject(userId: string, userName: string | null, project: any) {
		selectedProject = { userId, userName, project };
	}
	function backToBoard() {
		selectedProject = null;
	}

	// Small helper
	function countTasks(p: any) {
		return (p.milestones ?? []).reduce((acc: number, m: any) => acc + (m.tasks?.length ?? 0), 0);
	}
	function countTodos(p: any) {
		return (p.milestones ?? []).reduce(
			(acc: number, m: any) =>
				acc + (m.tasks ?? []).reduce((a: number, t: any) => a + (t.todos?.length ?? 0), 0),
			0
		);
	}
</script>

{#if data.needsAuth}
	<div class="flex h-dvh w-full items-center justify-center">
		<button
			class="mt-4 rounded-xl bg-stone-900 px-6 py-8 text-6xl text-stone-50"
			onclick={adminSignIn}
		>
			prove ur a jittington
		</button>
	</div>
{:else if selectedProject}
	<!-- PROJECT VIEW (full screen) -->
	<div class="flex h-dvh w-full flex-col overflow-hidden bg-white text-stone-900">
		<header class="flex items-center gap-2 border-b px-4 py-3">
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-stone-700 hover:bg-stone-100"
				onclick={backToBoard}
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Back
			</button>
			<div class="min-w-0">
				<div class="truncate text-sm font-semibold">{selectedProject.project.title}</div>
				<div class="truncate text-xs text-stone-500">
					Owner: {selectedProject.userName ?? selectedProject.userId}
				</div>
			</div>
			<div class="ml-auto flex items-center gap-3 text-xs">
				<div class="rounded bg-stone-100 px-2 py-1">
					{selectedProject.project.milestones?.length ?? 0} milestones
				</div>
				<div class="rounded bg-stone-100 px-2 py-1">
					{countTasks(selectedProject.project)} tasks
				</div>
				<div class="rounded bg-stone-100 px-2 py-1">
					{countTodos(selectedProject.project)} todos
				</div>
			</div>
		</header>

		<div class="h-[calc(100%-3rem)] overflow-y-auto p-4">
			{#if selectedProject.project.description}
				<p class="mb-4 text-sm text-stone-700">{selectedProject.project.description}</p>
			{/if}

			<div class="space-y-4">
				{#each selectedProject.project.milestones ?? [] as m (m.id)}
					<section class="rounded-md border border-stone-200">
						<div class="flex items-center justify-between border-b bg-stone-50 px-3 py-2">
							<div class="truncate text-sm font-semibold">
								{m.title}
								{#if m.ordinal != null}<span class="text-stone-500"> · #{m.ordinal}</span>{/if}
							</div>
							<span class="text-xs text-stone-500">{m.tasks?.length ?? 0} tasks</span>
						</div>

						<div class="divide-y">
							{#each m.tasks ?? [] as t (t.id)}
								<div class="px-3 py-2">
									<div class="mb-1 flex items-center justify-between">
										<div class="truncate text-sm font-medium">
											{t.title}
											{#if t.ordinal != null}<span class="text-stone-500">
													· #{t.ordinal}</span
												>{/if}
										</div>
										<span class="text-[10px] text-stone-500 uppercase"
											>{t.todos?.length ?? 0} todos</span
										>
									</div>
									{#if t.description}
										<div class="mb-1 text-xs text-stone-600">{t.description}</div>
									{/if}
									{#if (t.todos ?? []).length}
										<ul class="mt-1 space-y-1">
											{#each t.todos as td (td.id)}
												<li class="flex items-start gap-2 text-xs">
													<span class="mt-[3px] h-1.5 w-1.5 rounded-full bg-stone-400"></span>
													<span class="grow">{td.title}</span>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<!-- KANBAN BOARD (full screen) -->
	<div class="h-full w-full overflow-hidden bg-stone-50 text-stone-900">
		<div class="h-full w-full overflow-x-auto">
			<div class="grid auto-cols-[minmax(20rem,24rem)] grid-flow-col gap-6 p-6">
				{#each userEntries as [userId, info] (userId)}
					<section class="flex min-h-[78vh] flex-col rounded-lg bg-stone-100">
						<header
							class="sticky top-0 z-10 flex items-center justify-between rounded-t-lg bg-stone-200/80 px-3 py-2 backdrop-blur"
						>
							<button
								type="button"
								class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-stone-800 hover:bg-stone-300/60"
								title="Click to copy user ID"
								onclick={() => copyUserId(userId)}
							>
								<span class="truncate text-sm font-semibold">{info.name ?? userId}</span>
								{#if copiedUserId === userId}
									<svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" aria-hidden="true">
										<path
											d="M7 12.5 L10.25 15.75 L16.75 9.25"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							</button>
							<span class="text-xs text-stone-600">{info.projects.length}</span>
						</header>

						<div class="flex grow flex-col gap-2 overflow-y-auto px-3 py-3">
							{#if info.projects.length === 0}
								<div
									class="rounded-md border border-dashed border-stone-300 p-3 text-xs text-stone-500"
								>
									No projects
								</div>
							{:else}
								{#each info.projects as p (p.id)}
									<button
										type="button"
										class="group rounded-md border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:ring-2 focus:ring-stone-400/60 focus:outline-none"
										onclick={() => selectProject(userId, info.name ?? null, p)}
									>
										<div class="mb-1 flex items-center justify-between">
											<div class="truncate font-medium text-stone-800">{p.title}</div>
											{#if p.milestones?.length}
												<span
													class="ml-2 shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600"
												>
													{p.milestones.length} ms
												</span>
											{/if}
										</div>
										{#if p.description}
											<div class="line-clamp-2 text-xs text-stone-600">{p.description}</div>
										{/if}
									</button>
								{/each}
							{/if}
						</div>
					</section>
				{/each}
			</div>
		</div>
	</div>
{/if}
