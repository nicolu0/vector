<script lang="ts">
	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
	};

	interface Props {
		tasks: Task[];
		activeTaskId?: string | null;
		onSelect: (taskId: string) => void;
		onCreateTask: () => void;
		creating?: boolean;
	}

	let { tasks, activeTaskId = null, onSelect, onCreateTask, creating = false }: Props = $props();

	function handleSelect(taskId: string) {
		onSelect(taskId);
	}

	const isPendingTask = (taskId: string) => {
		// assume the pending (streaming) task is the last one
		const last = tasks[tasks.length - 1];
		return creating && last && last.id === taskId;
	};
</script>

<div class="flex h-full w-full flex-col gap-4 bg-stone-50 p-6">
	<div class="flex flex-wrap items-center justify-between">
		<div>
			<h1 class="text-sm font-semibold tracking-tight text-stone-900 uppercase">Task List</h1>
		</div>
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
			onclick={onCreateTask}
			disabled={creating}
		>
			{creating ? 'Generating…' : 'Generate'}
			<svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.8">
				<path d="M4 12h14" stroke-linecap="round" stroke-linejoin="round" />
				<path d="m12 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</div>

	{#if tasks.length === 0}
		<p
			class="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-xs text-stone-500"
		>
			No tasks yet. Generate a task to get started.
		</p>
	{:else}
		<ul class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
			{#each tasks as task (task.id)}
				<li>
					<button
						type="button"
						onclick={() => handleSelect(task.id)}
						class={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
							task.id === activeTaskId ? 'bg-stone-50' : ''
						}`}
					>
						<div class="flex min-w-0 items-center gap-2">
							{#if isPendingTask(task.id)}
								<!-- spinner -->
								<span class="relative grid h-3 w-3 place-items-center">
									<svg
										class="h-3 w-3 animate-spin text-stone-500"
										viewBox="0 0 12 12"
										fill="none"
										stroke="currentColor"
									>
										<circle cx="6" cy="6" r="5" class="text-stone-200" stroke-width="1" />
										<path
											d="M6 1 A5 5 0 0 1 11 6"
											class="text-stone-700"
											stroke-width="1"
											stroke-linecap="round"
										/>
									</svg>
								</span>
							{:else}
								<!-- normal dot -->
								<span
									class={`relative grid h-3 w-3 place-items-center rounded-full border border-dashed border-stone-200 ${
										task.id === activeTaskId ? 'border-stone-500' : ''
									}`}
								/>
							{/if}

							<span
								class={`min-w-0 truncate font-mono text-xs tracking-tight ${
									task.id === activeTaskId ? 'text-stone-900' : 'text-stone-700'
								}`}
								title={task.title}
							>
								{task.title}
							</span>
						</div>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
