<script lang="ts">
	import Milestones from '$lib/components/md/Milestones.svelte';
	import Today from '$lib/components/md/Today.svelte';
	import Tutorial from '$lib/components/md/Tutorial.svelte';
	import Profile from '$lib/components/md/Profile.svelte';
	import { getContext } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { tasksByMilestoneStore, type TasksMap, type MilestoneStatus } from '$lib/stores/tasks';
	import { get } from 'svelte/store';
	import { todosByTaskStore } from '$lib/stores/todos';

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

	let {
		sidebarCollapsed = false,
		toggleSidebar,
		milestones = [],
		currentMilestoneId = null,
		currentTaskId = null,
		tutorial = false,
		email = '',
		userId = null,
		selectedMilestoneId: selectedMilestoneIdProp = null,
		selectedTaskId: selectedTaskIdProp = null,
		onSelectMilestone = null,
		onSelectTask = null
	} = $props<{
		sidebarCollapsed: boolean;
		toggleSidebar: () => void;
		milestones?: Milestone[];
		currentMilestoneId?: string | null;
		currentTaskId?: string | null;
		tutorial?: boolean;
		email?: string;
		userId?: string | null;
		selectedMilestoneId?: string | null;
		selectedTaskId?: string | null;
		onSelectMilestone?: ((id: string) => void) | null;
		onSelectTask?: ((id: string) => void) | null;
	}>();

	const EXPANDED_WIDTH = 'min(21vw, 20rem)';
	const COLLAPSED_WIDTH = '0rem';
	const containerFlex = $derived(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
	const sidebarTransform = $derived(sidebarCollapsed ? 'translateX(-100%)' : 'translateX(0%)');

	type AuthUI = { signOut: () => Promise<void> };
	const { signOut } = getContext<AuthUI>('auth-ui');

	let selectedMilestoneId = $state<string | null>(selectedMilestoneIdProp);
	let selectedTaskId = $state<string | null>(selectedTaskIdProp);

	let tasksByMilestone = $state(get(tasksByMilestoneStore));
	$inspect(tasksByMilestone);
	let todosByTask = $state(get(todosByTaskStore));
	$effect(() => {
		const unsubA = tasksByMilestoneStore.subscribe((v) => {
			tasksByMilestone = v;
		});
		const unsubB = todosByTaskStore.subscribe((v) => {
			todosByTask = v;
		});
		return () => {
			unsubA();
			unsubB();
		};
	});

	$effect(() => {
		selectedMilestoneId = selectedMilestoneIdProp;
		selectedTaskId = selectedTaskIdProp;
	});

	function getMilestoneStatus(milestoneId: string) {
		const tasks = tasksByMilestone[milestoneId] ?? [];
		if (tasks.length === 0) return 'not_started';

		let anyTodoDone = false;
		let allTodosDoneInTask = true;

		for (const t of tasks) {
			const todos = todosByTask[t.id] ?? [];
			if (todos.length === 0) {
				if (!t.done) allTodosDoneInTask = false;
				if (t.done) anyTodoDone = true;
				continue;
			}

			const taskAny = todos.some((t) => t.done);
			const taskAll = todos.every((t) => t.done);

			if (taskAny) anyTodoDone = true;
			if (!taskAll) allTodosDoneInTask = false;
		}

		if (allTodosDoneInTask) return 'complete';
		if (anyTodoDone) return 'in_progress';
		return 'not_started';
	}

	const milestoneStatus = $derived.by<Record<string, MilestoneStatus>>(() => {
		const out: Record<string, MilestoneStatus> = {};
		for (const m of milestones) out[m.id] = getMilestoneStatus(m.id);
		return out;
	});

	function handleMilestoneSelect(id: string) {
		selectedMilestoneId = id;
		selectedTaskId = null;
		onSelectMilestone?.(id);
	}

	function handleTaskSelect(taskId: string) {
		selectedTaskId = taskId;
		onSelectTask?.(taskId);
	}

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

    let headerHeight = 48;
    let scrollContainer = $state<HTMLElement | null>(null);
    let thumbTop = $state(0);
    let thumbHeight = $state(0);
    let isScrolling = $state(false);
    let scrollHideTimeout: ReturnType<typeof setTimeout> | null = null;

    function updateThumb() {
        const el = scrollContainer;
        if (!el) return;

        const view = el.clientHeight;
        const content = el.scrollHeight;

        if (content <= view) {
            thumbTop = 0;
            thumbHeight = 0;
            return;
        }

        const ratio = view / content;
        const minThumb = 32;
        thumbHeight = Math.max(minThumb, view * ratio);

        const maxThumbTop = view - thumbHeight;
        const scrollRatio = el.scrollTop / (content - view);
        thumbTop = maxThumbTop * scrollRatio;
    }

    function handleScroll() {
        updateThumb();
        isScrolling = true;
        
        if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
        scrollHideTimeout = setTimeout(() => {
            isScrolling = false;
        }, 500);
    }

    $effect(() => {
        const el = scrollContainer;
        if (!el) return;

        queueMicrotask(() => {
            updateThumb();
        });
    });
</script>

<div
	class="relative flex h-full min-w-0 flex-col overflow-hidden transition-[flex-basis] duration-200 ease-out"
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
        <div 
            class="z-[100] pointer-events-none absolute inset-y-0 left-0 right-[1px] top-0 h-12 bg-stone-100"
            aria-hidden="true"
        />

		<div 
            class={`flex h-full min-h-0 min-w-0 flex-col transition-opacity duration-200 ease-out ${
                sidebarCollapsed ? 'opacity-0' : 'opacity-100'
            }`}
        >
            <div class="absolute inset-x-0 top-0 bottom-0">
                <div class="flex h-full flex-col">
                    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-hide" bind:this={scrollContainer} onscroll={handleScroll}>
                        <div class="flex min-w-0 flex-col">
                            <div class="flex w-full items-center justify-end gap-2 pt-10"></div>

                            <Today
                                {tasksByMilestone}
                                {currentMilestoneId}
                                {currentTaskId}
                                {userId}
                                {milestones}
                                onSelectTask={handleTaskSelect}
                            />

                            <Milestones
                                {milestones}
                                {tasksByMilestone}
                                initiallyOpen={true}
                                selectedId={selectedMilestoneId}
                                {selectedTaskId}
                                onSelect={handleMilestoneSelect}
                                onSelectTask={handleTaskSelect}
                                {milestoneStatus}
                            />
                        </div>
                    </div>

                    {#if thumbHeight > 0}
                        <div
                            class="absolute right-0 w-1 bg-stone-400/80 transition-opacity duration-150 pointer-events-none"
                            style:top={`${thumbTop + headerHeight}px`}
                            style:height={`${thumbHeight - headerHeight}px`}
                            style:opacity={isScrolling ? 1 : 0}
                        />
                    {/if}
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
		</div>
	</aside>
</div>
