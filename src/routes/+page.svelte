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

	const completedMilestones = $derived((milestones ?? []).filter((m) => m.done).length);
	const totalMilestones = $derived((milestones ?? []).length);
	const percentCompleted = $derived(
		totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0
	);

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

<div class="scroll-y flex h-full w-full min-w-0 flex-col overflow-auto pr-3 pl-5">
	{#if userId}
		<section class="bg-stone-50">
			{#if project}
				<div class="space-y-4">
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

					<div
						class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
					>
						<div class="mb-2 flex flex-row items-center justify-between">
							<div class="font-semibold text-stone-900">Milestones</div>
							<div
								class="flex items-center justify-center rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-center text-xs text-stone-700"
							>
								{percentCompleted}% completed
							</div>
						</div>
						<Stepper {milestones} />
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

<style>
	::-webkit-scrollbar-track {
		box-shadow: inset 0 0 10px 10px green;
		border: solid 3px transparent;
	}
</style>
