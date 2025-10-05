<script lang="ts">
	import vectorUrl from '$lib/assets/vector.svg?url';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class={`min-h-screen transition-[filter,transform] duration-150 ease-out `}>
	<header
		class="sticky top-0 z-[70] flex w-full items-center justify-between border border-b-1 border-gray-100 px-6 py-4"
	>
		<div class="flex items-center gap-2">
			<img src={vectorUrl} alt="vector" class="h-4 w-4" />
			<span class="font-mono tracking-tight">vector</span>
		</div>
		<div class="flex items-center">
			<span class="rounded-md bg-stone-800 px-2 py-1 text-[10px] tracking-tight text-stone-50"
				>Sign in</span
			>
		</div>
	</header>
	{@render children()}
</div>
