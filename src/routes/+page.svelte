<script lang="ts">
	import { browser } from '$app/environment';
	import Landing from '$lib/components/lg/Landing.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const serverUserId = data.user?.id ?? null;
	let userId = $state(serverUserId);
	let project = $state(data?.project);

	type AuthUI = { openAuthModal: () => void };
	const { openAuthModal } = getContext<AuthUI>('auth-ui');

	if (browser) {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			userId = session?.user?.id ?? null;
		});
		onDestroy(() => {
			subscription?.unsubscribe();
		});
	}

	$effect(() => {
		userId = data.user?.id ?? null;
	});
</script>

<div class="flex h-full w-full min-w-0 justify-center overflow-auto bg-stone-50 p-4">
	{#if userId && project}
		<section class="bg-stone-50/60">
			<div class="mb-10 text-xs tracking-wide text-stone-500 uppercase">Project</div>
			<h2 class="text-lg font-semibold text-stone-900">{project.title}</h2>
			<p class="mt-1 text-sm text-stone-700">{project.description}</p>
		</section>
	{:else}
		<Landing onSubmit={openAuthModal} />
	{/if}
</div>
