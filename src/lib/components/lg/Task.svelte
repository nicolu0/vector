<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { invalidateAll } from '$app/navigation';
	import { get } from 'svelte/store';
	import { tasksByMilestoneStore } from '$lib/stores/tasks';
	import { milestonesStore, type MilestoneEntry } from '$lib/stores/milestones';
	import { setTodoDoneInStore } from '$lib/stores/todos';
	import { currentTaskOverrideStore } from '$lib/stores/currentTask';
	import { getContext } from 'svelte';
	import { APP_MODE_CONTEXT_KEY, type AppModeContext } from '$lib/context/appMode';

	type Task = {
		id: string;
		title: string;
		milestone_id: string;
		project_id: string;
		done: boolean;
		ordinal: number | null;
		tutorial?: boolean;
		description?: string | null;
		todo?: string[] | null;
		started_at?: string | null;
		completed_at?: string | null;
		t2c_seconds?: number | null;
	} & Record<string, unknown>;

	type Todo = {
		id: string;
		task_id: string;
		title: string;
		done: boolean;
		ordinal: number | null;
		hints?: string[] | null;
	} & Record<string, unknown>;

	let {
		task = null,
		todos = [] as Todo[],
		setTaskDone
	} = $props<{
		task: Task | null;
		todos: Todo[];
		setTaskDone?: (milestoneId: string, taskId: string, done: boolean) => void;
	}>();
	const appMode = getContext<AppModeContext>(APP_MODE_CONTEXT_KEY) ?? { isDemo: false };
	const isDemo = appMode.isDemo;

	const resources = [
		{
			label: 'Riot Games API',
			url: 'https://developer.riotgames.com/apis'
		},
		{
			label: 'Top Player Stats',
			url: 'https://www.onetricks.gg/'
		}
	];

	// local optimistic update
	let done = $state<boolean[]>(todos.map((t: Todo) => !!t.done));
	let inflight = $state<boolean[]>(todos.map(() => false));
let expandedHints = $state<Set<string>>(new Set());
let lastTaskId = $state<string | undefined>(task?.id);
let generatingNextTask = $state(false);

	$effect(() => {
		done = todos.map((t: Todo) => !!t.done);
		inflight = todos.map(() => false);
		if (task?.id !== lastTaskId) {
			lastTaskId = task?.id;
			expandedHints = new Set();
		}
	});

	function toggleHints(id: string) {
		const next = new Set(expandedHints);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedHints = next;
	}

	async function toggle(i: number) {
		const todo = todos[i];
		if (!todo || inflight[i]) return;

		const prevDone = done.every(Boolean);
		const prevAnyDone = done.some(Boolean);
		const prev = done[i];
		done[i] = !prev;
		inflight[i] = true;

		if (!isDemo) {
			const { error } = await supabase.from('todos').update({ done: done[i] }).eq('id', todo.id);

			if (error) {
				done[i] = prev;
				inflight[i] = false;
				console.error('Failed to update todo.done', error.message);
				return;
			}
		}

		todos[i] = { ...todo, done: done[i] };
		setTodoDoneInStore(todo.task_id, todo.id, done[i]);

		if (!task) {
			inflight[i] = false;
			return;
		}

		const allDone = done.every(Boolean);
		const anyDone = done.some(Boolean);
		const nowIso = new Date().toISOString();
		let startedAt = task.started_at ?? null;
		let completedAt = task.completed_at ?? null;
		let t2cSeconds = task.t2c_seconds ?? null;
		const taskUpdates: Record<string, string | number | null | boolean> = { done: allDone };

		if (!prevAnyDone && anyDone) {
			startedAt = nowIso;
			taskUpdates.started_at = startedAt;
			taskUpdates.completed_at = null;
			taskUpdates.t2c_seconds = null;
			completedAt = null;
			t2cSeconds = null;
		}

		if (!anyDone) {
			startedAt = null;
			completedAt = null;
			t2cSeconds = null;
			taskUpdates.started_at = null;
			taskUpdates.completed_at = null;
			taskUpdates.t2c_seconds = null;
		} else {
			if (allDone && !prevDone) {
				completedAt = nowIso;
				taskUpdates.completed_at = completedAt;
				if (!startedAt) {
					startedAt = nowIso;
					taskUpdates.started_at = startedAt;
				}
				const startMs = startedAt ? Date.parse(startedAt) : Date.now();
				const endMs = Date.parse(completedAt);
				if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
					t2cSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
					taskUpdates.t2c_seconds = t2cSeconds;
				}
			} else if (!allDone && prevDone) {
				completedAt = null;
				t2cSeconds = null;
				taskUpdates.completed_at = null;
				taskUpdates.t2c_seconds = null;
			}
		}

		if (allDone !== prevDone) {
			setTaskDone?.(task.milestone_id, task.id, allDone);
		}

		const prevTask = { ...task };
		task = {
			...task,
			done: allDone,
			started_at: startedAt,
			completed_at: completedAt,
			t2c_seconds: t2cSeconds
		};

		if (!isDemo) {
			const { error } = await supabase.from('tasks').update(taskUpdates).eq('id', task.id);

			if (error) {
				console.error('Failed to update task.done', error.message);
				task = prevTask;
				setTaskDone?.(prevTask.milestone_id, prevTask.id, prevDone);
				done[i] = prev;
				inflight[i] = false;
				return;
			}
		}

		if (allDone && !prevDone && task.project_id) {
			const map = get(tasksByMilestoneStore);
			const order = get(milestonesStore);
			const next = findNextIncompleteTask(map, order);
			if (next.taskId) {
				currentTaskOverrideStore.set({ status: 'idle' });
				await updateCurrentSelection(task.project_id, next.milestoneId, next.taskId);
			} else {
				currentTaskOverrideStore.set({ status: 'generating' });
				await updateCurrentSelection(task.project_id, null, null);
				await generateNextTask(task.project_id, task.milestone_id);
			}
		}

		inflight[i] = false;
	}

	async function generateNextTask(projectId: string, milestoneId: string) {
		if (isDemo || generatingNextTask) return;
		generatingNextTask = true;
		try {
			const res = await fetch('/api/generate-task', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ projectId, milestoneId })
			});
			if (!res.ok) {
				console.error('Failed to generate next task', await res.text());
				currentTaskOverrideStore.set({ status: 'idle' });
				return;
			}
			const payload = await res.json();
			const newTask = payload?.task ?? null;
			const nextMilestoneId = newTask?.milestone_id ?? milestoneId;
			const nextTaskId = newTask?.id ?? null;
			await updateCurrentSelection(projectId, nextMilestoneId ?? null, nextTaskId);
		} catch (err) {
			console.error('Failed to generate next task', err);
			currentTaskOverrideStore.set({ status: 'idle' });
		} finally {
			generatingNextTask = false;
		}
	}

	async function updateCurrentSelection(
		projectId: string,
		milestoneId: string | null,
		taskId: string | null
	) {
		if (isDemo) return;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;
			const { error } = await supabase
				.from('users')
				.update({
					current_project: projectId,
					current_milestone: milestoneId,
					current_task: taskId
				})
				.eq('user_id', user.id);
			if (error) {
				console.error('Failed to update current selection', error.message);
				return;
			}
			if (milestoneId && taskId) {
				currentTaskOverrideStore.set({ status: 'idle' });
			}
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update current selection', err);
			currentTaskOverrideStore.set({ status: 'idle' });
		}
	}

	function findNextIncompleteTask(
		map: Record<string, Task[]>,
		order: MilestoneEntry[]
	): { milestoneId: string | null; taskId: string | null } {
		for (const milestone of order) {
			const tasks = map[milestone.id] ?? [];
			for (const entry of tasks) {
				if (!entry.done) return { milestoneId: milestone.id, taskId: entry.id };
			}
		}
		for (const [milestoneId, tasks] of Object.entries(map)) {
			for (const entry of tasks) {
				if (!entry.done) return { milestoneId, taskId: entry.id };
			}
		}
		return { milestoneId: null, taskId: null };
	}
</script>

{#if task}
	<div class="flex h-full w-full flex-col gap-4 bg-stone-50">
		<div class="space-y-4">
			<div class="mb-2 text-[32px] font-semibold text-stone-900">{task.title}</div>

			<div
				class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
			>
				<div class="mb-2 font-semibold text-stone-900">Task brief</div>
				<div class="whitespace-pre-line">{task.description}</div>
			</div>

			{#if todos.length > 0}
				<div
					class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
				>
					<div class="mb-2 font-semibold text-stone-900">TODOs</div>
					<ul class="space-y-2">
						{#each todos as item, i}
							<li class="group">
								<div class="flex w-full items-start gap-2 rounded-md transition">
									<button
										type="button"
										class="relative mt-1.5 ml-1 grid h-4 w-4 place-items-center rounded-full focus:outline-none {done[
											i
										]
											? 'bg-stone-700'
											: ''}"
										role="checkbox"
										aria-checked={done[i]}
										aria-label={done[i] ? 'Mark incomplete' : 'Mark complete'}
										aria-busy={inflight[i]}
										disabled={inflight[i]}
										onclick={() => toggle(i)}
									>
										{#if done[i]}
											<svg
												viewBox="0 0 24 24"
												class="h-3 w-3 text-stone-50"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M7 12.5 L10.25 15.75 L16.75 9.25"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										{:else}
											<span
												class="pointer-events-none absolute inset-0 rounded-full border border-[1px] border-stone-400 transition duration-200 ease-out"
											></span>
										{/if}
									</button>

									<div class="min-w-0 flex-1 py-1">
										<span
											class="block min-w-0 text-sm tracking-tight break-words {done[i]
												? 'text-stone-400 line-through'
												: 'text-stone-800'}"
										>
											{item.title}
										</span>
										{#if item.hints && item.hints.length > 0}
											<button
												type="button"
												onclick={() => toggleHints(item.id)}
												class="mt-1 flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800 focus:outline-none"
											>
												<svg
													class="h-3 w-3 transition-transform duration-200 {expandedHints.has(
														item.id
													)
														? 'rotate-90'
														: ''}"
													viewBox="0 0 20 20"
													fill="currentColor"
													aria-hidden="true"
												>
													<path
														fill-rule="evenodd"
														d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
														clip-rule="evenodd"
													/>
												</svg>
												{expandedHints.has(item.id) ? 'Hide hints' : 'Show hints'}
											</button>
											{#if expandedHints.has(item.id)}
												<div class="mt-2 space-y-1 pl-1">
													{#each item.hints as hint}
														<div class="border-l-2 border-stone-200 pl-3 text-xs text-stone-600">
															{hint}
														</div>
													{/each}
												</div>
											{/if}
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			<div
				class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
			>
				<div class="mb-2 font-semibold text-stone-900">Resources</div>
				<ul class="list-disc space-y-1 pl-5">
					{#each resources as r (r.url)}
						<li>
							<a
								href={r.url}
								target="_blank"
								rel="noopener noreferrer"
								class="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
								aria-label={`Open resource: ${r.label}`}
							>
								<span class="truncate">{r.label}</span>
								<svg
									class="h-4 w-4 shrink-0 -translate-x-1 opacity-70 transition-transform duration-150 group-hover:-translate-x-0.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<path d="M7 17l10-10" />
									<path d="M8 7h9v9" />
								</svg>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-stone-50 text-stone-500">
		No task selected.
	</div>
{/if}
