<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import Task from '$lib/components/sm/Task.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext } from 'svelte';
	import { VIEWER_CONTEXT_KEY, type ViewerContext, type ViewSelection } from '$lib/stores/viewer';
	import { APP_MODE_CONTEXT_KEY, type AppModeContext } from '$lib/context/appMode';

	type Milestone = { id: string; title: string; ordinal?: number | null };
	type TaskEntry = {
		id: string;
		title: string;
		done: boolean;
		ordinal?: number | null;
		tutorial?: boolean;
	} & Record<string, unknown>;
	type TasksMap = Record<string, TaskEntry[]>;

	let {
		tasksByMilestone = {} as TasksMap,
		milestones = [] as Milestone[],
		currentMilestoneId: initialMilestoneId = null,
		currentTaskId: initialTaskId = null,
		userId = null,
		onSelectTask = null
	} = $props<{
		tasksByMilestone?: TasksMap;
		milestones?: Milestone[];
		currentMilestoneId?: string | null;
		currentTaskId?: string | null;
		userId?: string | null;
		onSelectTask?: ((taskId: string) => void) | null;
	}>();

	const { selectMilestone, selectTask } = getContext<ViewerContext>(VIEWER_CONTEXT_KEY);
	const appMode = getContext<AppModeContext>(APP_MODE_CONTEXT_KEY) ?? { isDemo: false };
	const isDemo = appMode.isDemo;

	let open = $state(true);
	let taskMap = $derived(tasksByMilestone);

	let currentMilestoneId = $state<string | null>(initialMilestoneId);
	let currentTaskId = $state<string | null>(initialTaskId);

	$inspect(`currentMilestoneId: ${currentMilestoneId}`);
	$inspect(`currentTaskId: ${currentTaskId}`);

	$effect(() => {
		if (currentMilestoneId == null && initialMilestoneId != null) {
			currentMilestoneId = initialMilestoneId;
		}
		if (currentTaskId == null && initialTaskId != null) {
			currentTaskId = initialTaskId;
		}
	});

	function toggle(e: MouseEvent) {
		e.preventDefault();
		open = !open;
	}

	function getTask(milestoneId: string | null, taskId: string | null): TaskEntry | null {
		if (!milestoneId || !taskId) return null;
		const tasks = taskMap[milestoneId] ?? [];
		return tasks.find((task: TaskEntry) => task.id === taskId) ?? null;
	}

	const currentTask = $derived(getTask(currentMilestoneId, currentTaskId));
	// $inspect(currentTask);
	let currentTaskDone = $state(currentTask?.done ?? false);
	$effect(() => {
		currentTaskDone = currentTask?.done ?? false;
	});

	const taskKey = $derived(`${currentMilestoneId ?? ''}:${currentTaskId ?? ''}`);

	function firstAvailableTask(): LocatedTask | null {
		for (const milestone of milestones) {
			const tasks = taskMap[milestone.id] ?? [];
			if (tasks.length > 0) {
				return { milestoneId: milestone.id, task: tasks[0] };
			}
		}
		return null;
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

	async function persistCurrentSelection(
		nextMilestoneId: string | null,
		nextTaskId: string | null
	) {
		if (!browser || !userId || isDemo) return;
		const { error } = await supabase
			.from('users')
			.update({ current_milestone: nextMilestoneId, current_task: nextTaskId })
			.eq('user_id', userId);
		if (error) throw error;
	}

	let prevDone = $state(currentTaskDone);
	$effect(() => {
		const now = currentTask?.done ?? false;

		if (prevDone === false && now === true && currentTask && currentTask.id === currentTaskId) {
			const next = findNextTask(currentMilestoneId, currentTaskId);
			const nextMilestoneId = next?.milestoneId ?? null;
			const nextTaskId = next?.task?.id ?? null;

			currentMilestoneId = nextMilestoneId;
			currentTaskId = nextTaskId;

			if (nextMilestoneId) selectMilestone(nextMilestoneId);
			if (nextTaskId) selectTask(nextTaskId);

			void (async () => {
				try {
					await persistCurrentSelection(nextMilestoneId, nextTaskId);
				} catch (err) {
					console.error('Failed to update current task selection', err);
				}
			})();
		}
		prevDone = now;
	});
</script>

<div class="w-full min-w-0 overflow-x-hidden px-2 py-2">
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
							onToggle={() => {}}
							onSelect={onSelectTask ? () => onSelectTask(currentTask.id) : null}
						/>
					</div>
				{/key}
			{:else}
				<div class="px-2 py-1 text-sm text-stone-500">No current task assigned</div>
			{/if}
		</div>
	</div>
</div>
