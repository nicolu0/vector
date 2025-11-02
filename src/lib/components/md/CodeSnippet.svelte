<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ toggle: void }>();

	const {
		filename,
		open = false,
		code = ''
	} = $props<{
		filename: string;
		open?: boolean;
		code?: string;
	}>();

	function handleToggle(e: MouseEvent | KeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
		dispatch('toggle');
	}
</script>

<div class="mt-2 overflow-hidden rounded-lg border border-stone-200">
	<button
		type="button"
		class="flex w-full items-center justify-between bg-stone-900 px-3 py-1.5 text-[11px] text-stone-50 hover:bg-stone-800 focus:ring-2 focus:ring-stone-400/40 focus:outline-none"
		onclick={handleToggle}
		aria-expanded={open}
		aria-controls={`snippet-${filename}`}
	>
		<span class="font-mono tracking-tight">{filename}</span>
		<span class="inline-flex items-center gap-1 text-stone-200">
			{open ? 'Hide Hint' : 'Show Hint'}
			<svg
				class="h-3 w-3 transition-transform duration-200"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
				style:transform={`rotate(${open ? 180 : 0}deg)`}
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
	</button>

	{#if open}
		<div
			id={`snippet-${filename}`}
			class="bg-stone-950/95"
			in:slide={{ duration: 180, easing: cubicOut }}
			out:slide={{ duration: 140, easing: cubicOut }}
		>
			<pre
				class="max-h-40 overflow-auto px-4 py-3 text-[11px] leading-relaxed text-stone-100 md:px-5">
<code>{code}</code>
      </pre>
		</div>
	{/if}
</div>
