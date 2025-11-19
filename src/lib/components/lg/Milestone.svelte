<script lang="ts">
	import type { Task } from '$lib/stores/tasks';

	type Milestone = {
		id: string;
		title: string;
		description?: string | null;
		ordinal?: number | null;
		skills?: string[] | null;
	};

	const DEFAULT_RESOURCES = [
		{
			label: 'Riot Games API',
			url: 'https://developer.riotgames.com/apis'
		},
		{
			label: 'Top Player Stats',
			url: 'https://www.onetricks.gg/'
		}
	];

	let {
		milestone = null,
		tasks = [],
		resources = DEFAULT_RESOURCES,
		onSelectTask = null
	} = $props<{
		milestone: Milestone | null;
		tasks?: Task[];
		resources?: typeof DEFAULT_RESOURCES;
		onSelectTask?: ((id: string) => void) | null;
	}>();
</script>

{#if milestone}
	<div class="flex h-full w-full flex-col gap-4 bg-stone-50">
		<div>
			<div class="mb-2 text-[32px] font-semibold text-stone-900">
				Milestone {milestone.ordinal ?? '—'}: {milestone.title}
			</div>

			{#if milestone.skills && milestone.skills.length > 0}
				<ul class="flex flex-wrap gap-2">
					{#each milestone.skills as skill (skill)}
						<li>
							<span
								class="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900"
							>
								{skill}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div
			class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
		>
			<div class="mb-2 font-semibold text-stone-900">Description</div>
			{milestone.description}
		</div>

		{#if tasks.length > 0}
			<div
				class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
			>
				<div class="mb-2 font-semibold text-stone-900">Tasks</div>
				<ul class="space-y-2">
					{#each tasks as task (task.id)}
						<li class="group">
							<div
								class="flex w-full items-center gap-2 rounded-md transition duration-100 hover:bg-stone-100"
							>
								<button
									type="button"
									class="relative ml-1 grid h-4 w-4 place-items-center rounded-full focus:outline-none {task.done
										? 'bg-stone-700'
										: ''}"
									aria-checked={task.done}
									aria-label={task.done ? 'Task complete' : 'Task incomplete'}
									disabled
								>
									{#if task.done}
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

								<button
									type="button"
									onclick={() => onSelectTask?.(task.id)}
									class="flex w-full min-w-0 flex-1 items-center justify-between overflow-hidden rounded-md py-1 text-left"
									aria-label={`Open task ${task.title}`}
								>
									<span
										class="block min-w-0 truncate text-sm tracking-tight {task.done
											? 'text-stone-400 line-through'
											: 'text-stone-800'}"
									>
										{task.title}
									</span>
								</button>
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
							class="group flex items-center gap-3 rounded-lg px-1 py-1 duration-100 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
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
{:else}
	<div class="flex h-full w-full items-center justify-center bg-stone-50 text-stone-500">
		No milestone selected.
	</div>
{/if}
