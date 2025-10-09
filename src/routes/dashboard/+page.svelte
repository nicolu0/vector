<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { onDestroy, onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { difficultyBadgeClasses } from '$lib/styles/difficulty';
	import { fly } from 'svelte/transition';
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';
	import ProjectChat from '$lib/components/ProjectChat.svelte';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import type { DashboardProjectsState, StoredProject } from '$lib/stores/dashboardProjects';
	import { hasVisitedRoute, markRouteVisited } from '$lib/stores/pageVisits';

	let dashboardState = $state<DashboardProjectsState>(dashboardProjects.getSnapshot());
	let selectedProject = $state<StoredProject | null>(null);
	const HANDLE_WIDTH = 24;
	const MIN_CHAT_WIDTH = 260;
	const MAX_CHAT_WIDTH = 560;
	const MIN_DETAIL_WIDTH = 480;
	let containerWidth = $state(0);
	let chatPanelWidth = $state(320);
	let isResizing = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;
	let activePointerId: number | null = null;

	const initialLoading = $derived(
		dashboardState.status === 'loading' && dashboardState.projects.length === 0
	);
	const isRefreshing = $derived(dashboardState.status === 'refreshing');
	const loadError = $derived(dashboardState.status === 'error' ? dashboardState.error : null);
	const hasProjects = $derived(dashboardState.projects.length > 0);
	const sessionExists = $derived(dashboardState.sessionExists);
	const projects = $derived(dashboardState.projects);

	const routeVisitKey = 'dashboard';
	const initialShouldAnimate =
		typeof window === 'undefined' ? false : !hasVisitedRoute(routeVisitKey);
	if (typeof window !== 'undefined' && initialShouldAnimate) {
		markRouteVisited(routeVisitKey);
	}
	const shouldAnimateCards = initialShouldAnimate;

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

	function retryLoading() {
		void dashboardProjects.refresh();
	}

	function clampChatWidth(width: number) {
		if (containerWidth <= 0) {
			return Math.min(Math.max(width, MIN_CHAT_WIDTH), MAX_CHAT_WIDTH);
		}

		const available = Math.max(containerWidth - MIN_DETAIL_WIDTH - HANDLE_WIDTH, 0);
		const maxWidth = Math.min(MAX_CHAT_WIDTH, available);
		const minWidth = Math.min(MIN_CHAT_WIDTH, maxWidth);
		const lowerBound = maxWidth > 0 ? minWidth : 0;
		const upperBound = maxWidth > 0 ? maxWidth : 0;
		const clamped = Math.min(Math.max(width, lowerBound), upperBound);
		return Number.isFinite(clamped) ? clamped : lowerBound;
	}

	const handlePointerMove = (event: PointerEvent) => {
		if (!isResizing || event.pointerId !== activePointerId) return;
		const delta = event.clientX - dragStartX;
		chatPanelWidth = clampChatWidth(dragStartWidth - delta);
	};

	const stopResize = (event?: PointerEvent) => {
		if (!isResizing) return;
		if (event && event.pointerId !== activePointerId) return;
		isResizing = false;
		activePointerId = null;
		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerup', stopResize);
		window.removeEventListener('pointercancel', stopResize);
		if (typeof document !== 'undefined') {
			document.body.style.cursor = '';
		}
	};

	function startResize(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		isResizing = true;
		activePointerId = event.pointerId;
		dragStartX = event.clientX;
		dragStartWidth = chatPanelWidth;
		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', stopResize);
		window.addEventListener('pointercancel', stopResize);
		if (typeof document !== 'undefined') {
			document.body.style.cursor = 'col-resize';
		}
	}

	$effect(() => {
		if (!selectedProject) return;
		const match = dashboardState.projects.find((project) => project.id === selectedProject?.id);
		if (!match) {
			selectedProject = null;
		} else if (match !== selectedProject) {
			selectedProject = match;
		}
	});

	onMount(() => {
		const unsubscribe = dashboardProjects.subscribe((value) => {
			dashboardState = value;
		});

		void dashboardProjects.load();

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		stopResize();
	});

	$effect(() => {
		chatPanelWidth = clampChatWidth(chatPanelWidth);
	});
	$effect(() => {
		if (typeof document === 'undefined') return;
		const main = document.getElementById('app-main');
		if (!main) return;

		const lock = Boolean(selectedProject);
		main.classList.toggle('overflow-hidden', lock);
		main.classList.toggle('overflow-auto', !lock);

		// Optional hard lock to prevent overscroll chaining on iOS
		document.documentElement.classList.toggle('overflow-hidden', lock);
		document.documentElement.classList.toggle('overscroll-none', lock);
		document.body.classList.toggle('overflow-hidden', lock);
		document.body.classList.toggle('overscroll-none', lock);
	});
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<div
	class="w-full bg-stone-50 px-6 py-4 text-stone-800"
	class:h-full={!!selectedProject}
	class:overflow-clip={!!selectedProject}
>
	<div class="mx-auto w-full max-w-5xl" class:h-full={!!selectedProject}>
		{#if selectedProject}
			<div class="flex h-full flex-col">
				<button
					type="button"
					class="inline-flex items-center gap-2 text-sm text-stone-600 transition hover:text-stone-900"
					onclick={() => (selectedProject = null)}
					aria-label="Back to dashboard"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					Back
				</button>

				<div
					class="mt-6 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0"
					bind:clientWidth={containerWidth}
					class:select-none={isResizing}
				>
					<div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
						<ProjectDetail project={selectedProject} />
					</div>
					<div
						class="hidden lg:flex lg:w-6 lg:flex-none lg:cursor-col-resize lg:items-stretch lg:justify-center"
						onpointerdown={startResize}
						role="separator"
						aria-orientation="vertical"
						aria-label="Resize project panels"
					>
						<div class="my-2 h-full w-px rounded-full bg-stone-200" />
					</div>

					<!-- Chat panel: fixed width and scrolls itself -->
					<div
						class="min-h-0 w-full lg:[width:var(--chat-panel-width)] lg:flex-none"
						style={`--chat-panel-width: ${chatPanelWidth}px`}
					>
						<div class="h-full min-h-0 overflow-y-auto">
							<ProjectChat />
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between gap-3">
				<div>
					<h1 class="text-3xl font-semibold tracking-tight text-stone-800">Dashboard</h1>
				</div>
				{#if isRefreshing && hasProjects}
					<div class="flex items-center gap-2 text-xs text-stone-500" aria-live="polite">
						<svg
							viewBox="0 0 24 24"
							class="h-3.5 w-3.5 animate-spin"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M12 3v2m6.36.64-1.42 1.42M21 12h-2m-.64 6.36-1.42-1.42M12 19v2m-6.36-.64 1.42-1.42M5 12H3m.64-6.36 1.42 1.42"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span>Updating…</span>
					</div>
				{/if}
			</div>

			{#if initialLoading}
				<div class="mt-10"></div>
			{:else if loadError}
				<div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
					<p>{loadError}</p>
					<button
						type="button"
						class="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
						onclick={retryLoading}
					>
						<svg
							viewBox="0 0 24 24"
							class="h-3.5 w-3.5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0 1 6 6m12 12a9 9 0 0 0 0-12"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Try again
					</button>
				</div>
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
							in:fly|global={shouldAnimateCards
								? { y: 10, duration: 500, easing: cubicOut, delay: index * 100 }
								: undefined}
							class="flex min-h-[120px] cursor-pointer flex-col items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-stone-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:outline-none"
							role="button"
							tabindex="0"
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
										class={`rounded-lg border px-2 py-1 text-[10px] ${difficultyBadgeClasses(project.difficulty)}`}
									>
										{project.difficulty}
									</span>
									<span
										class={`shrink-0 rounded-lg border border-stone-400 bg-stone-100 px-2 py-1 text-[10px] text-stone-500`}
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
