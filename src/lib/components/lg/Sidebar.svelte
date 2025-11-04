<script lang="ts">
	import Profile from '$lib/components/md/Profile.svelte';
	import Folder from '$lib/components/sm/Folder.svelte';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import vectorUrl from '$lib/assets/vector.svg?url';

	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
		isTutorial?: boolean;
	};

	let {
		tasks = [],
		activeTaskId = null,
		creating = false
	} = $props<{
		tasks?: Task[];
		tutorialTasks?: Task[]; // NEW
		activeTaskId?: string | null;
		creating?: boolean;
	}>();

	let sidebarCollapsed = $state(false);
	const EXPANDED_WIDTH = 250;
	const COLLAPSED_WIDTH = 60;

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	let profileModal = $state(false);

	const isPendingTask = (taskId: string) => {
		const last = tasks[tasks.length - 1];
		return creating && last && last.id === taskId;
	};
	type AuthUI = {
		openAuthModal: () => void;
		signOut: () => Promise<void>;
	};
	const { openAuthModal, signOut } = getContext<AuthUI>('auth-ui');
</script>

<aside
	class="relative flex h-full flex-col justify-between border-r border-stone-200 bg-stone-100 backdrop-blur-sm transition-[width] duration-200 ease-out"
	style={`width: ${sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px;`}
>
	<div class="flex flex-col">
		<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
			<button
				class="flex items-center gap-2"
				onclick={() => {
					goto('/');
					activeTaskId = null;
				}}
				aria-label="Go to home"
			>
				<img src={vectorUrl} alt="vector" class="h-5 w-5" />
			</button>

			{#if !sidebarCollapsed}
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
			{/if}
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
