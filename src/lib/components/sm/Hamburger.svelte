<script lang="ts">
	let open = $state(false);
</script>

<button
	type="button"
	class="inline-grid h-6 w-6 place-items-center rounded-sm text-stone-600 transition hover:bg-stone-200/70 hover:text-stone-900 focus:outline-none disabled:opacity-60"
	aria-haspopup="listbox"
	aria-expanded={open}
>
	<span class="relative inline-block h-4 w-3" aria-hidden="true">
		<!-- top bar -->
		<span
			class="absolute top-1/2 right-0 left-0 block h-px rounded bg-current transition-transform duration-200 ease-in-out"
			class:-translate-y-[4px]={!open}
			class:translate-y-0={open}
			class:rotate-45={open}
		/>
		<!-- middle bar -->
		<span
			class="absolute top-1/2 right-0 left-0 block h-px origin-center rounded-full bg-current transition-transform duration-200 ease-in-out"
			style:transform={`scaleX(${open ? 0.08 : 1})`}
		/>
		<!-- bottom bar -->
		<span
			class="absolute top-1/2 right-0 left-0 block h-px rounded bg-current transition-transform duration-200 ease-in-out"
			class:translate-y-[4px]={!open}
			class:translate-y-0={open}
			class:-rotate-45={open}
		/>
	</span>
</button>
