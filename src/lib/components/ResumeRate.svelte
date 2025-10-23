<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import type { ProjectRating } from '$lib/types/resume';
	import {
		analyzeResume,
		resetResumeAnalysis,
		resumeAnalysisStore,
		type ResumeAnalysisState
	} from '$lib/stores/resumeAnalysis';

	const { text, filename, waitlist } = $props<{
		text: string;
		filename: string | null;
		waitlist: () => void;
	}>();

	let analysis = $state<ResumeAnalysisState>(get(resumeAnalysisStore));
	const unsubscribe = resumeAnalysisStore.subscribe((value) => (analysis = value));
	onDestroy(unsubscribe);

	$effect(() => {
		const trimmed = text?.trim?.() ?? '';
		const cacheKey = filename?.trim?.() || null;
		if (!trimmed) {
			resetResumeAnalysis();
			return;
		}

		analyzeResume(trimmed, { cacheKey }).catch(() => {
			// store already exposes the error state; no additional handling needed here
		});
	});

	function ratingBadgeClasses(r: ProjectRating) {
		switch (r) {
			case 'No change':
				return 'border-emerald-400 bg-emerald-50 text-emerald-700';
			case 'Small tweaks':
				return 'border-sky-400 bg-sky-50 text-sky-800';
			case 'Needs Improvement':
				return 'border-rose-400 bg-rose-50 text-rose-800';
		}
	}

	function strengthBadgeClasses(value: 'Strong' | 'Average' | 'Needs Work') {
		switch (value) {
			case 'Strong':
				return 'border-emerald-500 bg-emerald-200 text-emerald-700';
			case 'Average':
				return 'border-amber-400 bg-amber-100 text-amber-700';
			case 'Needs Work':
				return 'border-rose-400 bg-rose-100 text-rose-700';
			default:
				return 'border-stone-300 bg-stone-100 text-stone-700';
		}
	}

	let projects = $derived(analysis.data?.projects ?? []);
	let overallStrength = $derived(analysis.data?.overall_strength ?? 'Average');
	let analysisStatus = $derived(analysis.status);
	let analysisError = $derived(analysis.error);
</script>

<div class="min-h-[calc(100svh-56px)] w-full bg-stone-50">
	<div class="mx-auto max-w-5xl">
		<div class="mb-5 flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight text-stone-900">Resume Review</h1>
			<div
				class={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 ${strengthBadgeClasses(overallStrength)}`}
			>
				<span class="text-xs font-medium">{overallStrength}</span>
			</div>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between">
				<div class="text-md font-semibold tracking-tight text-stone-900">Projects</div>
				<div class="text-xs text-stone-500">
					{projects.length} item{projects.length === 1 ? '' : 's'}
				</div>
			</div>

			<div class="space-y-4">
				{#if analysisStatus === 'loading'}
					<div
						class="sheen flex items-center gap-3 overflow-hidden rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500"
					>
						<span
							class="h-4 w-4 animate-spin rounded-full border border-stone-300 border-t-stone-500"
							aria-hidden="true"
						/>
						<span>Analyzing resume…</span>
					</div>
				{:else if analysisError}
					<div class="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
						{analysisError}
					</div>
				{:else if projects.length === 0}
					<div class="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
						No projects extracted yet.
					</div>
				{:else}
					{#each projects as p}
						<div class="rounded-lg border border-stone-200 bg-white p-4">
							<!-- header row: title + stack + rating (no score) -->
							<div class="mb-1 flex flex-wrap items-center gap-2">
								<h3 class="min-w-0 truncate text-sm font-semibold tracking-tight text-stone-900">
									{p.title}
								</h3>

								<span
									class={'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] ' +
										ratingBadgeClasses(p.rating.label)}
								>
									<span class="font-medium">{p.rating.label}</span>
								</span>

								{#if p.stack}
									<span
										class="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] text-stone-700"
									>
										{p.stack}
									</span>
								{/if}
							</div>

							{#if p.bullets.length > 0}
								<ul class="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-stone-700">
									{#each p.bullets as b}
										<li>{b}</li>
									{/each}
								</ul>
							{:else}
								<div class="text-xs text-stone-500">No details provided.</div>
							{/if}

							{#if p.notes.length > 0}
								<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
									<div class="mb-3 flex w-full flex-row justify-between">
										<div
											class="inline-flex items-center gap-1 text-[11px] font-semibold tracking-tight text-amber-800"
										>
											<svg
												viewBox="0 0 24 24"
												class="h-3 w-3"
												fill="currentColor"
												aria-hidden="true"
											>
												<path d="M11 7h2v6h-2zm0 8h2v2h-2z" /><path d="M1 21h22L12 2 1 21z" />
											</svg>
											Improvements
										</div>
										<button
											onclick={waitlist}
											class="group inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-amber-800"
										>
											<span>Get Started</span>
											<svg
												viewBox="0 0 24 24"
												class="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
											>
												<path d="M9 18l6-6-6-6" />
											</svg>
										</button>
									</div>
									<ul class="list-disc space-y-1 pl-5 text-[11px] leading-5 text-amber-900">
										{#each p.notes as n}
											<li>{n}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.sheen {
		position: relative;
		overflow: hidden;
	}

	.sheen::after {
		content: '';
		position: absolute;
		inset: -6px 0;
		pointer-events: none;
		background: linear-gradient(
			110deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0) 35%,
			rgba(255, 255, 255, 0.5) 50%,
			rgba(255, 255, 255, 0) 65%,
			rgba(255, 255, 255, 0) 100%
		);
		transform: translateX(-80%);
		animation: sheen-sweep 3s ease-in-out infinite;
		mix-blend-mode: screen;
		opacity: 0.8;
	}

	@keyframes sheen-sweep {
		to {
			transform: translateX(80%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheen::after {
			animation: none;
			opacity: 0;
		}
	}
</style>
