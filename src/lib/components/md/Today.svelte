<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import Task from '$lib/components/sm/Task.svelte';
	import { supabase } from '$lib/supabaseClient';

	type Milestone = { id: string; title: string; ordinal?: number | null };
	type TaskEntry = {
		id: string;
		title: string;
		done: boolean;
		ordinal?: number | null;
		tutorial?: boolean;
	};
	type TasksMap = Record<string, TaskEntry[]>;

	let {
		tasksByMilestone = {} as TasksMap,
		milestones = [] as Milestone[],
		currentMilestoneId = null,
		currentTaskId = null,
		userId = null
	} = $props<{
		tasksByMilestone?: TasksMap;
		milestones?: Milestone[];
		currentMilestoneId?: string | null;
		currentTaskId?: string | null;
		userId?: string | null;
	}>();

	let open = $state(true);
	let taskMap = $derived(tasksByMilestone);

	const currentMilestone = $derived(
		milestones.find((m: Milestone) => m.id === currentMilestoneId) ?? null
	);
	const currentTask = $derived(getTask(currentMilestoneId, currentTaskId));

	let currentTaskDone = $state(currentTask?.done ?? false);
	$effect(() => {
		currentTaskDone = currentTask?.done ?? false;
	});

	let advancing = $state(false);

	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

	function getTask(milestoneId: string | null, taskId: string | null): TaskEntry | null {
		if (!milestoneId || !taskId) return null;
		const tasks = taskMap[milestoneId] ?? [];
		return tasks.find((task: TaskEntry) => task.id === taskId) ?? null;
	}

	function setTaskDone(milestoneId: string | null, taskId: string, done: boolean) {
		if (!milestoneId) return;
		const tasks = taskMap[milestoneId] ?? [];
		const idx = tasks.findIndex((task: TaskEntry) => task.id === taskId);
		if (idx === -1) return;
		const updated = [...tasks];
		updated[idx] = { ...updated[idx], done };
		taskMap = { ...taskMap, [milestoneId]: updated };
	}

	function handleToggle(id: string) {
		if (!currentTask || currentTask.id !== id) return;
		currentTaskDone = !currentTaskDone;
		setTaskDone(currentMilestoneId, id, currentTaskDone);
	}

	type LocatedTask = { milestoneId: string; task: TaskEntry };
	function findNextTask(milestoneId: string | null, taskId: string | null): LocatedTask | null {
		if (!milestoneId) return firstAvailableTask();
		const currentTasks = taskMap[milestoneId] ?? [];
		const currentIndex = currentTasks.findIndex((t: TaskEntry) => t.id === taskId);
		if (currentIndex !== -1 && currentIndex + 1 < currentTasks.length) {
			return { milestoneId, task: currentTasks[currentIndex + 1] };
		}

		const milestoneIndex = milestones.findIndex((m: Milestone) => m.id === milestoneId);
		for (let i = milestoneIndex + 1; i < milestones.length; i++) {
			const nextMilestone = milestones[i];
			const tasks = taskMap[nextMilestone.id] ?? [];
			if (tasks.length > 0) {
				return { milestoneId: nextMilestone.id, task: tasks[0] };
			}
		}
		return null;
	}

	function firstAvailableTask(): LocatedTask | null {
		for (const milestone of milestones) {
			const tasks = taskMap[milestone.id] ?? [];
			if (tasks.length > 0) {
				return { milestoneId: milestone.id, task: tasks[0] };
			}
		}
		return null;
	}

	async function persistCurrentSelection(
		nextMilestoneId: string | null,
		nextTaskId: string | null
	) {
		if (!browser || !userId) return;
		const { error } = await supabase
			.from('users')
			.update({ current_milestone: nextMilestoneId, current_task: nextTaskId })
			.eq('user_id', userId);
		if (error) throw error;
	}

	async function handlePersistSuccess(id: string, done: boolean) {
		if (!done || advancing) return;
		const next = findNextTask(currentMilestoneId, id);
		const nextMilestoneId = next?.milestoneId ?? null;
		const nextTaskId = next?.task?.id ?? null;

		advancing = true;
		try {
			await persistCurrentSelection(nextMilestoneId, nextTaskId);
			currentMilestoneId = nextMilestoneId;
			currentTaskId = nextTaskId;
			currentTaskDone = next?.task?.done ?? false;
		} catch (err) {
			console.error('Failed to update current task selection', err);
			setTaskDone(currentMilestoneId, id, false);
			currentTaskDone = false;
		} finally {
			advancing = false;
		}
	}
</script>

<div class="px-2 py-2">
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
			{#if currentTask}
				{#key currentTaskId}
					<div in:fly|local={{ y: 10, duration: 200 }}>
						<Task
							id={currentTask.id}
							title={currentTask.title}
							checked={currentTaskDone}
							active={false}
							onToggle={handleToggle}
							onPersistSuccess={handlePersistSuccess}
							completing={advancing}
						/>
					</div>
				{/key}
			{:else}
				<div class="px-2 py-1 text-sm text-stone-500">No current task assigned</div>
			{/if}
		</div>
	</div>
</div>
