<script lang="ts">
    import { onMount } from 'svelte';
    import type { ProjectRating, ProjectItem, ResumeProjects } from '$lib/types/resume';

	const { text } = $props<{
		text: string;
	}>();

    let overallStrength = $state<'Strong' | 'Average' | 'Needs Work'>('Average');
    let PROJECTS = $state<ProjectItem[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

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

    onMount(async () => {
        try {
            const res = await fetch('/api/format-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            console.log(res);
            if (!res.ok) throw new Error('Failed to format resume');
            const data = await res.json() as {
                overall_strength: typeof overallStrength;
                projects: ProjectItem[];
            };
            overallStrength = data.overall_strength ?? 'Average';
            PROJECTS = data.projects ?? [];
        } catch (e: any) {
            error = e?.message ?? 'Failed to format resume';
        } finally {
            loading = false;
        }
    });
</script>

<div class="min-h-[calc(100svh-56px)] w-full bg-stone-50">
	<div class="mx-auto max-w-5xl">
		<div class="mb-5 flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight text-stone-900">Resume Review</h1>
			<div
				class="inline-flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-200 px-2 py-1"
			>
				<span class="text-xs font-medium text-emerald-700">Strong</span>
			</div>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between">
				<div class="text-md font-semibold tracking-tight text-stone-900">Projects</div>
				<div class="text-xs text-stone-500">
					{PROJECTS.length} item{PROJECTS.length === 1 ? '' : 's'}
				</div>
			</div>

			<div class="space-y-4">
				{#each PROJECTS as p}
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
								<div
									class="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-amber-800"
								>
									<svg
										viewBox="0 0 24 24"
										class="h-3.5 w-3.5"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M11 7h2v6h-2zm0 8h2v2h-2z" /><path d="M1 21h22L12 2 1 21z" />
									</svg>
									Notes to improve
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
			</div>
		</div>
	</div>
</div>
