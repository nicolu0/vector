<script lang="ts">
	import { goto } from '$app/navigation';
	import Task from '$lib/components/sm/Task.svelte';

	type TaskData = { id: string; title: string };

	let {
		id,
		name,
		tasks = [] as TaskData[],
		initiallyOpen = false,
		active = false,
		selectedTaskId = null,
		onSelect = null,
		onSelectTask = null
	} = $props<{
		id: string;
		name: string;
		tasks?: TaskData[];
		initiallyOpen?: boolean;
		active?: boolean;
		selectedTaskId?: string | null;
		onSelect?: ((id: string) => void) | null;
		onSelectTask?: ((taskId: string) => void) | null;
	}>();

	let open = $state(initiallyOpen);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function navigate() {
		onSelect?.(id); // instant highlight
		goto(`/milestone/${id}`); // then navigate
	}

	let done: Record<string, boolean> = $state({});
	function toggleTask(taskId: string) {
		done[taskId] = !done[taskId];
	}
</script>

<div class="group rounded-lg">
	<!-- Row -->
	<div
		class={`flex items-center rounded-md px-1  transition ${
			active ? 'bg-stone-300' : 'hover:bg-stone-200'
		}`}
	>
		<!-- Chevron -->
		<button
			type="button"
			class={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-400/50 hover:text-stone-800`}
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

		<!-- Clickable name -->
		<button
			type="button"
			onclick={navigate}
			class="flex min-w-0 flex-1 items-center justify-between rounded-md px-1 py-1 text-left"
			aria-label={`Open milestone ${name}`}
			aria-current={active ? 'page' : undefined}
		>
			<div class="min-w-0">
				<div class={`truncate text-sm font-medium text-stone-900`}>
					{name}
				</div>
			</div>
		</button>
	</div>

	<!-- Collapsible task list -->
	<div
		class={`grid overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0">
			{#if tasks.length > 0}
				<ul class="mt-1 space-y-1">
					{#each tasks as t (t.id)}
						<Task
							id={t.id}
							title={t.title}
							checked={!!done[t.id]}
							active={selectedTaskId === t.id}
							onToggle={toggleTask}
							onSelect={onSelectTask ? () => onSelectTask(t.id) : null}
						/>
					{/each}
				</ul>
			{:else}
				<div class="ml-5 px-2 py-1 text-sm text-stone-500">No tasks</div>
			{/if}
		</div>
	</div>
</div>
