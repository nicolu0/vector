<script lang="ts">
	import { blur, fly } from 'svelte/transition';
	import OnboardingFlow from '$lib/components/OnboardingFlow.svelte';
	import { cubicOut } from 'svelte/easing';
	import Quiz from '$lib/components/Quiz.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { getContext } from 'svelte';

	type AuthUI = {
		openAuthModal: (message?: string) => void;
		closeAuthModal: () => void;
	};

	const { openAuthModal } = getContext<AuthUI>('auth-ui');

	type OnboardingAnswers = {
		education: 'high_school' | 'college' | null;
		goal: 'full_time' | 'internship' | 'explore' | null;
		project: 'research' | 'industry' | null;
	};

	let showOnboarding = $state(false);
	let onboardingSubmitting = $state(false);
	let onboardingError: string | null = $state(null);
	let onboardingAnswers: OnboardingAnswers = $state({
		education: null,
		goal: null,
		project: null
	});
	async function handleOnboardingSubmit(answers: {
		education: 'high_school' | 'college';
		goal: 'full_time' | 'internship' | 'explore';
		project: 'research' | 'industry';
	}) {
		const interests = input.trim();
		const tags = Array.from(picked);
		const payload = { interests, tags };

		if (onboardingSubmitting) return;
		onboardingError = null;
		onboardingSubmitting = true;
		isGenerating = true;
		showOnboarding = false;
		clearPendingGeneration();

		try {
			const response = await fetch('/api/generate-project', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				let detail: string | null = null;
				try {
					const data = await response.json();
					if (typeof data?.message === 'string') detail = data.message;
				} catch {
					const text = await response.text();
					detail = text || null;
				}

				if (response.status === 401) {
					const message = detail ?? 'Sign in to claim your free project credit.';
					errorMessage = message;
					savePendingGeneration(payload);
					window.dispatchEvent(
						new CustomEvent('vector:auth-required', {
							detail: { message, reason: 'generate' as const }
						})
					);
					isGenerating = false;
					return;
				}
				if (response.status === 402) {
					const message =
						detail ?? 'You are out of credits. Visit your profile to review your balance.';
					errorMessage = message;
					window.dispatchEvent(
						new CustomEvent('vector:credits-updated', { detail: { credits: 0 } })
					);
					isGenerating = false;
					return;
				}

				errorMessage = detail || 'We ran into an issue generating your project. Please try again.';
				isGenerating = false;
				return;
			}

			const project = await response.json();
			const creditsHeader = response.headers.get('x-vector-user-credits');
			if (creditsHeader !== null) {
				const numericCredits = Number.parseInt(creditsHeader, 10);
				if (!Number.isNaN(numericCredits)) {
					window.dispatchEvent(
						new CustomEvent('vector:credits-updated', { detail: { credits: numericCredits } })
					);
				}
			}
			const usedFallback = response.headers.get('x-vector-project-source') === 'fallback';
			clearPendingGeneration();
			await goto('/project', { state: { project, fallback: usedFallback } });
		} catch (err) {
			console.error('Project generation failed', err);
			errorMessage = 'We ran into an issue generating your project. Please try again.';
			isGenerating = false;
		}
	}

	const {
		placeholder = 'Tell us your interests… Not sure? Take the interest quiz',
		headline = 'Applying to college/jobs?',
		subhead = 'Differentiate yourself with great projects. Vector uses job listings to generate the perfect ones.',
		quizLabel = 'Take interest quiz'
	} = $props<{
		placeholder?: string;
		headline?: string;
		subhead?: string;
		showQuizChip?: boolean;
		quizLabel?: string;
		quizHref?: string | null;
	}>();

	let showInterestQuiz = $state(false);
	function closeQuiz() {
		showInterestQuiz = false;
	}

	const PENDING_GENERATION_KEY = 'vector:pending-generation';

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
	let isGenerating = $state(false);
	let errorMessage = $state<string | null>(null);

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

	function savePendingGeneration(payload: { interests: string; tags: string[] }) {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(payload));
		} catch (_err) {}
	}

	function loadPendingGeneration(): { interests: string; tags: string[] } | null {
		if (typeof window === 'undefined') return null;
		try {
			const raw = sessionStorage.getItem(PENDING_GENERATION_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { interests?: unknown; tags?: unknown };
			const interests = typeof parsed.interests === 'string' ? parsed.interests : '';
			const tags = Array.isArray(parsed.tags)
				? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
				: [];
			return { interests, tags };
		} catch (
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			_err
		) {
			return null;
		}
	}

	function clearPendingGeneration() {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.removeItem(PENDING_GENERATION_KEY);
		} catch (
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			_err
		) {
			// ignore
		}
	}

	async function resumePendingGeneration() {
		if (isGenerating) return;
		const pending = loadPendingGeneration();
		if (!pending) return;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) return;
		clearPendingGeneration();
		input = pending.interests;
		picked = new Set(pending.tags);
		errorMessage = null;
		await submit();
	}

	onMount(() => {
		const handleSignedIn = () => {
			resumePendingGeneration();
		};

		window.addEventListener('vector:auth-signed-in', handleSignedIn);
		return () => {
			window.removeEventListener('vector:auth-signed-in', handleSignedIn);
		};
	});

	async function ensureSignedInOrPrompt(payload: { interests: string; tags: string[] }) {
		const {
			data: { user },
			error
		} = await supabase.auth.getUser();
		if (error) throw error;

		if (!user) {
			const message = 'Sign in to claim your free project credit.';
			savePendingGeneration(payload);
			window.dispatchEvent(
				new CustomEvent('vector:auth-required', {
					detail: { message, reason: 'generate' as const }
				})
			);
			return { user: null, credits: null };
		}

		const { data: row } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', user.id)
			.maybeSingle();

		const credits = typeof row?.credits === 'number' ? row.credits : null;
		return { user, credits };
	}
	async function submit() {
		if (isGenerating) return;

		const interests = input.trim();
		const tags = Array.from(picked);

		if (!interests && tags.length === 0) {
			errorMessage = 'Add a short description or pick at least one tag.';
			return;
		} else {
			showOnboarding = true;
		}
	}

	function keydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}

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
	let mounted = $state(false);

	onMount(async () => {
		const raw = sessionStorage.getItem('vector:cached-project');
		const project = raw ? JSON.parse(raw) : null;
		console.log('after login: ', project);

		mounted = true;
		await refreshSuggestions();
		const ro = new ResizeObserver(() => clampToTwoRows());
		if (chipsEl) ro.observe(chipsEl);
	});
</script>

{#if !isGenerating}
	<main
		class="flex min-h-[calc(100svh-56px)] w-full flex-col items-center justify-center bg-stone-50 px-6"
		aria-busy={isGenerating}
	>
		<div class="mb-30 w-full max-w-3xl">
			{#if mounted}
				<div
					class="text-center text-4xl font-semibold tracking-tight text-stone-800 sm:text-5xl"
					in:fly={{ y: 18, duration: 500, easing: cubicOut }}
				>
					{headline}
				</div>
				<p
					class="mt-3 text-center text-stone-500"
					in:fly={{ y: 18, duration: 500, easing: cubicOut, delay: 100 }}
				>
					{subhead}
				</p>

				<div class="relative mt-4" in:fly={{ y: 18, duration: 500, easing: cubicOut, delay: 400 }}>
					<textarea
						bind:this={textareaEl}
						bind:value={input}
						oninput={() => (errorMessage = null)}
						onkeydown={keydown}
						rows="3"
						{placeholder}
						class="h-[96px] w-full resize-none overflow-hidden rounded-xl border border-stone-200/80 bg-white px-4 py-3 pr-12 text-[15px] leading-6 text-stone-800 ring-0 transition outline-none placeholder:text-stone-400"
						aria-label="Describe your interests"
					/>
					<button
						class="absolute right-2 bottom-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-800 text-white transition hover:bg-stone-900 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none"
						onclick={submit}
						disabled={isGenerating}
						aria-label="Generate project"
						title="Generate (Cmd/Ctrl + Enter)"
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M5 12h14" stroke-linecap="round" />
							<path d="M13 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>

				{#if errorMessage}
					<p class="mt-2 text-sm text-rose-600">
						{errorMessage}
					</p>
				{/if}

				<div
					bind:this={chipsEl}
					in:fly={{ y: 18, duration: 500, easing: cubicOut, delay: 500 }}
					class="mx-auto mt-2 flex min-h-[78px] max-w-3xl flex-wrap items-start gap-2"
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
								class="group inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none"
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
			{/if}
		</div>
		{#if !showInterestQuiz}
			<p class="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 text-center text-xs text-stone-600">
				<span> Tip: click a topic to add it, or press Cmd/Ctrl+Enter to generate. </span>
			</p>
		{/if}
	</main>
{/if}
{#if isGenerating}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-stone-50 px-6">
		<div class="w-full max-w-sm p-8 text-center text-stone-800">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-stone-200 border-t-stone-800"
				aria-hidden="true"
				style="animation: spin 1s linear infinite"
			></div>
			<div class="mt-4 text-lg font-semibold">Generating your project</div>
			<p class="mt-2 text-sm text-stone-500">
				We’re crafting a tailored project using your inputs.
			</p>
		</div>
	</div>
{/if}
{#if showInterestQuiz}
	<Quiz {closeQuiz} {finishQuiz} />
{/if}
{#if showOnboarding}
	<OnboardingFlow
		onSubmit={handleOnboardingSubmit}
		submitting={onboardingSubmitting}
		error={onboardingError}
		initialAnswers={onboardingAnswers}
		close={() => {
			showOnboarding = false;
		}}
	/>
{/if}

<style>
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
