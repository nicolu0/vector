<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { get } from 'svelte/store';
	import { tasksByMilestoneStore, getMilestoneStatus } from '$lib/stores/tasks';
	import { setTodoDoneInStore } from '$lib/stores/todos';
	import { getContext } from 'svelte';
	import { APP_MODE_CONTEXT_KEY, type AppModeContext } from '$lib/context/appMode';

	type Task = {
		id: string;
		title: string;
		milestone_id: string;
		done: boolean;
		ordinal: number | null;
		tutorial?: boolean;
		description?: string | null;
		todo?: string[] | null;
	} & Record<string, unknown>;

	type Todo = {
		id: string;
		task_id: string;
		title: string;
		done: boolean;
		ordinal: number | null;
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
			label: 'Big Data Bowl Dataset',
			url: 'https://www.kaggle.com/competitions/nfl-big-data-bowl-2025/data'
		}
	];

	// local optimistic update
	let done = $state<boolean[]>(todos.map((t: Todo) => !!t.done));
	let inflight = $state<boolean[]>(todos.map(() => false));
	$effect(() => {
		done = todos.map((t: Todo) => !!t.done);
		inflight = todos.map(() => false);
	});

	async function toggle(i: number) {
		const todo = todos[i];
		if (!todo || inflight[i]) return;

		// const beforeMap = get(tasksByMilestoneStore);
		// const prevMilestoneStatus = task ? getMilestoneStatus(beforeMap, task.milestone_id) : 'not_started';

		const prevDone = done.every(Boolean);
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
		if (allDone !== prevDone) {
			setTaskDone?.(task.milestone_id, task.id, allDone);
			const prevTask = { ...task };
			task = { ...task, done: allDone };

			if (!isDemo) {
				const { error } = await supabase.from('tasks').update({ done: allDone }).eq('id', task.id);

				if (error) {
					console.error('Failed to update task.done', error.message);
					setTaskDone?.(prevTask.milestone_id, prevTask.id, prevDone);
					task = prevTask;
				}
			}
		}

		inflight[i] = false;
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
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="mb-3 font-semibold text-stone-900">TODO</div>
					<ul class="space-y-2">
						{#each todos as item, i}
							<li class="group">
								<div class="flex w-full items-center gap-2 rounded-md transition">
									<button
										type="button"
										class="relative ml-1 grid h-4 w-4 place-items-center rounded-full focus:outline-none {done[
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
											/>
										{/if}
									</button>

									<div class="min-w-0 flex-1 py-1">
										<span
											class="min-w-0 text-sm tracking-tight break-words {done[i]
												? 'text-stone-400 line-through'
												: 'text-stone-800'}"
										>
											{item.title}
										</span>
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
