<script lang="ts">
	import TaskView from '$lib/components/TaskView.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import GoalSetupModal from '$lib/components/GoalSetupModal.svelte';
	import { onDestroy } from 'svelte';
	import type { PageData } from './$types';

	type Task = {
		id: string;
		title: string;
		description: string;
		outcome: string;
	};

	let { data } = $props<{ data: PageData }>();

	const initialEndGoal = data.endGoal?.trim() ?? '';
	const initialCurrentSkillLevel = data.currentSkillLevel?.trim() ?? '';

	let endGoal = $state(initialEndGoal);
	let currentSkillLevel = $state(initialCurrentSkillLevel);
	let showGoalModal = $state(!(initialEndGoal && initialCurrentSkillLevel));

	let tasks = $state<Task[]>([]);
	let activeTaskId = $state<string | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');
	let draftTask = $state<{ title: string; description: string; outcome: string } | null>(null);
	let abortController: AbortController | null = null;

	onDestroy(() => {
		abortController?.abort();
	});

	function openTaskView(taskId: string) {
		activeTaskId = taskId;
	}

	function handleGoalSubmit(payload: { endGoal: string; currentSkillLevel: string }) {
		endGoal = payload.endGoal;
		currentSkillLevel = payload.currentSkillLevel;
		showGoalModal = false;
	}

	function handleModalClose() {
		if (endGoal.trim() && currentSkillLevel.trim()) {
			showGoalModal = false;
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
		draftTask = { title: '', description: '', outcome: '' };

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
									const base = draftTask ?? { title: '', description: '', outcome: '' };
									let next = base;

									if (message.k === 'title') {
										next = { ...base, title: String(message.v ?? '') };
									} else if (message.k === 'description') {
										next = { ...base, description: String(message.v ?? '') };
									} else if (message.k === 'outcome') {
										next = { ...base, outcome: String(message.v ?? '') };
									}

									draftTask = next;
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
										const id =
											typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
												? crypto.randomUUID()
												: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

										const nextTask: Task = {
											id,
											title: value.title,
											description: value.description,
											outcome: value.outcome
										};

										tasks = [...tasks, nextTask];
										activeTaskId = nextTask.id;
										draftTask = null;
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

			loading = false;
			abortController = null;
		}
	}
</script>

<div class="grid h-full w-full gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
	<div class="flex w-full flex-col gap-6">
		<TaskList
			{tasks}
			{activeTaskId}
			onSelect={openTaskView}
			onCreateTask={generateNewTask}
			creating={loading}
		/>
	</div>

	<TaskView
		task={selectedTask ?? undefined}
		draftTask={draftTask ?? undefined}
		{loading}
		{errorMessage}
	/>
</div>

<GoalSetupModal
	open={showGoalModal}
	initialEndGoal={endGoal}
	initialCurrentSkillLevel={currentSkillLevel}
	onClose={handleModalClose}
	onSubmit={handleGoalSubmit}
/>
