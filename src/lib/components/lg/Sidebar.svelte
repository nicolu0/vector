<script lang="ts">
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
		tutorialTasks = [], // NEW
		activeTaskId = null,
		onSelect,
		creating = false
	} = $props<{
		tasks?: Task[];
		tutorialTasks?: Task[]; // NEW
		activeTaskId?: string | null;
		onSelect: (id: string) => void;
		creating?: boolean;
	}>();

	let sidebarCollapsed = $state(false);
	const EXPANDED_WIDTH = 250;
	const COLLAPSED_WIDTH = 60;

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

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
			{#each tasks as task}
				{#key task.id}
					<button
						type="button"
						onclick={() => {
							if (!isPendingTask(task.id)) {
								goto(`/project/${task.id}`);
								activeTaskId = task.id;
							}
						}}
						disabled={isPendingTask(task.id)}
						aria-disabled={isPendingTask(task.id)}
						aria-busy={isPendingTask(task.id)}
						class={`flex w-full items-center rounded-lg px-2 py-2 transition ${
							isPendingTask(task.id) ? 'cursor-not-allowed opacity-60' : 'hover:bg-stone-200/70'
						} ${activeTaskId === task.id ? 'bg-stone-200' : ''}`}
						title={task.title}
					>
						<div class="flex min-w-0 items-center gap-2">
							{#if isPendingTask(task.id)}
								<!-- left spinner -->
								<svg
									class="h-3 w-3 animate-spin text-stone-600"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<circle
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-opacity="0.25"
										stroke-width="3"
									/>
									<path
										d="M22 12a10 10 0 0 0-10-10"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
									/>
								</svg>
							{:else}
								<span
									class="relative grid h-3 w-3 place-items-center rounded-full border border-dashed border-stone-500/60"
								/>
							{/if}

							{#if !sidebarCollapsed}
								<span
									class={`min-w-0 flex-1 overflow-hidden font-mono text-xs tracking-tight text-ellipsis whitespace-nowrap ${
										activeTaskId === task.id ? 'text-stone-900' : 'text-stone-700'
									}`}
								>
									{task.title}
								</span>
							{/if}
						</div>
					</button>
				{/key}
			{/each}
			<div class="mt-4 mb-1 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
				Resources
			</div>
		</div>
	</div>

	<div class="border-t border-stone-200 px-2 py-2">
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900"
			onclick={signOut}
			aria-label="Sign out"
		>
			<!-- Logout icon -->
			<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
				<path d="M15 12H3" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M12 15l3-3-3-3" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M21 19V5a2 2 0 0 0-2-2h-6" stroke-linecap="round" />
			</svg>
			{#if !sidebarCollapsed}
				<span class="text-sm font-medium">Sign out</span>
			{/if}
		</button>
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-stone-200/70"
			onclick={openAuthModal}
		>
			<div class="h-7 w-7 rounded-full bg-stone-300"></div>
			{#if !sidebarCollapsed}
				<div class="flex flex-col">
					<span class="text-sm font-medium">Andrew Chang</span>
				</div>
			{/if}
		</button>
	</div>
</aside>
