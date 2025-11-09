<script lang="ts">
	import { browser } from '$app/environment';
	import Landing from '$lib/components/lg/Landing.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';
	import Stepper from '$lib/components/sm/Stepper.svelte';

	let { data }: PageProps = $props();

	const serverUserId = data.user?.id ?? null;
	let userId = $state(serverUserId);
	let project = $state(data?.project);
	let milestones = $state(data?.milestones);

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
				<div class="mt-8 space-y-4">
					<div class="mb-2 text-[32px] font-semibold text-stone-900">{project.title}</div>

					<div class="mb-4 flex flex-wrap gap-2">
						<span
							class="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-medium text-rose-900"
						>
							{project.difficulty}
						</span>
						<span
							class="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900"
						>
							{project.domain}
						</span>
					</div>

					<div
						class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
					>
						<div class="mb-2 font-semibold text-stone-900">Project brief</div>
						{project.description}
					</div>

                    <div class="text-[14px] leading-relaxed text-stone-800 border border-stone-200 rounded-xl p-4 bg-white">
                        <div class="font-semibold text-stone-900 mb-2">Milestones</div>
						<Stepper milestones={milestones} />
					</div>

					<div
						class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
					>
						<div class="mb-2 font-semibold text-stone-900">Skills you'll use/learn</div>
						<div class="flex flex-wrap gap-2">
							{#each project.skills as skill}
								<span
									class="inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-700"
								>
									{skill}
								</span>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<div class="text-lg font-semibold text-stone-900">No Project Found</div>
			{/if}
		</section>
	{:else}
		<Landing onSubmit={openAuthModal} />
	{/if}
</div>

<div>
	<div></div>
	<div></div>
</div>
