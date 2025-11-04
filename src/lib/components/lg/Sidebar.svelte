<script lang="ts">
	import Profile from '$lib/components/md/Profile.svelte';
	import Folder from '$lib/components/sm/Folder.svelte';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import vectorUrl from '$lib/assets/vector.svg?url';

	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
		isTutorial?: boolean;
	};

	let { tasks = [], activeTaskId = null } = $props<{
		tasks?: Task[];
		tutorialTasks?: Task[]; // NEW
		activeTaskId?: string | null;
	}>();

	let sidebarCollapsed = $state(false);
	const EXPANDED_WIDTH = 'min(21vw, 20rem)';
	const COLLAPSED_WIDTH = '3rem';
	const containerFlex = $derived(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
	const sidebarTransform = $derived(sidebarCollapsed ? 'translateX(-100%)' : 'translateX(0%)');

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	type AuthUI = {
		signOut: () => Promise<void>;
	};
	const { signOut } = getContext<AuthUI>('auth-ui');
</script>

<div
	class="relative flex h-full min-w-0 overflow-hidden transition-[flex-basis] duration-200 ease-out"
	style={`flex-basis: ${containerFlex}; flex-grow: 0; flex-shrink: 0;`}
>
	<aside
		id="sidebar-nav"
		class="relative flex h-full w-full flex-col justify-between border-r border-stone-200 bg-stone-100 backdrop-blur-sm transition-transform duration-200 ease-out"
		class:pointer-events-none={sidebarCollapsed}
		style:width={EXPANDED_WIDTH}
		style:transform={sidebarTransform}
		aria-hidden={sidebarCollapsed}
	>
		<div class="flex flex-col">
			<div class="flex w-full items-center justify-end gap-2 px-4 pt-4 pb-3">
				<button
					type="button"
					onclick={toggleSidebar}
					class="inline-flex h-6 w-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
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

			<div class="space-y-1 overflow-y-auto px-2 py-2">
				<div class="mt-4 mb-1 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
					Milestones
				</div>
				<Folder id="ms-123" name="Env Setup" {tasks} initiallyOpen={false} />
			</div>
		</div>

		<Profile
			name="Andrew Chang"
			email="21andrewch@alumni.harker.org"
			sidebarCollapsed={false}
			onSignOut={signOut}
		/>
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
