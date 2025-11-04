<script lang="ts">
	import AuthModal from '$lib/components/lg/AuthModal.svelte';
	import { browser } from '$app/environment';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import Sidebar from '$lib/components/lg/Sidebar.svelte';
	import { fade, scale } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';
	import Chat from '$lib/components/lg/Chat.svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { setContext } from 'svelte';
	import type { LayoutProps } from './$types';

	let authOpen = $state(false);
	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
		isTutorial?: boolean;
	};

	type TaskDetails = Omit<Task, 'id' | 'isTutorial'>;

    type InitProjectResponse = {
        project: { id: string; title: string; description: string; domain: 'research' | 'internship' };
        milestones: Array<{ id: string; ordinal: number; title: string; summary: string }>;
    }

	const tutorialTasks: Task[] = [
		{
			id: 'tutorial-01',
			title: 'What this page does',
			description: 'Overview of Chat + Sidebar.',
			outcome: 'You can navigate tasks and resize panels.',
			isTutorial: true
		},
		{
			id: 'tutorial-02',
			title: 'Create your first task',
			description: 'Click “Generate task” to scaffold a milestone.',
			outcome: 'You have one concrete next action.',
			isTutorial: true
		},
		{
			id: 'tutorial-03',
			title: 'Use the Chat assistant',
			description: 'Ask clarifying questions and request code/help.',
			outcome: 'You know how to iterate with AI in context.',
			isTutorial: true
		},
		{
			id: 'tutorial-04',
			title: 'Mark tutorial done',
			description: 'Mark the tutorial complete to hide it.',
			outcome: 'Tutorial section disappears.',
			isTutorial: true
		}
	];

	let { data, children }: LayoutProps = $props();

	let goal = $state(data.goal ?? '');
	let userId = $state(data.user?.id ?? null);
	let tasks = $state<Task[]>([...data.tasks]);
	const initialActiveId = tutorialTasks[0]?.id ?? tasks[0]?.id ?? null;
	let activeTaskId = $state(initialActiveId);
	let loading = $state(false);
	let draftTask = $state<TaskDetails | null>(null);
	let errorMessage = $state('');
	let autoGenerateTask = $state<boolean>(
		(data as Record<string, unknown>).autoGenerateTask === true
	);

	let pendingTaskId: string | null = null;
	let hasPromptedAuthAfterFirstTask = false;

	const isAuthed = $derived(Boolean(userId));

    let project = $state<InitProjectResponse['project'] | null>(null);
    let milestones = $state<InitProjectResponse['milestones']>([]);
    let initLoading = $state(false);
    let projectInitialized = $state(false);

	type AuthUI = {
		openAuthModal: () => void;
		signInWithGoogle: (redirectPath?: string) => Promise<void>;
		signOut: () => Promise<void>;
	};

	function openAuthModal() {
		authOpen = true;
	}
	function closeAuthModal() {
		authOpen = false;
	}

	async function signInWithGoogle() {
		try {
			const redirectTo = browser ? `${window.location.origin}/` : undefined;
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo,
					queryParams: { prompt: 'select_account' }
				}
			});
			if (error) throw error;
		} catch (err) {}
	}

	$effect(() => {
		userId = data.user?.id ?? null;
		goal = data.goal ?? '';
		autoGenerateTask = (data as Record<string, unknown>).autoGenerateTask === true;
	});

	async function signOut() {
		await supabase.auth.signOut();
		userId = null;
		await goto('/');
	}

	function pendingNonTutorialCount() {
		return tasks.filter((t) => !t.isTutorial).length;
	}

	async function generateNewTask() {
		if (!browser) return;

		loading = true;
		errorMessage = '';
		draftTask = null;

		const payload: Record<string, unknown> = { endGoal: goal };
		const previousTask = tasks.filter((t) => !t.isTutorial).at(-1);
		if (previousTask) {
			payload.previousTask = {
				title: previousTask.title,
				description: previousTask.description,
				outcome: previousTask.outcome
			};
		}

		try {
			const res = await fetch('/api/generate-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw new Error(await res.text());

			const { task } = (await res.json()) as { task: Task };
			// Append and focus the new task
			tasks = [...tasks, task];
			activeTaskId = task.id;

			// await goto(`/project/${task.id}`);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to generate task.';
		} finally {
			loading = false;
		}
	}

    async function initializeProject() {
        if (!browser) return;
        if (!isAuthed) return;
        if (!goal || goal.trim().length === 0) return;
        if (projectInitialized) return;

        initLoading = true;
        errorMessage = '';

        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            
            const res = await fetch('/api/initialize-project', {
                method: 'POST',
                headers,
                body: JSON.stringify({ goal })
            });
            if (!res.ok) throw new Error(await res.text());

            const data = (await res.json()) as InitProjectResponse;
            project = data.project;
            milestones = data.milestones ?? [];
            projectInitialized = true;
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : 'Failed to initialize project.';
        } finally {
            initLoading = false;
        }
    }

	if (browser) {
        $effect(() => {
            if (isAuthed && !initLoading && !projectInitialized && goal.trim().length > 0) {
                void initializeProject();
            }
        });

		// $effect(() => {
		// 	if (
		// 		autoGenerateTask &&
		// 		!loading &&
		// 		goal.trim().length > 0 &&
		// 		pendingNonTutorialCount() === 0 &&
		// 		!pendingTaskId
		// 	) {
		// 		autoGenerateTask = false;
		// 		void generateNewTask();
		// 	}
		// });
	}

	const authApi: AuthUI = { openAuthModal, signInWithGoogle, signOut };
	setContext<AuthUI>('auth-ui', authApi);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh w-full bg-stone-50 text-stone-900">
	{#if userId}
		<Sidebar {tasks} {activeTaskId} creating={loading} {tutorialTasks} />
	{:else}
		<button
			class="fixed top-2 left-2 items-center gap-2 rounded-lg p-2 hover:bg-stone-100"
			onclick={openAuthModal}
			aria-label="Go to home"
		>
			<img src={vectorUrl} alt="vector" class="h-6 w-6" />
		</button>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col">
		<main class="min-h-0 flex-1 overflow-hidden bg-white">
            {#if userId && project}
				<section class="border-b border-stone-200 bg-stone-50/60">
					<div class="mx-auto max-w-5xl px-4 py-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0">
								<div class="text-xs uppercase tracking-wide text-stone-500">Project</div>
								<h2 class="truncate text-lg font-semibold text-stone-900">{project.title}</h2>
								<p class="mt-1 line-clamp-3 text-sm text-stone-700">{project.description}</p>
								<div class="mt-2 inline-flex items-center gap-2 rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-700">
									<span class="font-medium">{project.domain}</span>
								</div>
							</div>
							<div class="shrink-0">
								{#if initLoading}
									<div class="text-xs text-stone-500">Initializing…</div>
								{:else}
									<button
										class="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
										onclick={() => void initializeProject()}
									>
										Refresh plan
									</button>
								{/if}
							</div>
						</div>

						{#if milestones.length > 0}
							<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each milestones as m}
									<div class="rounded-xl border border-stone-200 bg-white p-3">
										<div class="flex items-center justify-between">
											<span class="text-xs font-semibold text-stone-500">Milestone {m.ordinal}</span>
										</div>
										<div class="mt-1 truncate text-sm font-semibold text-stone-900">{m.title}</div>
										<p class="mt-1 line-clamp-3 text-sm text-stone-700">{m.summary}</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			{/if}
			{@render children()}
		</main>
	</div>
	{#if userId}
		<Chat />
	{/if}

	<AuthModal open={authOpen} onClose={closeAuthModal} {signInWithGoogle} />
</div>
