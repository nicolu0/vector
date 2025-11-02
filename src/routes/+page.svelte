<script lang="ts">
	import TaskView from '$lib/components/lg/TaskView.svelte';
	import TaskList from '$lib/components/lg/TaskList.svelte';
	import Onboarding from '$lib/components/lg/Onboarding.svelte';
	import { getContext } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { PageData } from './$types';

	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
		isTutorial?: boolean;
	};
	type TaskDetails = Omit<Task, 'id' | 'isTutorial'>;
	type ServerUser = { id: string } | null;

	let { data } = $props<{ data: PageData & { user: ServerUser; tasks: Task[] } }>();

	const serverUserId = data.user?.id ?? null;
	const isAuthed = Boolean(serverUserId);

	let endGoal = $state((data.endGoal ?? '').trim());
	let showGoalModal = $state(!endGoal);

	let tasks = $state<Task[]>([...data.tasks]); // ← seeded from server (includes tutorial if needed)
	let activeTaskId = $state(tasks.length ? tasks[0].id : null);

	let loading = $state(false);
	let errorMessage = $state('');
	let draftTask = $state<TaskDetails | null>(null);
	let abortController: AbortController | null = null;
	let pendingTaskId: string | null = null;
	let hasPromptedAuthAfterFirstTask = false;

	type AuthUI = { openAuthModal: () => void };
	const { openAuthModal } = getContext<AuthUI>('auth-ui');

	function openTaskView(id: string) {
		activeTaskId = id;
	}

	function handleGoalSubmit(payload: { endGoal: string }) {
		endGoal = payload.endGoal.trim();
		showGoalModal = false;
		document.cookie = `vector_endGoal=${encodeURIComponent(endGoal)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
		if (!loading && tasks.filter((t) => !t.isTutorial).length === 0) {
			queueMicrotask(() => generateNewTask());
		}
	}

	const selectedTask = $derived(
		activeTaskId ? (tasks.find((t) => t.id === activeTaskId) ?? null) : null
	);
	const previousTask = $derived(tasks.filter((t) => !t.isTutorial).slice(-1)[0] ?? null);

	async function markTutorialDone() {
		document.cookie = `vector_tutorial_done=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
		if (isAuthed && serverUserId) {
			await supabase.from('users').update({ tutorial_done: true }).eq('user_id', serverUserId);
		}
		tasks = tasks.filter((t) => t.id !== 'tutorial');
		if (activeTaskId === 'tutorial') activeTaskId = tasks[0]?.id ?? null;
	}

	async function promptAuthAfterFirstTaskIfNeeded() {
		hasPromptedAuthAfterFirstTask = true;
		if (!isAuthed) openAuthModal();
	}

	async function generateNewTask() {
		// Anonymous users: limit to one non-tutorial task
		const nonTutorialCount = tasks.filter((t) => !t.isTutorial).length;
		if (!isAuthed && nonTutorialCount >= 1) {
			errorMessage = 'Sign in to create more tasks.';
			openAuthModal();
			return;
		}

		if (!endGoal.trim()) {
			errorMessage = 'Please describe the end goal before generating a task.';
			return;
		}

		abortController?.abort();
		abortController = null;
		loading = true;
		errorMessage = '';
		draftTask = null;

		const payload: Record<string, unknown> = { endGoal };
		if (previousTask)
			payload.previousTask = {
				title: previousTask.title,
				description: previousTask.description,
				outcome: previousTask.outcome
			};

		const pendingId =
			crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const placeholder: Task = {
			id: pendingId,
			title: 'Creating new task...',
			description: '',
			outcome: ''
		};

		const prevActiveId = activeTaskId;

		tasks = [...tasks, placeholder];
		pendingTaskId = pendingId;

		if (!prevActiveId) {
			activeTaskId = pendingId;
		}

		const updatePending = (u: Partial<TaskDetails>) => {
			if (!pendingTaskId) return;
			tasks = tasks.map((t) => (t.id === pendingTaskId ? ({ ...t, ...u } as Task) : t));
		};

		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
		let buf = '';
		try {
			abortController = new AbortController();
			const res = await fetch('/api/generate-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: abortController.signal
			});
			if (!res.ok) throw new Error((await res.text()) || 'Task generation failed.');
			if (!res.body) throw new Error('Task generation failed to start.');

			reader = res.body.getReader();
			const dec = new TextDecoder();
			let done = false;

			while (!done) {
				const { value, done: rd } = await reader.read();
				if (rd) break;
				buf += dec.decode(value, { stream: true });
				let i = buf.indexOf('\n');
				while (i !== -1) {
					const line = buf.slice(0, i).trim();
					buf = buf.slice(i + 1);
					if (line) {
						const msg = JSON.parse(line) as {
							t: string;
							k?: 'title' | 'description' | 'outcome';
							v?: unknown;
						};
						if (msg.t === 'kv') {
							if (msg.k === 'title')
								updatePending({ title: String(msg.v ?? '').trim() || 'Creating new task...' });
							if (msg.k === 'description') updatePending({ description: String(msg.v ?? '') });
							if (msg.k === 'outcome') updatePending({ outcome: String(msg.v ?? '') });
						} else if (msg.t === 'final') {
							const v = msg.v as TaskDetails | undefined;
							if (v?.title && v?.description && v?.outcome) {
								// cookie for server upsert
								document.cookie = `vector_task=${encodeURIComponent(JSON.stringify(v))}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
								tasks = tasks.map((t) => (t.id === pendingId ? { ...t, ...v } : t));
								draftTask = { ...v };
								pendingTaskId = null;

								if (
									!hasPromptedAuthAfterFirstTask &&
									tasks.filter((t) => !t.isTutorial).length === 1
								) {
									await Promise.resolve();
									await promptAuthAfterFirstTaskIfNeeded();
								}
							}
						} else if (msg.t === 'done') {
							done = true;
						}
					}
					i = buf.indexOf('\n');
				}
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Unexpected error while generating the task.';
		} finally {
			if (reader) {
				try {
					await reader.cancel();
				} catch {}
				try {
					reader.releaseLock();
				} catch {}
			}
			if (pendingTaskId) {
				tasks = tasks.filter((t) => t.id !== pendingTaskId);
				if (activeTaskId === pendingTaskId)
					activeTaskId = tasks.find((t) => !t.isTutorial)?.id ?? tasks[0]?.id ?? null;
				pendingTaskId = null;
			}
			draftTask = null;
			loading = false;
			abortController = null;
		}
	}
</script>

{#if showGoalModal}
	<div class="flex h-full w-full items-center justify-center bg-stone-50 p-6">
		<Onboarding initialEndGoal={endGoal} onSubmit={handleGoalSubmit} />
	</div>
{:else}
	<div class="flex h-full w-full gap-8 bg-stone-50">
		<TaskList
			{tasks}
			{activeTaskId}
			onSelect={openTaskView}
			onCreateTask={generateNewTask}
			creating={loading}
		/>
		<TaskView
			task={selectedTask ?? undefined}
			draftTask={draftTask ?? undefined}
			{loading}
			{errorMessage}
		/>
	</div>
{/if}
