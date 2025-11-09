<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let task = $derived(data?.task);

	let todos: string[] = $derived(task?.todo ?? []);

	// local check state (no persistence)
	let done = $state<boolean[]>(Array.from({ length: todos.length }, () => false));

	function toggle(i: number) {
		done[i] = !done[i];
	}
</script>

<div class="flex h-full w-full flex-col gap-4 bg-stone-50 p-6">
	<div class="mt-8 space-y-4">
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
										? 'bg-stone-900'
										: ''}"
									role="checkbox"
									aria-checked={done[i]}
									aria-label={done[i] ? 'Mark incomplete' : 'Mark complete'}
									onclick={() => toggle(i)}
								>
									{#if done[i]}
										<svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none">
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
										{item}
									</span>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>
