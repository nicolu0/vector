<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '../app.css';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen transition-[filter,transform] duration-150 ease-out">
	{#if !$page.url.pathname.startsWith('/waitlist')}
		<header
			class="sticky top-0 z-[70] flex w-full items-center justify-between bg-stone-50 px-6 py-4"
		>
			<button
				class="flex items-center gap-2"
				onclick={() => {
					goto('/');
				}}
			>
				<img src={vectorUrl} alt="vector" class="h-4 w-4" />
				<span class="font-mono tracking-tight">vector</span>
			</button>

			<div class="flex items-center gap-2">
				<button
					class="rounded-md px-2 py-1 text-xs tracking-tight text-stone-700 transition hover:text-stone-500"
				>
					How it works
				</button>

				<button
					onclick={() => {
						goto('/enterprise');
					}}
					class="rounded-md px-2 py-1 text-xs tracking-tight text-stone-700 transition hover:text-stone-500"
				>
					Enterprise
				</button>

				<button
					class="rounded-md bg-stone-800 px-2 py-1 text-[10px] tracking-tight text-stone-50 transition hover:bg-stone-600"
				>
					Sign in
				</button>
			</div>
		</header>
	{/if}

	{@render children()}
</div>
