<script lang="ts">
	import { browser } from '$app/environment';
	import Onboarding from '$lib/components/lg/Onboarding.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const serverUserId = data.user?.id ?? null;
	let userId = $state(serverUserId);

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

<div class="flex h-full w-full items-center justify-center bg-stone-50 p-6">
	{#if userId}
		<section class="flex h-full w-full max-w-3xl flex-col justify-center space-y-10">
			<div class="flex text-black">projects dashboard</div>
		</section>
	{:else}
		<Onboarding onSubmit={openAuthModal} />
	{/if}
</div>
