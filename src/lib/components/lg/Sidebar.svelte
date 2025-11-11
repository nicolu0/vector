<script lang="ts">
	import Milestones from '$lib/components/md/Milestones.svelte';
	import Today from '$lib/components/md/Today.svelte';
	import Tutorial from '$lib/components/md/Tutorial.svelte';
	import Profile from '$lib/components/md/Profile.svelte';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import { supabase } from '$lib/supabaseClient';

	type Milestone = {
		id: string;
		title: string;
		done: boolean;
		description?: string;
		ordinal?: number | null;
	};
	type Task = {
		id: string;
		title: string;
		done: boolean;
		ordinal?: number | null;
		tutorial?: boolean;
	};
	type TasksMap = Record<string, Array<Task>>;

	let {
		sidebarCollapsed = false,
		toggleSidebar,
		milestones = [],
		tasksByMilestone = {},
		currentMilestoneId = null,
		currentTaskId = null,
		tutorial = false,
		email = '',
		userId = null
	} = $props<{
		sidebarCollapsed: boolean;
		toggleSidebar: () => void;
		milestones?: Milestone[];
		tasksByMilestone?: TasksMap;
		currentMilestoneId?: string | null;
		currentTaskId?: string | null;
		tutorial?: boolean;
		email?: string;
		userId?: string | null;
	}>();

	const EXPANDED_WIDTH = 'min(21vw, 20rem)';
	const COLLAPSED_WIDTH = '0rem';
	const containerFlex = $derived(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
	const sidebarTransform = $derived(sidebarCollapsed ? 'translateX(-100%)' : 'translateX(0%)');

	type AuthUI = { signOut: () => Promise<void> };
	const { signOut } = getContext<AuthUI>('auth-ui');

	function extractMilestoneId(pathname: string): string | null {
		const m = /^\/milestone\/([^/]+)/.exec(pathname);
		return m ? m[1] : null;
	}

	function extractTaskId(pathname: string): string | null {
		const m = /^\/task\/([^/]+)/.exec(pathname);
		return m ? m[1] : null;
	}

	// Derive current route selection and keep a local, instantly-updating selection
	const routeMilestoneId = $derived<string | null>(extractMilestoneId($page.url.pathname));
	const routeTaskId = $derived<string | null>(extractTaskId($page.url.pathname));
	let selectedMilestoneId = $state<string | null>(routeMilestoneId);
	let selectedTaskId = $state<string | null>(routeTaskId);

	// When the route changes, sync the local selection
	$effect(() => {
		selectedMilestoneId = routeMilestoneId;
		selectedTaskId = routeTaskId;
	});

	function findFirstMilestoneWithTask(map = tasksByMilestone) {
		for (const milestone of milestones) {
			const tasks = map[milestone.id] ?? [];
			if (tasks.length > 0) {
				return { milestoneId: milestone.id, taskId: tasks[0].id };
			}
		}
		return {
			milestoneId: milestones[0]?.id ?? null,
			taskId: null
		};
	}

	async function resetProgress() {
		if (!userId) return;
		const allTaskIds = (Object.values(tasksByMilestone) as Task[][]).flat().map((t) => t.id);

		if (allTaskIds.length) {
			const { error: resetErr } = await supabase
				.from('tasks')
				.update({ done: false })
				.in('id', allTaskIds);
			if (resetErr) throw resetErr;
		}

		const nextTarget = findFirstMilestoneWithTask();
		const nextMilestoneId = nextTarget.milestoneId;
		const nextTaskId = nextTarget.taskId;

		const { error } = await supabase
			.from('users')
			.update({ current_milestone: nextMilestoneId, current_task: nextTaskId })
			.eq('user_id', userId);

		if (error) throw error;

		tasksByMilestone = Object.fromEntries(
			(Object.entries(tasksByMilestone) as [string, Task[]][]).map(([milestoneId, tasks]) => [
				milestoneId,
				tasks.map((task) => ({ ...task, done: false }))
			])
		) as TasksMap;

		currentMilestoneId = nextMilestoneId;
		currentTaskId = nextTaskId;
	}
</script>

<div
	class=" relative flex h-full min-w-0 flex-col overflow-hidden transition-[flex-basis] duration-200 ease-out"
	style={`flex-basis:${containerFlex};flex-grow:0;flex-shrink:0;`}
>
	<aside
		id="sidebar-nav"
		class="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-stone-200 bg-stone-100 backdrop-blur-sm transition-transform duration-200 ease-out"
		class:pointer-events-none={sidebarCollapsed}
		style:width={EXPANDED_WIDTH}
		style:transform={sidebarTransform}
		aria-hidden={sidebarCollapsed}
	>
		<div class="flex h-full min-h-0 flex-col">
			{#if !sidebarCollapsed}
				<div class="min-h-0 flex-1 overflow-y-auto">
					<div class="flex flex-col">
						<div class="flex w-full items-center justify-end gap-2 pt-10"></div>

						{#if tutorial}
							<Tutorial />
						{/if}
						<Today {tasksByMilestone} {currentMilestoneId} {currentTaskId} {userId} {milestones} />

						<Milestones
							{milestones}
							{tasksByMilestone}
							initiallyOpen={true}
							selectedId={selectedMilestoneId}
							{selectedTaskId}
							onSelect={(id) => {
								// Instant UI feedback
								selectedMilestoneId = id;
								selectedTaskId = null;
							}}
							onSelectTask={(taskId) => {
								selectedTaskId = taskId;
							}}
						/>
					</div>
				</div>
				<div class="bg-stone-100">
					<Profile
						name="User"
						{email}
						{sidebarCollapsed}
						onSignOut={signOut}
						onResetProgress={userId ? resetProgress : null}
					/>
				</div>
			{/if}
		</div>
	</aside>
</div>
