<script lang="ts">
    import { getContext } from 'svelte';
    import { VIEWER_CONTEXT_KEY, type ViewerContext } from '$lib/stores/viewer';
    import { milestoneStatusStore, type MilestoneStatus } from '$lib/stores/tasks';
    import { get } from 'svelte/store';

	type Milestone = {
		id: string;
		title: string;
		done: boolean;
		description?: string;
		ordinal?: number | null;
	};
	let { milestones = [] as Milestone[] } = $props();

    const { selectMilestone } = getContext<ViewerContext>(VIEWER_CONTEXT_KEY);

    let milestoneStatus = $state(get(milestoneStatusStore));
    $effect(() => {
        const unsub = milestoneStatusStore.subscribe((v) => {
            milestoneStatus = v;
        });
        return () => {
            unsub();
        };
    })

    const isDone = (m: Milestone) => milestoneStatus[m.id]?.done ?? m.done;

	const lastCompletedIndex = $derived.by(() => {
		for (let i = milestones.length - 1; i >= 0; i--) {
			if (isDone(milestones[i])) {
				return i;
			}
		}
		return -1;
	});

    function goToMilestone(milestoneId: string) {
        selectMilestone(milestoneId);
    }
</script>

<div class="w-full px-2 py-4">
	<div class="flex items-center gap-0">
		{#each milestones as m, i}
			{#if i > 0}
				<div
					class="mx-1.5 h-0.5 flex-1 rounded-full transition-colors"
					class:bg-emerald-400={i <= lastCompletedIndex}
					class:bg-stone-400={i === lastCompletedIndex + 1}
					class:bg-stone-200={i > lastCompletedIndex + 1}
				></div>
			{/if}
			<div class="group relative">
				<button
					type="button"
					class="relative flex size-3 items-center justify-center rounded-full ring-3 transition-all outline-none"
					class:bg-stone-400={i === lastCompletedIndex + 1}
					class:bg-emerald-400={isDone(m)}
					class:bg-stone-200={!isDone(m)}
					class:ring-stone-300={i === lastCompletedIndex + 1}
					class:ring-emerald-400={isDone(m)}
					class:ring-stone-200={!isDone(m)}
					aria-label={m.title}
					aria-describedby={'tip-' + i}
                    onclick={() => goToMilestone(m.id)}
				>
					{#if isDone(m)}
						<!-- WHITE CHECKMARK (two thin lines) -->
						<span
							class="pointer-events-none absolute block h-[1.5px] w-[4px] translate-x-[-2.3px] translate-y-[1.2px]
                            rotate-45 rounded bg-white"
						/>
						<span
							class="pointer-events-none absolute block h-[1.5px] w-[8px] translate-x-[1.1px] translate-y-[0px]
                            -rotate-45 rounded bg-white"
						/>
					{/if}
				</button>
				<div
					id={'tip-' + i}
					role="tooltip"
					class="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-md bg-stone-700 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
				>
					{m.title}
				</div>
			</div>
		{/each}
	</div>
</div>

