<script lang="ts">
	import Task from '$lib/components/sm/Task.svelte';

	type TasksMap = Record<string, Array<{ id: string; title: string; done: boolean }>>;

	let { tasksByMilestone = {} as TasksMap } = $props();
	let initialTasks = $derived(Object.values(tasksByMilestone ?? {}).flat());

	let open = $state(true);
	let tasks = $state(initialTasks.slice(0, 3));

	$effect(() => {
		tasks = initialTasks.slice(0, 3);
	});

	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

	function handleToggle(id: string) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
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
		<span>Today</span>
	</button>

	<div
		class={`grid overflow-hidden transition-[grid-template-rows] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
	>
		<div class="min-h-0">
			<ul class="space-y-1">
				{#each tasks as task (task.id)}
					<Task
						id={task.id}
						title={task.title}
						checked={task.done ?? false}
						active={false}
						onToggle={handleToggle}
						loading={task.loading ?? false}
					/>
				{/each}
			</ul>
		</div>
	</div>
</div>
