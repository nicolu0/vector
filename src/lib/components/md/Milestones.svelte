<!-- src/lib/components/md/Milestones.svelte -->
<script lang="ts">
	import Folder from '$lib/components/sm/Folder.svelte';
	import { type MilestoneStatus } from '$lib/stores/tasks';

	type Milestone = {
		id: string;
		title: string;
		description?: string;
		ordinal?: number | null;
		status?: MilestoneStatus;
	};
	type TasksMap = Record<
		string,
		Array<{ id: string; title: string; done: boolean; ordinal?: number | null; tutorial?: boolean }>
	>;

	let {
		milestones = [],
		tasksByMilestone = {},
		milestoneStatus = {},
		initiallyOpen = true,
		selectedId = null,
		selectedTaskId = null,
		initialOpenTaskId = null,
		onSelect = null,
		onSelectTask = null
	} = $props<{
		milestones?: Milestone[];
		tasksByMilestone?: TasksMap;
		milestoneStatus?: Record<string, MilestoneStatus>;
		initiallyOpen?: boolean;
		selectedId?: string | null;
		selectedTaskId?: string | null;
		initialOpenTaskId?: string | null;
		onSelect?: ((id: string) => void) | null;
		onSelectTask?: ((taskId: string) => void) | null;
	}>();
	$inspect('tasks: ', tasksByMilestone);

	let open = $state(initiallyOpen);
	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

    $effect(() => {
        if (selectedTaskId || initialOpenTaskId) {
            open = true;
        }
    });
</script>

<div class="w-full min-w-0 space-y-1 px-2 py-2">
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
		class={`grid min-w-0 overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0 min-w-0">
			{#if milestones.length > 0}
				<ul class="w-full min-w-0 space-y-1">
					{#each milestones as m (m.id)}
						<li class="w-full min-w-0">
							<Folder
								id={m.id}
								name={m.title}
								status={milestoneStatus[m.id] ?? 'not_started'}
								tasks={tasksByMilestone[m.id] ?? []}
								initiallyOpen={false}
								active={selectedId === m.id}
								{selectedTaskId}
								{initialOpenTaskId}
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
