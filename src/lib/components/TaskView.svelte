<script lang="ts">
	type TaskSnapshot = {
		title: string;
		description: string;
		outcome: string;
	};

	interface Props {
		task?: TaskSnapshot | null;
		draftTask?: TaskSnapshot | null;
		loading?: boolean;
		errorMessage?: string;
	}

	let {
		task = null,
		draftTask = null,
		loading = false,
		errorMessage = ''
	}: Props = $props();

	const display = $derived(draftTask ?? task);
</script>

<div class="flex w-full flex-col gap-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
	<div class="space-y-2">
		<h1 class="text-xl font-semibold text-stone-900">Task View</h1>
		<p class="text-sm text-stone-600">
			Review the active 30-minute task. Live updates appear while a new task generates.
		</p>
	</div>

	{#if errorMessage}
		<p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
			{errorMessage}
		</p>
	{/if}

	{#if loading}
		<div class="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
			<h2 class="text-lg font-semibold text-stone-700">{display?.title || 'Drafting a new task…'}</h2>
			<p class="whitespace-pre-wrap text-sm text-stone-600">
				{display?.description || 'Outlining the key steps for this 30-minute session.'}
			</p>
			<p class="text-sm font-medium text-stone-700">
				{display?.outcome || 'Defining the outcome for today’s work…'}
			</p>
		</div>
	{:else if display}
		<div class="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-stone-900">
			<div>
				<h2 class="text-lg font-semibold">{display.title}</h2>
				<p class="mt-2 whitespace-pre-wrap text-sm text-stone-700">{display.description}</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-stone-500">Outcome</h3>
				<p class="mt-2 text-sm text-stone-800">{display.outcome}</p>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
			No task selected yet. Generate a task from the list to begin.
		</div>
	{/if}
</div>
