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

	let { task = null, draftTask = null, loading = false, errorMessage = '' }: Props = $props();

	const display = $derived(
		draftTask ?? (task && task.description?.trim().length > 0 ? task : null)
	);
</script>

<div class="flex w-full flex-col gap-6 p-6">
	{#if loading}
		<div class="space-y-3 bg-stone-50">
			<h2 class="text-lg font-semibold text-stone-700">
				{display?.title || 'Drafting a new task...'}
			</h2>
			<p class="text-sm whitespace-pre-wrap text-stone-600">
				{display?.description || 'Outlining the key steps for this 30-minute session.'}
			</p>
			<p class="text-sm font-medium text-stone-700">
				{display?.outcome || "Defining the outcome for today's work..."}
			</p>
		</div>
	{:else if display}
		<div class="space-y-3 bg-stone-50">
			<div>
				<h2 class="text-lg font-semibold">{display.title}</h2>
				<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">{display.description}</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">Outcome</h3>
				<p class="mt-2 text-sm text-stone-800">{display.outcome}</p>
			</div>
		</div>
	{:else}
		<div class="space-y-3 bg-stone-50">
			No task selected yet. Generate a task from the list to begin.
		</div>
	{/if}
</div>
