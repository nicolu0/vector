<script lang="ts">
	import { browser } from '$app/environment';
	import Landing from '$lib/components/lg/Landing.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';
	import ProjectView from '$lib/components/lg/Project.svelte';
	import MilestoneView from '$lib/components/lg/Milestone.svelte';
	import TaskView from '$lib/components/lg/Task.svelte';
	import { VIEWER_CONTEXT_KEY, type ViewerContext, type ViewSelection } from '$lib/stores/viewer';
	import { tasksByMilestoneStore, setTaskDoneInStore, type TasksMap } from '$lib/stores/tasks';

	let { data }: PageProps = $props();

const serverUserId = data.user?.id ?? null;
let userId = $state(serverUserId);
let project = $state(data?.project ?? null);
let milestones = $state(data?.milestones ?? []);
let tasks = $state(data?.tasks ?? []);
let tasksByMilestone = $state<TasksMap>({});
let todosByTask = $state(data?.todosByTask ?? {});
let selection = $state<ViewSelection>({ type: 'project' });

type AuthUI = { openAuthModal: () => void };
const { openAuthModal } = getContext<AuthUI>('auth-ui');
const viewer = getContext<ViewerContext>(VIEWER_CONTEXT_KEY);
const selectionUnsubscribe = viewer.selection.subscribe((value) => {
	selection = value;
});

$effect(() => {
    if (data?.tasksByMilestone) {
        tasksByMilestone = data.tasksByMilestone;
    }
});

const unsubTasks = tasksByMilestoneStore.subscribe((v) => {
    tasksByMilestone = v;
});
onDestroy(unsubTasks);

	if (browser) {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			userId = session?.user?.id ?? null;
		});
		onDestroy(() => {
			subscription?.unsubscribe();
		});
	}

	$effect(() => {
		userId = data.user?.id ?? null;
		project = data?.project ?? null;
		milestones = data?.milestones ?? [];
		tasks = data?.tasks ?? [];
	});

onDestroy(selectionUnsubscribe);

const selectedMilestone = $derived.by(() => {
	const currentSelection = selection as ViewSelection;
	if (currentSelection.type === 'milestone') {
		return milestones.find((m) => m.id === currentSelection.id) ?? null;
	}
	if (currentSelection.type === 'task') {
		const task = tasks.find((t) => t.id === currentSelection.id);
		if (!task) return null;
		return milestones.find((m) => m.id === task.milestone_id) ?? null;
	}
	return null;
});

const selectedTask = $derived.by(() => {
	const currentSelection = selection as ViewSelection;
	if (currentSelection.type === 'task') {
		return tasks.find((t) => t.id === currentSelection.id) ?? null;
	}
	return null;
});

const selectedTodos = $derived.by(() => {
    const currentSelection = selection as ViewSelection;
    if (currentSelection.type === 'task') {
        return todosByTask[currentSelection.id] ?? [];
    }
    return [];
});

function setTaskDone(milestoneId: string, taskId: string, done: boolean) {
    setTaskDoneInStore(milestoneId, taskId, done);
}

</script>

<div class="scroll-y flex h-full w-full min-w-0 flex-col overflow-auto pr-3 pb-5 pl-5">
	{#if userId}
		<section class="bg-stone-50">
			{#if selection.type === 'milestone' && selectedMilestone}
				<MilestoneView milestone={selectedMilestone} />
			{:else if selection.type === 'task' && selectedTask}
				<TaskView task={selectedTask} todos={selectedTodos ?? []} setTaskDone={setTaskDone} />
			{:else}
				<ProjectView {project} {milestones} />
			{/if}
		</section>
	{:else}
		<Landing onSubmit={openAuthModal} />
	{/if}
</div>
