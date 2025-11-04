<script lang="ts">
	import Task from '$lib/components/sm/Task.svelte';
	import { goto } from '$app/navigation';

	let {
		id,
		name,
		tasks = [] as Task[],
		initiallyOpen = false
	} = $props<{
		id: string;
		name: string;
		tasks?: Task[];
		initiallyOpen?: boolean;
	}>();

	let open = $state(initiallyOpen);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}
	function navigate() {
		goto(`/milestone/${id}`);
	}
	let done: Record<string, boolean> = $state({});
	function toggleTask(id: string) {
		console.log(id);
		done[id] = !done[id];
	}
</script>

<div class="group rounded-md hover:bg-stone-200">
	<div class="flex items-center bg-transparent">
		<button
			type="button"
			class="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-300 hover:text-stone-800"
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

		<button
			type="button"
			onclick={navigate}
			class="flex min-w-0 flex-1 items-center justify-between rounded-lg bg-transparent px-2 py-1 text-left"
			aria-label={`Open milestone ${name}`}
		>
			<div class="min-w-0">
				<div class="truncate text-xs font-medium text-stone-900">{name}</div>
			</div>
			<span class="ml-2 rounded-md border border-stone-300 px-1.5 py-0.5 text-[8px] text-stone-500">
				{tasks.length} tasks
			</span>
		</button>
	</div>

	<div
		class={`overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} grid`}
	>
		<div class="min-h-0">
			<ul class="">
				{#each tasks as t (t.id)}
					<Task id={t.id} title={t.title} checked={!!done[t.id]} onToggle={toggleTask} />
				{/each}
			</ul>
		</div>
	</div>
</div>
