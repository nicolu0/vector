<!-- src/lib/components/md/Milestones.svelte -->
<script lang="ts">
	import Folder from '$lib/components/sm/Folder.svelte';

	type Milestone = { id: string; title: string; description?: string; ordinal?: number | null };
	type TasksMap = Record<string, Array<{ id: string; title: string; done: boolean; ordinal?: number | null; tutorial?: boolean }>>;

	let {
		milestones = [],
		tasksByMilestone = {},
		initiallyOpen = true,
		selectedId = null,
		selectedTaskId = null,
		onSelect = null,
		onSelectTask = null
	} = $props<{
		milestones?: Milestone[];
		tasksByMilestone?: TasksMap;
		initiallyOpen?: boolean;
		selectedId?: string | null;
		selectedTaskId?: string | null;
		onSelect?: ((id: string) => void) | null;
		onSelectTask?: ((taskId: string) => void) | null;
	}>();

	let open = $state(initiallyOpen);
	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}
</script>

<div class="space-y-1 px-2 py-2">
	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		class="group flex w-full items-center justify-between rounded-md px-2 py-1.5
		       text-xs font-medium text-stone-600 uppercase hover:bg-stone-200"
	>
		<span>Milestones</span>
	</button>

	<div
		class={`grid overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0">
			{#if milestones.length > 0}
				<ul class="space-y-1">
					{#each milestones as m (m.id)}
						<li>
							<Folder
								id={m.id}
								name={m.title}
								tasks={tasksByMilestone[m.id] ?? []}
								initiallyOpen={false}
								active={selectedId === m.id}
								{selectedTaskId}
								{onSelectTask}
								onSelect={onSelect ? () => onSelect(m.id) : null}
							/>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="px-2 py-4 text-xs text-stone-500">No milestones yet.</div>
			{/if}
		</div>
	</div>
</div>
