<script lang="ts">
	import vectorUrl from '$lib/assets/vector.svg?url';
	import { browser } from '$app/environment';
	import Landing from '$lib/components/lg/Landing.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';
	import ProjectView from '$lib/components/lg/Project.svelte';
	import MilestoneView from '$lib/components/lg/Milestone.svelte';
	import TaskView from '$lib/components/lg/Task.svelte';
	import { VIEWER_CONTEXT_KEY, type ViewerContext, type ViewSelection } from '$lib/stores/viewer';
	import {
		tasksByMilestoneStore,
		setTaskDoneInStore,
		milestoneStatusStore,
		type TasksMap
	} from '$lib/stores/tasks';

	let { data }: PageProps = $props();

	const serverUserId = data.user?.id ?? null;
	let userId = $state(serverUserId);
	let project = $state(data?.project ?? null);
	let milestones = $state(data?.milestones ?? []);
	let tasks = $state(data?.tasks ?? []);
	let tasksByMilestone = $state<TasksMap>({});
	let todosByTask = $state(data?.todosByTask ?? {});
	let selection = $state<ViewSelection>({ type: 'project' });
	let lastMilestoneDone: Record<string, boolean> = {};

	type AuthUI = {
		openAuthModal: () => void;
		signInWithGoogle: (redirectPath?: string) => Promise<void>;
	};

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

	const unsubMilestoneStatus = milestoneStatusStore.subscribe(async (statusMap) => {
		for (const [milestoneId, { done, status }] of Object.entries(statusMap)) {
			if (lastMilestoneDone[milestoneId] === done) continue;

			lastMilestoneDone[milestoneId] = done;

			const { error } = await supabase
				.from('milestones')
				.update({ done, status })
				.eq('id', milestoneId);
			if (error) {
				console.error('Failed to update milestone.done', milestoneId, error.message);
			}
		}
	});
	onDestroy(unsubMilestoneStatus);

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
	let demo = $state(false);
</script>

{#if userId}
	<div class="flex w-full min-w-0 flex-col pr-4 pb-5 pl-5">
		<section class="bg-stone-50">
			{#if selection.type === 'milestone' && selectedMilestone}
				<MilestoneView milestone={selectedMilestone} />
			{:else if selection.type === 'task' && selectedTask}
				<TaskView task={selectedTask} todos={selectedTodos ?? []} {setTaskDone} />
			{:else}
				<ProjectView {project} {milestones} />
			{/if}
		</section>
	</div>
{:else}
	<button
		type="button"
		onclick={() => {
			openAuthModal();
		}}
		class="fixed top-3 left-3 z-[999] flex items-center gap-2 rounded-md px-1 py-1 text-stone-700 transition opacity-80 hover:opacity-90 hover:bg-stone-200 hover:text-stone-900 duration-200 ease-out focus:outline-none select-none"
		aria-label="Go to home"
	>
		<img src={vectorUrl} alt="vector" class="h-5 w-5" />
	</button>
	<Landing />
{/if}
