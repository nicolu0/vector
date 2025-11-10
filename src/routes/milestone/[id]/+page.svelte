<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

    let milestone = $derived(data?.milestone);
</script>

<div class="flex h-full w-full flex-col gap-4 bg-stone-50 px-3 pl-6 pb-5">
    <div>
        <div class="mb-2 text-[32px] font-semibold text-stone-900">
            Milestone {milestone?.ordinal}: {milestone?.title}
        </div>

        {#if milestone?.skills && milestone?.skills.length > 0}
            <ul class="flex flex-wrap gap-2">
                {#each milestone?.skills as skill (skill)}
                    <li>
                        <span
                            class="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900"
                        >
                            {skill}
                        </span>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    <div class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800">
        <div class="mb-2 font-semibold text-stone-900">Description</div>
        {milestone?.description}
    </div>
</div>
