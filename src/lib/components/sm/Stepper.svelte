<script lang="ts">
    type Milestone = { title: string; done: boolean };
    let { milestones = [] as Milestone[] } = $props();
    const lastCompletedIndex = $derived(
        (() => {
            for (let i = milestones.length - 1; i >= 0; i--) {
                if (milestones[i].done) {
                    return i;
                }
            }
            return -1;
        })()
    );
</script>

<div class="px-2 py-4 w-full">
    <div class="flex items-center gap-0">
        {#each milestones as m, i}
            {#if i > 0}
                <div class="h-0.5 flex-1 mx-1.5 rounded-full transition-colors" class:bg-emerald-400={i <= lastCompletedIndex} class:bg-stone-400={i === lastCompletedIndex + 1} class:bg-stone-200={i > lastCompletedIndex + 1}></div>
            {/if}
            <div class="relative group">
                <button
                    type="button"
                    class="relative size-3 rounded-full ring-3 transition-all outline-none flex items-center justify-center"
                    class:bg-stone-400={i === lastCompletedIndex + 1}
                    class:bg-emerald-400={m.done}
                    class:bg-stone-200={!m.done}
                    class:ring-stone-300={i === lastCompletedIndex + 1}
                    class:ring-emerald-400={m.done}
                    class:ring-stone-200={!m.done}
                    aria-label={m.title}
                    aria-describedby={"tip-" + i}
                >
                {#if m.done}
                    <!-- WHITE CHECKMARK (two thin lines) -->
                    <span
                    class="pointer-events-none absolute block h-[1.5px] w-[4px] bg-white rounded
                            rotate-45 translate-x-[-2.3px] translate-y-[1.2px]"
                    />
                    <span
                    class="pointer-events-none absolute block h-[1.5px] w-[8px] bg-white rounded
                            -rotate-45 translate-x-[1.1px] translate-y-[0px]"
                    />
                {/if}
                </button>
                <div id={"tip-" + i} role="tooltip" class="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-700 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
                    {m.title}
                </div>
            </div>
        {/each}
    </div>
</div>