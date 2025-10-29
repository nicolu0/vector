<script lang="ts">
	import TaskView from '$lib/components/TaskView.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { onDestroy } from 'svelte';
	import type { PageData } from './$types';

	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
	};

	type TaskDetails = Omit<Task, 'id'>;

	let { data } = $props<{ data: PageData }>();

	const initialRole = data.role?.trim() ?? '';
	const initialCompany = data.company?.trim() ?? '';

	let role = $state(initialRole);
	let company = $state(initialCompany);
	let showGoalModal = $state(!initialRole);

	let tasks = $state<Task[]>([]);
	let activeTaskId = $state<string | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');
	let draftTask = $state<TaskDetails | null>(null);
	let abortController: AbortController | null = null;
	let pendingTaskId = $state<string | null>(null);

	onDestroy(() => {
		abortController?.abort();
	});

	function openTaskView(taskId: string) {
		activeTaskId = taskId;
	}

	function handleGoalSubmit(payload: { endGoal: string }) {
		endGoal = payload.endGoal;
		showGoalModal = false;

		if (!loading && tasks.length === 0) {
			Promise.resolve().then(() => {
				if (tasks.length === 0 && !loading) {
					generateNewTask().catch((err) => console.error('Failed to generate task:', err));
				}
			});
		}
	}

	const selectedTask = $derived(
		activeTaskId ? (tasks.find((task) => task.id === activeTaskId) ?? null) : null
	);

	const previousTask = $derived(tasks.length > 0 ? tasks[tasks.length - 1] : null);

	async function generateNewTask() {
		if (!endGoal.trim()) {
			errorMessage = 'Please describe the end goal before generating a task.';
			return;
		}

		if (abortController) {
			abortController.abort();
			abortController = null;
		}

		loading = true;
		errorMessage = '';
		draftTask = null;

		const payload: Record<string, unknown> = {
			endGoal,
			currentSkillLevel
		};

		if (previousTask) {
			payload.previousTask = {
				title: previousTask.title,
				description: previousTask.description,
				outcome: previousTask.outcome
			};
		}

		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
		let streamBuffer = '';
		let liveDraft: TaskDetails = {
			title: 'Creating new task...',
			description: '',
			outcome: ''
		};

		const pendingId =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const placeholder: Task = {
			id: pendingId,
			title: liveDraft.title,
			description: '',
			outcome: ''
		};

		tasks = [...tasks, placeholder];
		activeTaskId = pendingId;
		pendingTaskId = pendingId;

		const updatePendingTask = (update: Partial<TaskDetails>) => {
			if (!pendingTaskId) return;
			tasks = tasks.map((task) => (task.id === pendingTaskId ? { ...task, ...update } : task));
		};

		try {
			abortController = new AbortController();

			const response = await fetch('/api/generate-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: abortController.signal
			});

			if (!response.ok) {
				const fallbackText = await response.text();
				throw new Error(fallbackText || 'Task generation request failed.');
			}

			if (!response.body) {
				const fallbackText = await response.text();
				throw new Error(fallbackText || 'Task generation failed to start.');
			}

			reader = response.body.getReader();
			const decoder = new TextDecoder();
			let done = false;

			while (!done) {
				const { value, done: readerDone } = await reader.read();
				if (readerDone) break;

				streamBuffer += decoder.decode(value, { stream: true });

				let newlineIndex = streamBuffer.indexOf('\n');
				while (newlineIndex !== -1) {
					const line = streamBuffer.slice(0, newlineIndex).trim();
					streamBuffer = streamBuffer.slice(newlineIndex + 1);

					if (line) {
						try {
							const message = JSON.parse(line) as {
								t: string;
								k?: 'title' | 'description' | 'outcome';
								v?: unknown;
								source?: string;
							};

							switch (message.t) {
								case 'kv': {
									if (message.k === 'title') {
										const nextTitle = String(message.v ?? '').trim();
										liveDraft = {
											...liveDraft,
											title: nextTitle || 'Creating new task...'
										};
										updatePendingTask({ title: liveDraft.title });
									} else if (message.k === 'description') {
										liveDraft = {
											...liveDraft,
											description: String(message.v ?? '')
										};
										updatePendingTask({ description: liveDraft.description });
										if (liveDraft.description.trim().length > 0) {
											draftTask = { ...liveDraft };
										}
									} else if (message.k === 'outcome') {
										liveDraft = {
											...liveDraft,
											outcome: String(message.v ?? '')
										};
										updatePendingTask({ outcome: liveDraft.outcome });
										if (liveDraft.description.trim().length > 0) {
											draftTask = { ...liveDraft };
										}
									}

									break;
								}
								case 'warn':
									errorMessage = String(message.v ?? 'A warning occurred during task generation.');
									break;
								case 'error':
									errorMessage = String(message.v ?? 'Task generation failed.');
									break;
								case 'final': {
									const value = message.v as
										| { title?: string; description?: string; outcome?: string }
										| undefined;
									if (value && value.title && value.description && value.outcome) {
										const finalized: TaskDetails = {
											title: value.title,
											description: value.description,
											outcome: value.outcome
										};

										tasks = tasks.map((task) =>
											task.id === pendingId ? { ...task, ...finalized } : task
										);
										draftTask = { ...finalized };
										liveDraft = { ...finalized };
										pendingTaskId = null;
									}
									break;
								}
								case 'done':
									done = true;
									break;
							}
						} catch (err) {
							console.error('Failed to parse NDJSON line', err);
						}
					}

					if (done) break;
					newlineIndex = streamBuffer.indexOf('\n');
				}
			}
		} catch (err) {
			if ((err as Error).name === 'AbortError') {
				errorMessage = 'Task generation was cancelled.';
			} else {
				console.error(err);
				errorMessage =
					err instanceof Error ? err.message : 'Unexpected error while generating the task.';
			}
		} finally {
			if (reader) {
				try {
					await reader.cancel();
				} catch {
					// ignore
				}
				try {
					reader.releaseLock();
				} catch {
					// ignore
				}
			}

			if (pendingTaskId) {
				// Generation didn't finish — clean up placeholder
				tasks = tasks.filter((task) => task.id !== pendingTaskId);
				if (activeTaskId === pendingTaskId) {
					activeTaskId = tasks.length ? tasks[tasks.length - 1].id : null;
				}
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
	<div class="flex h-full w-full gap-8 bg-stone-50 p-6">
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
