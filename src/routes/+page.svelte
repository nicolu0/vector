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

<div class="flex h-full w-full min-w-0 justify-center overflow-auto bg-stone-50 p-3 px-6">
	{#if userId}
		<section class="space-y-6 bg-stone-50">
			{#if project}
				<div>
					<div class="text-lg font-semibold text-stone-900">Project Overview</div>
					<div class="leading-relaxed whitespace-pre-wrap text-stone-800">
						{project.description}
					</div>
				</div>
				<div>
					<div class="text-lg font-semibold text-stone-800">Topics Covered</div>
					<ul class="list-disc space-y-1 pl-5 text-stone-800">
						{#each project.skills as skill}
							<li>{skill}</li>
						{/each}
					</ul>
				</div>
			{:else}
				<div class="text-lg font-semibold text-stone-900">No Project Found</div>
			{/if}
		</section>
	{:else}
		<Landing onSubmit={openAuthModal} />
	{/if}
</div>
