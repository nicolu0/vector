<script lang="ts">
	import Quiz from '$lib/components/Quiz.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';

	const {
		placeholder = 'Tell us your interests…',
		headline = 'Applying to college/jobs?',
		subhead = 'Differentiate yourself with good projects. Vector uses job listings to generate the perfect one.',
		showQuizChip = true,
		quizLabel = 'Take interest quiz',
		onQuiz = (() => {}) as () => void,
		quizHref = null as string | null,
		onGenerate = (() => {}) as (p: { interests: string; tags: string[] }) => void
	} = $props<{
		placeholder?: string;
		headline?: string;
		subhead?: string;
		showQuizChip?: boolean;
		quizLabel?: string;
		onQuiz?: () => void;
		quizHref?: string | null;
		onGenerate?: (p: { interests: string; tags: string[] }) => void;
	}>();

	let showInterestQuiz = $state(false);
	function closeQuiz() {
		showInterestQuiz = false;
	}
	// MASTER POOL (niche)
	const MASTER_SUGGESTIONS = [
		// Bio/health
		'gene editing',
		'synthetic bio',
		'protein design',
		'wearables',
		'sleep staging',
		'ECG analysis',
		// Robotics
		'humanoids',
		'robot arm',
		'visual servoing',
		'SLAM mapping',
		'path planning',
		'grasp planning',
		'drone racing',
		'quad control',
		'exoskeletons',
		'prosthetics',
		// Vision
		'pose estimation',
		'object tracking',
		'depth sensing',
		'image captioning',
		'style transfer',
		'super-resolution',
		'OCR pipeline',
		'video summarizer',
		// Audio/Speech
		'speaker diarization',
		'keyword spotting',
		'voice clone',
		// NLP / LLM
		'RAG search',
		'LoRA finetune',
		'tool use',
		'agents',
		'prompt eval',
		'quantized LLMs',
		// Web / Data
		'web scraping',
		'data viz',
		'recsys',
		'knowledge graph',
		'semantic search',
		// Finance
		'trading bots',
		'fraud detection',
		'order book',
		'market making',
		// Games
		'strategy games',
		'chess engine',
		'league analytics',
		'match highlights',
		'build optimizer',
		// AR/3D
		'AR try-on',
		'3D scanning',
		'photogrammetry',
		// Climate/IoT
		'energy monitor',
		'solar forecast',
		'air quality',
		'smart irrigation'
	];

	// STATE (runes)
	let chipsEl: HTMLDivElement;
	let textareaEl: HTMLTextAreaElement;

	let input = $state('');
	let loading = $state(true);
	let picked = $state(new Set<string>());

	let suggestions = $state<string[]>([]);
	let visibleCount = $state(999); // clamped to two rows after layout

	// DERIVED
	const visibleSuggestions = $derived(suggestions.slice(0, visibleCount));

	// HELPERS
	const shortLabel = (s: string) => s.trim().split(/\s+/).slice(0, 2).join(' ');
	function sample(arr: string[], k = 20) {
		const pool = [...arr];
		for (let i = pool.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[pool[i], pool[j]] = [pool[j], pool[i]];
		}
		return pool.slice(0, k);
	}

	async function refreshSuggestions() {
		loading = true;
		suggestions = sample(MASTER_SUGGESTIONS, 24);
		await clampToTwoRows();
		loading = false;
	}

	function toggle(tag: string) {
		if (picked.has(tag)) picked.delete(tag);
		else picked.add(tag);
	}

	function addToInput(tag: string) {
		const token = tag.trim();
		if (!input.toLowerCase().includes(token.toLowerCase())) {
			input = input ? `${input.trim()}, ${token}` : token;
		}
		picked.add(tag);
	}

	function submit() {
		onGenerate({ interests: input.trim(), tags: Array.from(picked) });
	}

	function keydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
	}

	// Clamp to exactly two wrapped rows (no horizontal scroll)
	async function clampToTwoRows() {
		await tick();
		if (!chipsEl) return;
		const items = Array.from(chipsEl.querySelectorAll<HTMLElement>('[data-chip]'));
		if (items.length === 0) return;

		const tops: number[] = [];
		for (const el of items) {
			const t = el.offsetTop;
			if (!tops.includes(t)) tops.push(t);
			if (tops.length === 3) break; // we only care if a 3rd row appears
		}

		// If there are already ≤2 rows, show all; otherwise cut at first item in row 3
		if (tops.length <= 2) {
			visibleCount = items.length;
			return;
		}

		let cut = items.length;
		const row1 = tops[0],
			row2 = tops[1];
		for (let i = 0; i < items.length; i++) {
			const r = items[i].offsetTop;
			if (r !== row1 && r !== row2) {
				cut = i;
				break;
			}
		}
		visibleCount = cut - 2;
	}

	function finishQuiz(interests: any) {
		for (let i = 0; i < interests.length; i++) {
			addToInput(interests[i].title);
		}
	}

	onMount(async () => {
		await refreshSuggestions();
		const ro = new ResizeObserver(() => clampToTwoRows());
		if (chipsEl) ro.observe(chipsEl);
	});
</script>

<main
	class="flex min-h-[calc(100svh-56px)] w-full flex-col items-center justify-center bg-stone-50 px-6"
>
	<section class="mb-30 w-full max-w-3xl">
		<h1 class="text-center text-4xl font-semibold tracking-tight text-stone-800 sm:text-5xl">
			{headline}
		</h1>
		<p class="mt-3 text-center text-stone-600">{subhead}</p>

		<div class="relative mt-4">
			<textarea
				bind:this={textareaEl}
				bind:value={input}
				onkeydown={keydown}
				rows="3"
				{placeholder}
				class="h-[96px] w-full resize-none overflow-hidden rounded-xl border border-stone-200/80 bg-white px-4 py-3 pr-12 text-[15px] leading-6 text-stone-800 ring-0 transition outline-none placeholder:text-stone-400"
				aria-label="Describe your interests"
			/>
			<button
				class="absolute right-3 bottom-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-800 text-white transition hover:bg-stone-900 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none"
				onclick={submit}
				aria-label="Generate project"
				title="Generate (Cmd/Ctrl + Enter)"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M5 12h14" stroke-linecap="round" />
					<path d="M13 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>

		<div
			bind:this={chipsEl}
			class="mx-auto mt-4 flex min-h-[78px] max-w-3xl flex-wrap items-start gap-2"
		>
			{#if loading}
				{#each [72, 96, 88, 110, 84, 100, 92, 120, 80, 104] as w, i}
					<div
						class="h-8 animate-pulse rounded-full bg-stone-200/70"
						style={`width:${w}px`}
						data-chip
						aria-hidden="true"
					/>
				{/each}
			{:else}
				<button
					data-chip
					onclick={() => {
						showInterestQuiz = true;
					}}
					class="inline-flex items-center gap-2 rounded-full border border-[#2D2D2D] bg-[#2D2D2D] px-3 py-1.5 text-sm text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none"
				>
					<span class="text-base leading-none">★</span>{quizLabel}
				</button>

				{#each visibleSuggestions as s}
					<button
						data-chip
						class="group inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none {picked.has(
							s
						)
							? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-900'
							: ''}"
						onclick={() => (picked.has(s) ? toggle(s) : addToInput(s))}
						aria-pressed={picked.has(s)}
						title={s}
					>
						<span class="text-base leading-none">{picked.has(s) ? '•' : '+'}</span>
						{shortLabel(s)}
					</button>
				{/each}
			{/if}
		</div>
	</section>
	{#if !showInterestQuiz}
		<p class="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 text-center text-xs text-stone-600">
			<span> Tip: click a topic to add it, or press Cmd/Ctrl+Enter to generate. </span>
		</p>
	{/if}
</main>
{#if showInterestQuiz}
	<Quiz {closeQuiz} {finishQuiz} />
{/if}

<style>
	:global(body) {
		background: #fafaf7;
	}
</style>
