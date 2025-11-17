<script lang="ts">
	import Task from '$lib/components/sm/Task.svelte';
	import { type MilestoneStatus } from '$lib/stores/tasks';

	type TaskData = {
		id: string;
		title: string;
		tutorial?: boolean;
		done: boolean;
		ordinal?: number | null;
	};

	let {
		id,
		name,
		status = 'not_started',
		tasks = [] as TaskData[],
		initiallyOpen = false,
		active = false,
		selectedTaskId = null,
		initialOpenTaskId = null,
		onSelect = null,
		onSelectTask = null
	} = $props<{
		id: string;
		name: string;
		status?: MilestoneStatus;
		tasks?: TaskData[];
		initiallyOpen?: boolean;
		active?: boolean;
		selectedTaskId?: string | null;
		initialOpenTaskId?: string | null;
		onSelect?: ((id: string) => void) | null;
		onSelectTask?: ((taskId: string) => void) | null;
	}>();

	let open = $state(initiallyOpen);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function navigate() {
		onSelect?.(id);
	}

	let taskState = $state<Record<string, boolean>>({});
	$effect(() => {
		const next: Record<string, boolean> = {};
		for (const task of tasks) {
			next[task.id] = task.done ?? false;
		}
		taskState = next;
	});

	function toggleTask(taskId: string) {
		taskState = {
			...taskState,
			[taskId]: !(taskState[taskId] ?? false)
		};
	}

    $effect(() => {
        const hasSelectedTask = selectedTaskId && tasks.some((t: TaskData) => t.id === selectedTaskId);
        const hasInitialOpenTask = initialOpenTaskId && tasks.some((t: TaskData) => t.id === initialOpenTaskId);
        if (hasSelectedTask || hasInitialOpenTask) {
            open = true;
        }
    });
</script>

<div
	class={`flex w-full max-w-full min-w-0 items-center overflow-hidden rounded-md px-1 transition ${
		active ? 'bg-stone-300/50' : 'hover:bg-stone-200/50'
	}`}
>
	<button
		type="button"
		onclick={navigate}
		class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md px-1 py-1 text-left"
		aria-label={`Open milestone ${name}`}
		aria-current={active ? 'page' : undefined}
	>
		<span
			class="inline-block h-1 w-1 shrink-0 rounded-full"
			class:bg-emerald-500={status === 'complete'}
			class:bg-amber-500={status === 'in_progress'}
			class:bg-stone-400={status === 'not_started'}
			aria-label={status}
			aria-hidden="true"
		></span>
		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-900">
				<span class="block truncate">{name}</span>
			</div>
		</div>
	</button>
	<button
		type="button"
		class={`ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-300 hover:text-stone-700`}
		aria-label={open ? 'Collapse' : 'Expand'}
		aria-expanded={open}
		onclick={toggle}
	>
		<svg
			viewBox="0 0 24 24"
			class={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
</div>

<!-- Collapsible task list -->
<div
	class={`grid overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
>
	<div class="min-h-0 min-w-0">
		{#if tasks.length > 0}
			<ul class="mt-1 min-w-0 space-y-1">
				{#each tasks as t (t.id)}
					<Task
						id={t.id}
						title={t.title}
						checked={t.done}
						active={selectedTaskId === t.id}
						onToggle={toggleTask}
						onSelect={onSelectTask ? () => onSelectTask(t.id) : null}
						tutorial={t.tutorial ?? false}
					/>
				{/each}
			</ul>
		{:else}
			<div class="ml-5 px-2 py-1 text-sm text-stone-500">No tasks</div>
		{/if}
	</div>
</div>
