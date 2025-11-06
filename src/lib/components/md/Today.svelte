<script lang="ts">
	import Task from '$lib/components/sm/Task.svelte';

	type TodayTask = {
		id: string;
		title: string;
		checked: boolean;
	};

	const initialTasks: TodayTask[] = [
		{ id: 'review-daily-plan', title: 'Review the daily plan', checked: false },
		{ id: 'prepare-standup', title: 'Prepare notes for standup', checked: false },
		{ id: 'ship-feature', title: 'Ship the top priority feature', checked: false }
	];

	let open = $state(true);
	let tasks = $state(initialTasks);

	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

	function handleToggle(id: string) {
		tasks = tasks.map((task) =>
			task.id === id ? { ...task, checked: !task.checked } : task
		);
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
						checked={task.checked}
						active={false}
						onToggle={handleToggle}
					/>
				{/each}
			</ul>
		</div>
	</div>
</div>
