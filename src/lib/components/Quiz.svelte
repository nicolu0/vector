<script lang="ts">
	import { fly } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	// Props (Svelte 5)
	const {
		closeQuiz = (() => {}) as () => void,
		finishQuiz = (() => {}) as (interests: any) => void
	} = $props<{
		closeQuiz?: () => void;
		finishQuiz?: (interests: any) => void;
	}>();

	// Constants
	const DEFAULT_BATCH_SIZE = 30;
	const K_FACTOR = 32;

	// Types
	type Interest = {
		id: number;
		category: 'The Frontier' | 'Earth' | 'Humans' | 'The Arts' | 'Civilization';
		title: string;
		icon: string;
		description: string;
		keywords: string[];
	};

	// Data
	const interests: Interest[] = [
		{
			id: 1,
			category: 'The Frontier',
			title: 'Space',
			icon: '🚀',
			description: 'Exploring beyond Earth: missions, habitats, satellites.',
			keywords: ['space', 'aerospace', 'orbital', 'satellite']
		},
		{
			id: 2,
			category: 'The Frontier',
			title: 'Robots',
			icon: '🤖',
			description: 'Machines that see, think, and act in the real world.',
			keywords: ['robots', 'robotics', 'embodied ai']
		},
		{
			id: 3,
			category: 'The Frontier',
			title: 'Drones',
			icon: '🛸',
			description: 'Flying things—mapping, delivery, cinematography.',
			keywords: ['drones', 'uav', 'quadrotor']
		},
		{
			id: 4,
			category: 'The Frontier',
			title: 'AI companions',
			icon: '🧑‍🤝‍🧑',
			description: 'Assistants that understand and help in daily life.',
			keywords: ['ai companions', 'assistants', 'agents']
		},
		{
			id: 5,
			category: 'The Frontier',
			title: 'Bioengineering',
			icon: '🧬',
			description: 'Designing biology—cells, genes, and new materials.',
			keywords: ['bioengineering', 'genetics', 'synbio']
		},
		{
			id: 6,
			category: 'The Frontier',
			title: 'Brain–computer interfaces',
			icon: '🧠',
			description: 'Bridging neural signals and technology.',
			keywords: ['bci', 'neurotech', 'brain computer interface']
		},
		{
			id: 7,
			category: 'The Frontier',
			title: 'Virtual worlds',
			icon: '🌐',
			description: 'Immersive spaces for play, work, and creation.',
			keywords: ['virtual worlds', 'xr', 'vr', 'metaverse']
		},
		{
			id: 8,
			category: 'Earth',
			title: 'Climate',
			icon: '🌍',
			description: 'Reducing emissions and adapting to change.',
			keywords: ['climate', 'carbon', 'adaptation']
		},
		{
			id: 9,
			category: 'Earth',
			title: 'Clean energy',
			icon: '⚡',
			description: 'Solar, wind, storage, and next-gen power.',
			keywords: ['clean energy', 'renewables', 'storage']
		},
		{
			id: 10,
			category: 'Earth',
			title: 'Sustainable agriculture',
			icon: '🌾',
			description: 'Growing food with less waste and impact.',
			keywords: ['agriculture', 'agtech', 'sustainable food']
		},
		{
			id: 11,
			category: 'Humans',
			title: 'Healthcare',
			icon: '🏥',
			description: 'Better care, access, and outcomes.',
			keywords: ['healthcare', 'medtech', 'care delivery', 'elder care']
		},
		{
			id: 12,
			category: 'Humans',
			title: 'Psychology',
			icon: '🧘',
			description: 'Understanding human behavior and thought.',
			keywords: ['mental health', 'wellness', 'psychology', 'behavior']
		},
		{
			id: 13,
			category: 'Humans',
			title: 'Performance',
			icon: '🏃',
			description: 'Training, recovery, and expanding human potential.',
			keywords: ['performance', 'fitness', 'recovery', 'nutrition', 'longevity', 'lifespan']
		},
		{
			id: 14,
			category: 'Humans',
			title: 'Prosthetics',
			icon: '🦿',
			description: 'Augmenting motion and independence.',
			keywords: ['exoskeleton', 'prosthetics', 'bionic']
		},
		{
			id: 15,
			category: 'The Arts',
			title: 'Music',
			icon: '🎵',
			description: 'Creating, producing, and performing sound.',
			keywords: ['music', 'audio', 'sound']
		},
		{
			id: 16,
			category: 'The Arts',
			title: 'Games',
			icon: '🎮',
			description: 'Interactive play and virtual worlds.',
			keywords: ['games', 'interactive', 'gaming']
		},
		{
			id: 17,
			category: 'The Arts',
			title: 'Visual design',
			icon: '🎨',
			description: 'Animations, color theory, typography, and systems.',
			keywords: ['visual design', 'ui', 'aesthetics', 'animation', 'photography', 'film']
		},
		{
			id: 18,
			category: 'Civilization',
			title: 'Autonomous Vehicles',
			icon: '🚇',
			description: 'How people and goods move at scale.',
			keywords: ['public transit', 'rail', 'bus', 'cars', 'transportation', 'autonomy', 'vehicles']
		},
		{
			id: 19,
			category: 'Civilization',
			title: 'Emergency Response',
			icon: '🛡️',
			description: 'Preparedness, response, and trust.',
			keywords: ['public safety', 'emergency', 'response', 'defense']
		},
		{
			id: 20,
			category: 'Civilization',
			title: 'Infrastructure',
			icon: '🏙️',
			description: 'Intelligent and scalable living systems.',
			keywords: [
				'infrastructure',
				'grid',
				'utilities',
				'housing',
				'architecture',
				'smart buildings'
			]
		}
	];

	/* -----------------------------
     Flow & progress (Svelte 5 state)
  ------------------------------*/
	let step = $state<1 | 2 | 3 | 4>(1);
	const progress = tweened(0, { duration: 300, easing: cubicOut });

	/* -----------------------------
     Elo + pairing state (Svelte 5 state)
  ------------------------------*/
	const ratings: Record<number, number> = {};
	interests.forEach((i) => (ratings[i.id] = 1000));

	type Pair = { left: Interest; right: Interest };

	let batchIndex = $state(0);
	let inBatchCount = $state(0);
	let currentBatchTarget = $state(DEFAULT_BATCH_SIZE);
	const FIRST_BATCH_MIN = Math.ceil(interests.length / 2);
	let coveragePairs = $state<Pair[]>([]);
	const seenPairs = new Set<string>(); // per-batch uniqueness (can remain non-state)
	let currentPair = $state<Pair | null>(null);
	type UndoStep = { a: number; b: number; prevA: number; prevB: number; key: string };
	const undoStack: UndoStep[] = [];
	let ranked = $state<Interest[]>([]);
	let top3 = $derived(ranked.slice(0, 3));

	$effect(() => {
		progress.set(step === 1 ? (inBatchCount / currentBatchTarget) * 100 : step >= 2 ? 100 : 0);
	});

	function pairKey(a: number, b: number) {
		return a < b ? `${a}-${b}` : `${b}-${a}`;
	}
	function expectedScore(ra: number, rb: number) {
		return 1 / (1 + Math.pow(10, (rb - ra) / 400));
	}

	function applyElo(winnerId: number, loserId: number) {
		const ra = ratings[winnerId];
		const rb = ratings[loserId];
		const ea = expectedScore(ra, rb);
		const eb = expectedScore(rb, ra);
		const prevA = ra,
			prevB = rb;
		ratings[winnerId] = ra + K_FACTOR * (1 - ea);
		ratings[loserId] = rb + K_FACTOR * (0 - eb);
		undoStack.push({ a: winnerId, b: loserId, prevA, prevB, key: pairKey(winnerId, loserId) });
	}

	function applyDraw(aId: number, bId: number) {
		const ra = ratings[aId];
		const rb = ratings[bId];
		const ea = expectedScore(ra, rb);
		const eb = expectedScore(rb, ra);
		const prevA = ra,
			prevB = rb;
		ratings[aId] = ra + K_FACTOR * (0.5 - ea);
		ratings[bId] = rb + K_FACTOR * (0.5 - eb);
		undoStack.push({ a: aId, b: bId, prevA, prevB, key: pairKey(aId, bId) });
	}

	function buildCoveragePairs(): Pair[] {
		const arr = [...interests];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		const pairs: Pair[] = [];
		let leftover: Interest | null = null;
		for (let i = 0; i < arr.length; i += 2) {
			if (i + 1 < arr.length) pairs.push({ left: arr[i], right: arr[i + 1] });
			else leftover = arr[i];
		}
		if (leftover) {
			const mate = arr[Math.floor(Math.random() * (arr.length - 1))];
			pairs.push({ left: leftover, right: mate });
		}
		return pairs;
	}

	function chooseNextPair(): Pair | null {
		if (coveragePairs.length > 0) {
			const p = coveragePairs.shift()!;
			seenPairs.add(pairKey(p.left.id, p.right.id));
			return p;
		}
		const maxTries = 200;
		for (let t = 0; t < maxTries; t++) {
			const i = interests[Math.floor(Math.random() * interests.length)];
			const j = interests[Math.floor(Math.random() * interests.length)];
			if (j.id === i.id) continue;
			const key = pairKey(i.id, j.id);
			if (seenPairs.has(key)) continue;
			seenPairs.add(key);
			return { left: i, right: j };
		}
		return null;
	}

	function startBatch() {
		batchIndex += 1;
		inBatchCount = 0;
		seenPairs.clear();
		undoStack.length = 0;

		if (batchIndex === 1) {
			coveragePairs = buildCoveragePairs();
			currentBatchTarget = Math.max(DEFAULT_BATCH_SIZE, FIRST_BATCH_MIN);
		} else {
			coveragePairs = [];
			currentBatchTarget = DEFAULT_BATCH_SIZE;
		}
		currentPair = chooseNextPair();
		step = 1;
	}

	function advance() {
		inBatchCount += 1;
		if (inBatchCount >= currentBatchTarget) {
			toCheckpoint();
			return;
		}
		currentPair = chooseNextPair() ?? null;
		if (!currentPair) toCheckpoint();
	}

	function pickLeft() {
		if (!currentPair) return;
		applyElo(currentPair.left.id, currentPair.right.id);
		advance();
	}
	function pickRight() {
		if (!currentPair) return;
		applyElo(currentPair.right.id, currentPair.left.id);
		advance();
	}
	function pickTie() {
		if (!currentPair) return;
		applyDraw(currentPair.left.id, currentPair.right.id);
		advance();
	}

	function undoLast() {
		const last = undoStack.pop();
		if (!last) return;
		ratings[last.a] = last.prevA;
		ratings[last.b] = last.prevB;
		seenPairs.delete(last.key);
		inBatchCount = Math.max(0, inBatchCount - 1);
		const left = interests.find((i) => i.id === Math.min(last.a, last.b))!;
		const right = interests.find((i) => i.id === Math.max(last.a, last.b))!;
		currentPair = { left, right };
	}

	function toCheckpoint() {
		ranked = [...interests].sort((a, b) => ratings[b.id] - ratings[a.id]);
		step = 2;
	}

	function continueAnotherBatch() {
		startBatch();
	}
	function goToTopInterests() {
		step = 3;
	}
	function generateMission() {
		step = 4;
	}

	function collectSelectedKeywords(): string[] {
		const selected = ranked.slice(0, 3);
		const bag = new Set<string>();
		selected.forEach((i) => i.keywords.forEach((k) => bag.add(k)));
		return Array.from(bag);
	}

	onMount(() => {
		if (!currentPair) startBatch();
	});
</script>

<div
	class="fixed inset-x-0 top-[56px] z-50 flex h-[calc(100vh-56px)] items-center justify-center bg-stone-50 text-stone-900"
>
	<div class="mb-16 flex max-h-[80vh] min-h-0 w-full max-w-3xl flex-col p-8">
		<div class="fixed inset-x-0 bottom-0 z-50 bg-white/80 shadow-md backdrop-blur-sm">
			<div class="relative mx-auto h-[3px] w-full overflow-visible rounded-full bg-stone-200">
				<div class="relative h-full" style="width: {$progress}%">
					<div class="absolute inset-0 rounded-full bg-stone-900"></div>
				</div>
			</div>
		</div>

		{#if step === 1}
			<!-- Fixed back button under the header -->
			<button
				type="button"
				on:click={closeQuiz}
				class="fixed top-[58px] left-4 z-[60] inline-flex items-center gap-2 p-4 text-sm text-stone-600 transition hover:text-stone-900"
				aria-label="Back"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Back
			</button>

			<div class="space-y-5">
				<div in:fly|global={{ y: 18, duration: 500, easing: cubicOut }}>
					<div class="text-3xl font-semibold tracking-tight">Pick One</div>
					<p class="text-sm text-stone-600">Select the topic that seems the most interesting.</p>
				</div>

				{#if currentPair}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<button
							type="button"
							on:click={pickLeft}
							in:fly|global={{ y: 18, duration: 500, easing: cubicOut, delay: 100 }}
							class="min-h-[180px] w-full cursor-pointer rounded-xl border border-stone-200 bg-white p-5 text-left transition duration-200 hover:scale-[1.03] hover:border-stone-300 hover:shadow-lg"
						>
							<div class="flex h-full flex-col">
								<div class="mb-2 text-5xl">{currentPair.left.icon}</div>
								<div class="text-[10px] text-stone-500 uppercase">{currentPair.left.category}</div>
								<div class="mb-1 text-lg font-semibold">{currentPair.left.title}</div>
								<div class="flex-1 text-xs text-stone-600">{currentPair.left.description}</div>
							</div>
						</button>

						<button
							type="button"
							in:fly|global={{ y: 18, duration: 500, easing: cubicOut, delay: 200 }}
							on:click={pickRight}
							class="min-h-[180px] w-full cursor-pointer rounded-xl border border-stone-200 bg-white p-5 text-left transition duration-200 hover:scale-[1.03] hover:border-stone-300 hover:shadow-lg"
						>
							<div class="flex h-full flex-col">
								<div class="mb-2 text-5xl">{currentPair.right.icon}</div>
								<div class="text-[10px] text-stone-500 uppercase">{currentPair.right.category}</div>
								<div class="mb-1 text-lg font-semibold">{currentPair.right.title}</div>
								<div class="flex-1 text-xs text-stone-600">{currentPair.right.description}</div>
							</div>
						</button>
					</div>
				{:else}
					<div class="text-sm text-red-600">No more pairs available in this batch.</div>
				{/if}

				<div class="flex flex-row items-center justify-end gap-2">
					<button
						type="button"
						on:click={pickTie}
						class="rounded-full border border-stone-300 px-4 py-2 text-xs text-stone-700 hover:bg-stone-100 active:scale-[0.98]"
					>
						Can’t decide
					</button>
					<button
						type="button"
						on:click={undoLast}
						class="rounded-full border border-stone-300 px-4 py-2 text-xs text-stone-700 hover:bg-stone-100 active:scale-[0.98]"
					>
						Undo
					</button>
				</div>
			</div>
		{:else if step === 2}
			<div class="flex min-h-0 flex-col gap-4">
				<div>
					<h2 class="text-2xl font-semibold tracking-tight">Checkpoint</h2>
					<p class="text-sm text-stone-600">
						Here’s your current interests ranking. Want to do another round to refine it?
					</p>
				</div>

				<div class="min-h-0 flex-1 space-y-6 pr-1 pb-6">
					<div class="grid w-full grid-cols-1 items-stretch gap-3">
						{#each ranked.slice(0, 3) as i, idx}
							<div
								class="w-full max-w-full overflow-x-hidden rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-md"
							>
								<div class="flex items-start gap-3">
									<div class="shrink-0 text-4xl">{i.icon}</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between">
											<div class="truncate text-lg font-semibold">{idx + 1}. {i.title}</div>
										</div>
										<div class="truncate text-[10px] text-stone-500 uppercase">{i.category}</div>
										<div class="text-md mt-1 break-words text-stone-600">{i.description}</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
					<button
						type="button"
						on:click={continueAnotherBatch}
						class="rounded-full border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 hover:bg-stone-100 active:scale-[0.98]"
					>
						Another Round
					</button>
					<button
						type="button"
						on:click={() => {
							finishQuiz(top3);
							closeQuiz();
						}}
						class="rounded-full border border-stone-300 bg-stone-900 py-2 font-medium text-white transition hover:bg-black"
					>
						Looks Good!
					</button>
				</div>
			</div>
		{:else if step === 3}
			<div class="flex min-h-0 flex-col gap-4">
				<div>
					<h2 class="text-2xl font-semibold tracking-tight">Your Top Interests</h2>
					<p class="text-sm text-stone-600">
						These are your top 3 interests. We'll use them to find the best companies for you.
					</p>
				</div>

				<div class="min-h-0 flex-1 space-y-6 pr-1 pb-6">
					<div class="grid w-full grid-cols-1 items-stretch gap-3">
						{#each ranked.slice(0, 3) as i, idx}
							<div
								class="w-full max-w-full overflow-x-hidden rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-md"
							>
								<div class="flex items-start gap-3">
									<div class="shrink-0 text-4xl">{i.icon}</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between">
											<div class="truncate text-lg font-semibold">{idx + 1}. {i.title}</div>
										</div>
										<div class="truncate text-[10px] text-stone-500 uppercase">{i.category}</div>
										<div class="text-md mt-1 break-words text-stone-600">{i.description}</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="flex flex-col">
					<button
						type="button"
						on:click={generateMission}
						class="rounded-full bg-stone-200 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
					>
						Find matches
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
