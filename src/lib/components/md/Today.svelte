<script lang="ts">
	import { fly } from 'svelte/transition';
	import Task from '$lib/components/sm/Task.svelte';
	import { getContext } from 'svelte';
	import { VIEWER_CONTEXT_KEY, type ViewerContext } from '$lib/stores/viewer';
	import { APP_MODE_CONTEXT_KEY, type AppModeContext } from '$lib/context/appMode';
	import { currentTaskOverrideStore } from '$lib/stores/currentTask';

	type Milestone = { id: string; title: string; ordinal?: number | null };
	type TaskEntry = {
		id: string;
		title: string;
		done: boolean;
		ordinal?: number | null;
		tutorial?: boolean;
	} & Record<string, unknown>;
	type TasksMap = Record<string, TaskEntry[]>;
	type CurrentTaskDetail = {
		project_id: string | null;
		project_title: string | null;
		milestone_id: string | null;
		milestone_title: string | null;
		task_id: string | null;
		task_title: string | null;
		task_done: boolean;
	} | null;

	let {
		tasksByMilestone = {} as TasksMap,
		milestones = [] as Milestone[],
		currentMilestoneId: initialMilestoneId = null,
		currentTaskId: initialTaskId = null,
		profileProjectId: profileProjectIdProp = null,
		currentTaskDetail: currentTaskDetailProp = null,
		onSelectTask = null,
		onSelectProject = null
	} = $props<{
		tasksByMilestone?: TasksMap;
		milestones?: Milestone[];
		currentMilestoneId?: string | null;
		currentTaskId?: string | null;
		profileProjectId?: string | null;
		currentTaskDetail?: CurrentTaskDetail;
		onSelectTask?: ((taskId: string) => void) | null;
		onSelectProject?: ((id: string) => Promise<void> | void) | null;
	}>();

	const { selectMilestone } = getContext<ViewerContext>(VIEWER_CONTEXT_KEY);
	const appMode = getContext<AppModeContext>(APP_MODE_CONTEXT_KEY) ?? { isDemo: false };
	const isDemo = appMode.isDemo;

	let open = $state(true);
	let taskMap = $derived(tasksByMilestone);

	let currentMilestoneId = $state<string | null>(initialMilestoneId);
	let currentTaskId = $state<string | null>(initialTaskId);
	let profileProjectId = $state<string | null>(profileProjectIdProp ?? null);
	let currentTaskDetail = $state<CurrentTaskDetail>(currentTaskDetailProp ?? null);
	let overrideState = $state<{ status: 'idle' | 'generating' }>({ status: 'idle' });

	$effect(() => {
		currentMilestoneId = initialMilestoneId;
		currentTaskId = initialTaskId;
		profileProjectId = profileProjectIdProp ?? null;
		currentTaskDetail = currentTaskDetailProp ?? null;
	});

	$effect(() => {
		const unsub = currentTaskOverrideStore.subscribe((value) => {
			overrideState = value;
		});
		return () => {
			unsub();
		};
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
	let currentTaskDone = $state(currentTask?.done ?? false);
	$effect(() => {
		currentTaskDone = currentTask?.done ?? false;
	});

	const taskKey = $derived(`${currentMilestoneId ?? ''}:${currentTaskId ?? ''}`);

	async function handleSelectCurrentTask() {
		const targetTaskId = currentTaskId ?? currentTaskDetail?.task_id ?? null;
		if (!targetTaskId) return;
		const targetProjectId = profileProjectId ?? currentTaskDetail?.project_id ?? null;
		if (targetProjectId && onSelectProject) {
			await onSelectProject(targetProjectId);
		}
		const targetMilestoneId = currentMilestoneId ?? currentTaskDetail?.milestone_id ?? null;
		if (targetMilestoneId) {
			selectMilestone(targetMilestoneId);
		}
		onSelectTask?.(targetTaskId);
	}
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
				{#key taskKey}
					<div in:fly|local={{ y: 10, duration: 200 }}>
						<Task
							id={currentTask.id}
							title={currentTask.title}
							checked={currentTaskDone}
							active={false}
							onToggle={() => {}}
							onSelect={handleSelectCurrentTask}
						/>
					</div>
				{/key}
			{:else if overrideState.status === 'generating'}
				<div class="group max-w-full min-w-0">
					<div
						class="flex w-full max-w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-1 py-1 text-left"
					>
						<div
							class="relative ml-3 grid h-3 w-3 place-items-center rounded-full text-stone-500"
							aria-hidden="true"
						>
							<svg
								viewBox="0 0 24 24"
								class="h-3 w-3 animate-spin"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
								<path d="M21 12a9 9 0 0 1-9 9" stroke-linecap="round" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<div class="min-w-0 truncate text-sm font-medium text-stone-700">
								Generating next task…
							</div>
						</div>
					</div>
				</div>
			{:else if currentTaskDetail?.task_id}
				<div in:fly|local={{ y: 10, duration: 200 }}>
					<Task
						id={currentTaskDetail.task_id}
						title={currentTaskDetail.task_title ?? 'Current task'}
						checked={currentTaskDetail.task_done}
						active={false}
						onToggle={() => {}}
						onSelect={handleSelectCurrentTask}
					/>
				</div>
			{:else}
				<div class="px-2 py-1 text-sm text-stone-500">No current task assigned</div>
			{/if}
		</div>
	</div>
</div>
