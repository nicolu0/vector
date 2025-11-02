<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CodeSnippet from '$lib/components/CodeSnippet.svelte';

	type Deliverable = {
		task: string;
		spec: string;
		implementation: string[];
		code: string;
	};

	const dispatch = createEventDispatcher<{
		markDone: { task: string };
		toggleDone: { task: string };
		toggleHint: { task: string };
	}>();

	const {
		deliverables = [],
		isDone,
		isLoading,
		isCompleting,
		hintOpen,
		hintText
	} = $props<{
		deliverables?: Deliverable[];
		isDone: (task: string) => boolean;
		isLoading: (task: string) => boolean;
		isCompleting: (task: string) => boolean;
		hintOpen: Record<string, boolean>;
		hintText: Record<string, string>;
	}>();

	function handleMark(item: Deliverable, e: MouseEvent | KeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (isLoading(item.task) || isCompleting(item.task)) return;
		if (isDone(item.task)) {
			dispatch('toggleDone', { task: item.task });
		} else {
			dispatch('markDone', { task: item.task });
		}
	}
</script>

{#if deliverables?.length}
	<ul class="mt-1 divide-y divide-stone-200 rounded-lg text-xs">
		{#each deliverables as item (item.task)}
			<li class="p-0">
				<details class="group">
					<summary
						class="flex w-full cursor-pointer items-center justify-between px-3 py-2 select-none"
					>
						<div class="flex min-w-0 items-center gap-2">
							<button
								type="button"
								class="group relative grid h-3 w-3 place-items-center rounded-full focus:outline-none {isDone(
									item.task
								)
									? 'bg-stone-900'
									: ''}"
								role="checkbox"
								aria-checked={isDone(item.task)}
								onclick={(e) => handleMark(item, e)}
								disabled={isLoading(item.task) || isCompleting(item.task)}
							>
								{#if isLoading(item.task)}
									<svg
										class="absolute inset-0 h-3 w-3 animate-spin"
										viewBox="0 0 12 12"
										fill="none"
									>
										<circle
											cx="6"
											cy="6"
											r="5.3"
											stroke="currentColor"
											stroke-width="0.8"
											class="text-stone-400"
										/>
										<path
											d="M6 0.75 A5.25 5.25 0 0 1 11.25 6"
											stroke="currentColor"
											stroke-width="0.8"
											stroke-linecap="round"
											class="text-stone-900 opacity-90"
										/>
									</svg>
								{:else if isCompleting(item.task)}
									<svg class="absolute inset-0 h-3 w-3" viewBox="0 0 12 12" fill="none">
										<circle
											cx="6"
											cy="6"
											r="5.3"
											stroke="currentColor"
											stroke-width="0.8"
											class="text-stone-300 opacity-80"
										/>
										<circle
											cx="6"
											cy="6"
											r="5.3"
											stroke="currentColor"
											stroke-width="0.8"
											fill="none"
											stroke-linecap="round"
											class="ring-draw text-stone-900"
										/>
									</svg>
								{:else if isDone(item.task)}
									<svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none">
										<path
											d="M7 12.5 L10.25 15.75 L16.75 9.25"
											class="check-path"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{:else}
									<span
										class="pointer-events-none absolute inset-0 scale-95 rounded-full border border-[1px] border-dashed border-stone-400 opacity-100 transition duration-200 ease-out group-hover:opacity-0"
									/>
									<span
										class="pointer-events-none absolute inset-0 scale-95 rounded-full border border-[1px] border-stone-400 opacity-0 transition duration-200 ease-out group-hover:opacity-100"
									/>
								{/if}
							</button>

							<span
								class="task-label strike-anim min-w-0 font-mono tracking-tighter break-words {isDone(
									item.task
								)
									? 'done text-stone-400'
									: 'text-stone-800'}"
							>
								{item.task}
							</span>
						</div>

						<div class="flex flex-row items-center justify-center gap-1">
							{#if isLoading(item.task)}
								<span
									class="file-label sheen relative inline-flex min-w-0 items-center gap-1 self-end text-[9px] text-stone-400"
								>
									<span>Syncing</span>
									<svg class="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
										<path
											d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.11 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"
										/>
									</svg>
								</span>
							{/if}

							<svg
								class="ml-2 h-3 w-3 shrink-0 text-stone-500 transition-transform duration-200 group-open:rotate-90"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M6.22 7.22a.75.75 0 0 1 1.06 0L10 9.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 8.28a.75.75 0 0 1 0-1.06z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					</summary>

					<div class="space-y-2 px-3 pt-1 pb-3 text-stone-700">
						{#if item.spec}
							<div class="pl-5 break-words">
								<span class="text-stone-700/90">{item.spec}</span>
							</div>
						{/if}

						{#if item.implementation?.length}
							<div class="space-y-1 pl-5">
								<div class="text-stone-900">How to implement</div>
								<ul class="list-disc space-y-1 pl-5">
									{#each item.implementation as imp}
										<li class="break-words text-stone-700/90">{imp}</li>
									{/each}
								</ul>
							</div>
						{/if}

						<CodeSnippet
							filename={item.task}
							open={!!hintOpen[item.task]}
							code={hintText[item.task] ?? `// no hint for ${item.task}`}
							on:toggle={() => dispatch('toggleHint', { task: item.task })}
						/>
					</div>
				</details>
			</li>
		{/each}
	</ul>
{/if}
