<script lang="ts">
	import Task from '$lib/components/sm/Task.svelte';
	import { getContext } from 'svelte';

	type TodayTask = {
		id: string;
		title: string;
		checked: boolean;
		loading?: boolean;
	};

	let { tasksByMilestone = {} } = $props();
	let initialTasks = $derived(Object.values(tasksByMilestone ?? {}).flat());

	let open = $state(true);
	let tasks = $derived(initialTasks);

	function handleToggle(id: string) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, checked: !task.checked } : task));
	}
	type GeneratedApiTask = { id: string; title: string };
	type Generate = { generateTask: () => Promise<GeneratedApiTask> };
	const { generateTask } = getContext<Generate>('generate-task');

	async function handleGenerateClick() {
		const placeholderId = `generating-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const placeholder: TodayTask = {
			id: placeholderId,
			title: 'Generating task…',
			checked: false,
			loading: true
		};
		tasks = [...tasks, placeholder];

		try {
			const next = await generateTask();
			tasks = tasks.map((task) =>
				task.id === placeholderId ? { id: next.id, title: next.title, checked: false } : task
			);
		} catch (err) {
			console.error('Failed to generate task', err);
			tasks = tasks.filter((task) => task.id !== placeholderId);
		}
	}
</script>

<div class="space-y-1 px-2 py-2">
	<button
		type="button"
		onclick={handleGenerateClick}
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
						loading={task.loading ?? false}
					/>
				{/each}
			</ul>
		</div>
	</div>
</div>
