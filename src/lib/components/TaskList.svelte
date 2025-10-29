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

	let {
		tasks,
		activeTaskId = null,
		onSelect,
		onCreateTask,
		creating = false
	}: Props = $props();

	function handleSelect(taskId: string) {
		onSelect(taskId);
	}
</script>

<div class="flex h-full w-full flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold text-stone-900">Task List</h1>
			<p class="text-xs uppercase tracking-[0.15em] text-stone-400">Daily todo</p>
		</div>
		<button
			type="button"
			class="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
			onclick={onCreateTask}
			disabled={creating}
		>
			{creating ? 'Generating…' : 'Generate New Task'}
		</button>
	</div>

	{#if tasks.length === 0}
		<p class="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
			No tasks yet. Generate a task to get started.
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each tasks as task (task.id)}
				<li>
					<button
						type="button"
						class={`w-full rounded-lg border px-4 py-3 text-left transition ${
							task.id === activeTaskId
								? 'border-stone-400 bg-stone-900 text-white'
								: 'border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50'
						}`}
						onclick={() => handleSelect(task.id)}
					>
						<div class="text-sm font-semibold">{task.title}</div>
						<p
							class={`mt-1 text-xs ${
								task.id === activeTaskId ? 'text-stone-200' : 'text-stone-500'
							} overflow-hidden text-ellipsis`}
							style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
						>
							{task.description}
						</p>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
