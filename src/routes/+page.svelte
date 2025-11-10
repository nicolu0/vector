<script lang="ts">
	import { browser } from '$app/environment';
	import Landing from '$lib/components/lg/Landing.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onDestroy } from 'svelte';
	import type { PageProps } from './$types';
	import Stepper from '$lib/components/sm/Stepper.svelte';

	let { data }: PageProps = $props();

	const resources = [
		{
			label: 'Attention is All You Need (Vaswani et al., 2017) - PDF',
			url: 'https://arxiv.org/pdf/1706.03762'
		},
		{
			label: 'Language Models are Unsupervised Multitask Learners (Radford et al., 2019) - PDF',
			url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf'
		},
		{
			label: 'Language Models are Few-Shot Learners (Brown et al., 2020) - PDF',
			url: 'https://arxiv.org/pdf/2005.14165'
		}
	];

	const serverUserId = data.user?.id ?? null;
	let userId = $state(serverUserId);
	let project = $state(data?.project);
	let milestones = $state(data?.milestones);
	let tasks = $state(data?.tasks ?? []);

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
		project = data?.project ?? null;
		milestones = data?.milestones ?? [];
		tasks = data?.tasks ?? [];
	});
</script>

<div class="scroll-y flex h-full w-full min-w-0 flex-col overflow-auto pr-3 pb-5 pl-5">
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
						<div class="mb-2 font-semibold text-stone-900">Progress tracking</div>
						<p class="text-stone-700">
							No repository connected.

							<a
								href="/"
								class="inline-flex items-center gap-1 rounded-sm font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 hover:text-stone-950 hover:decoration-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
							>
								Connect a GitHub repository
							</a>
							to track your progress.
						</p>
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

					<div
						class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
					>
						<div class="mb-2 font-semibold text-stone-900">Resources</div>
						<ul class="list-disc space-y-1 pl-5">
							{#each resources as r}
								<li>
									<a
										href={r.url}
										target="_blank"
										rel="noopener noreferrer"
										class="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
										aria-label={`Open resource: ${r.label}`}
									>
										<span class="truncate">{r.label}</span>
										<svg
											class="h-4 w-4 shrink-0 -translate-x-1 opacity-70 transition-transform duration-150 group-hover:-translate-x-0.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											aria-hidden="true"
										>
											<path d="M7 17l10-10" />
											<path d="M8 7h9v9" />
										</svg>
									</a>
								</li>
							{/each}
						</ul>
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
