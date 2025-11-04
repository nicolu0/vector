<script lang="ts">
	import Folder from '$lib/components/sm/Folder.svelte';

	type Milestone = { id: string; title: string; summary?: string };

	let { milestones = [], initiallyOpen = true } = $props<{
		milestones?: Milestone[];
		initiallyOpen?: boolean;
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
		class="group flex w-full items-center justify-between rounded-md px-2 py-1
		       text-xs font-semibold tracking-wide text-stone-500
		       uppercase hover:bg-stone-200"
	>
		<span>Milestones</span>
	</button>

	<div
		class={`grid overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0">
			{#if milestones.length > 0}
				<ul class="mt-2 space-y-1">
					{#each milestones as m (m.id)}
						<li>
							<Folder id={m.id} name={m.title} initiallyOpen={false} />
						</li>
					{/each}
				</ul>
			{:else}
				<div class="px-2 py-4 text-xs text-stone-500">No milestones yet.</div>
			{/if}
		</div>
	</div>
</div>
