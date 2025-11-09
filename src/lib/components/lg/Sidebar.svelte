<script lang="ts">
	import Today from '$lib/components/md/Today.svelte';
	import Milestones from '$lib/components/md/Milestones.svelte';
	import Tutorial from '$lib/components/md/Tutorial.svelte';
	import Profile from '$lib/components/md/Profile.svelte';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import vectorUrl from '$lib/assets/vector.svg?url';

	type Milestone = { id: string; title: string; description?: string };
	type TasksMap = Record<string, Array<{ id: string; title: string }>>;

	let {
		milestones = [],
		tasksByMilestone = {},
		tutorial = false,
		email = ''
	} = $props<{
		milestones?: Milestone[];
		tasksByMilestone?: TasksMap;
		tutorial?: boolean;
		email?: string;
	}>();

	let sidebarCollapsed = $state(false);
	const EXPANDED_WIDTH = 'min(21vw, 20rem)';
	const COLLAPSED_WIDTH = '3rem';
	const containerFlex = $derived(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
	const sidebarTransform = $derived(sidebarCollapsed ? 'translateX(-100%)' : 'translateX(0%)');

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	type AuthUI = { signOut: () => Promise<void> };
	const { signOut } = getContext<AuthUI>('auth-ui');

	function extractMilestoneId(pathname: string): string | null {
		const m = /^\/milestone\/([^/]+)/.exec(pathname);
		return m ? m[1] : null;
	}

	function extractTaskId(pathname: string): string | null {
		const m = /^\/task\/([^/]+)/.exec(pathname);
		return m ? m[1] : null;
	}

	// Derive current route selection and keep a local, instantly-updating selection
	const routeMilestoneId = $derived<string | null>(extractMilestoneId($page.url.pathname));
	const routeTaskId = $derived<string | null>(extractTaskId($page.url.pathname));
	let selectedMilestoneId = $state<string | null>(routeMilestoneId);
	let selectedTaskId = $state<string | null>(routeTaskId);

	// When the route changes, sync the local selection
	$effect(() => {
		selectedMilestoneId = routeMilestoneId;
		selectedTaskId = routeTaskId;
	});
</script>

<div
	class="relative flex h-full min-w-0 flex-col overflow-hidden transition-[flex-basis] duration-200 ease-out"
	style={`flex-basis:${containerFlex};flex-grow:0;flex-shrink:0;`}
>
	<aside
		id="sidebar-nav"
		class="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-stone-200 bg-stone-100 backdrop-blur-sm transition-transform duration-200 ease-out"
		class:pointer-events-none={sidebarCollapsed}
		style:width={EXPANDED_WIDTH}
		style:transform={sidebarTransform}
		aria-hidden={sidebarCollapsed}
	>
		<div class="flex h-full min-h-0 flex-col">
			{#if !sidebarCollapsed}
				<div class="min-h-0 flex-1 overflow-y-auto">
					<div class="flex flex-col">
						<div class="flex w-full items-center justify-end gap-2 px-4 pt-3 pb-3">
							<button
								type="button"
								onclick={toggleSidebar}
								class="inline-flex items-center justify-center rounded-md p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
								aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
							>
								<svg
									viewBox="0 0 24 24"
									class="h-5 w-5"
									stroke="currentColor"
									fill="none"
									stroke-width="1.8"
								>
									<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>

						{#if tutorial}
							<Tutorial />
						{/if}

						<Today {tasksByMilestone} />

						<Milestones
							{milestones}
							{tasksByMilestone}
							initiallyOpen={true}
							selectedId={selectedMilestoneId}
							{selectedTaskId}
							onSelect={(id) => {
								// Instant UI feedback
								selectedMilestoneId = id;
								selectedTaskId = null;
							}}
							onSelectTask={(taskId) => {
								selectedTaskId = taskId;
							}}
						/>
					</div>
				</div>
			{/if}

			<div class="bg-stone-100">
				<Profile name="User" {email} {sidebarCollapsed} onSignOut={signOut} />
			</div>
		</div>
	</aside>

	<button
		type="button"
		onclick={() => {
			if (sidebarCollapsed) {
				sidebarCollapsed = false;
			} else {
				goto('/');
			}
		}}
		class="fixed top-3 left-3 flex items-center gap-2 rounded-md px-1 py-1 text-stone-700 transition hover:bg-stone-200 hover:text-stone-900"
		aria-label="Go to home"
	>
		<img src={vectorUrl} alt="vector" class="h-5 w-5" />
	</button>
</div>
