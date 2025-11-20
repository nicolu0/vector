<script lang="ts">
	type ProjectEntry = {
		id: string;
		title: string;
		description?: string | null;
	} & Record<string, unknown>;

	let {
		projects = [] as ProjectEntry[],
		currentProjectId = null,
		onSelect = null
	} = $props<{
		projects?: ProjectEntry[];
		currentProjectId?: string | null;
		onSelect?: ((id: string) => void) | null;
	}>();

	let open = $state(true);

	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

	function handleSelect(id: string) {
		onSelect?.(id);
	}
</script>

<div class="w-full min-w-0 space-y-1 px-2 py-2">
	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		class="group flex w-full items-center justify-between rounded-md px-2 py-1.5
		       text-xs font-medium text-stone-600 uppercase hover:bg-stone-200"
	>
		<span>Projects</span>
	</button>

	<div
		class={`grid min-w-0 overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0 min-w-0">
			{#if projects.length > 0}
				<ul class="w-full min-w-0 space-y-1">
					{#each projects as project (project.id)}
						<li class="w-full min-w-0">
							<button
								type="button"
								class={`flex w-full flex-col items-start rounded-md px-2 py-1 text-left text-sm text-stone-700 transition ${
									project.id === currentProjectId
										? 'bg-stone-200 text-stone-900'
										: 'hover:bg-stone-200/60'
								}`}
								aria-current={project.id === currentProjectId ? 'page' : undefined}
								onclick={() => handleSelect(project.id)}
							>
								<span class="block w-full truncate font-medium">
									{project.title || 'Untitled Project'}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="px-2 py-4 text-xs text-stone-500">No projects yet.</div>
			{/if}
		</div>
	</div>
</div>
