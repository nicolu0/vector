<!-- src/lib/components/lg/Sidebar.svelte -->
<script lang="ts">
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
		onSelect,
		creating = false
	} = $props<{
		tasks?: Task[];
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
</script>

<aside
	class="relative flex h-full flex-col justify-between border-r border-stone-200 bg-stone-50/90 backdrop-blur-sm transition-[width] duration-200 ease-out"
	style={`width: ${sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px;`}
>
	<div class="flex flex-col">
		<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
			<button class="flex items-center gap-2" onclick={() => goto('/')} aria-label="Go to home">
				<img src={vectorUrl} alt="vector" class="h-5 w-5" />
			</button>

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
			{#each tasks as task}
				<button
					type="button"
					onclick={() => onSelect(task.id)}
					class={`flex w-full items-center rounded-lg px-2 py-2 transition hover:bg-stone-200/70 ${
						activeTaskId === task.id ? 'bg-stone-200' : ''
					}`}
				>
					<div class="flex min-w-0 items-center gap-2">
						{#if isPendingTask(task.id)}
							<span class="relative grid h-3 w-3 place-items-center">
								<!-- spinner -->
							</span>
						{:else}
							<span
								class={`'border-stone-500'} relative grid h-3 w-3 place-items-center rounded-full border  border-dashed`}
							/>
						{/if}

						{#if !sidebarCollapsed}
							<span
								class={`min-w-0 flex-1 overflow-hidden font-mono text-xs tracking-tight text-ellipsis whitespace-nowrap ${
									activeTaskId === task.id ? 'text-stone-900' : 'text-stone-700'
								}`}
								title={task.title}
							>
								{task.title}
							</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<div class="border-t border-stone-200 px-2 py-3">
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-stone-200/70"
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
