<script lang="ts">
	import { fly } from 'svelte/transition';
	import Toast from '$lib/components/Toast.svelte';
	import { cubicOut } from 'svelte/easing';
	import OnboardingFlow from '$lib/components/OnboardingFlow.svelte';
	import Quiz from '$lib/components/Quiz.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	type Answers = {
		education: 'high_school' | 'college' | null;
		goal: 'full_time' | 'internship' | null;
		project: 'research' | 'industry' | null;
	};

	type OnboardingRow = {
		edu_level: string | null;
		goal: string | null;
		project_type: string | null;
	};

	let onboardingRow = $state<OnboardingRow | null>(null);

	const onboardingComplete = $derived(
		!!onboardingRow?.edu_level && !!onboardingRow?.goal && !!onboardingRow?.project_type
	);
	$inspect(onboardingComplete);
	let showOnboarding = $state(false);
	let onboardingSubmitting = $state(false);
	let onboardingError: string | null = $state(null);
	let onboardingAnswers: Partial<Answers> = $state({
		education: null,
		goal: null,
		project: null
	});

	async function loadOnboarding() {
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			onboardingRow = null;
			return;
		}

		const { data, error } = await supabase
			.from('users')
			.select('edu_level, goal, project_type')
			.eq('user_id', session.user.id)
			.single();

		if (!error && data) onboardingRow = data as OnboardingRow;
	}

	async function generateProject() {
		isGenerating = true;
		const interests = input.trim();
		const tags = Array.from(picked);
		const payload = { interests, tags };

		try {
			const response = await fetch('/api/generate-project', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			// if (!response.ok) {
			// 	let detail: string | null = null;
			// 	try {
			// 		const data = await response.json();
			// 		if (typeof data?.message === 'string') detail = data.message;
			// 	} catch {
			// 		const text = await response.text();
			// 		detail = text || null;
			// 	}

			// 	if (response.status === 401) {
			// 		const message = detail ?? 'Sign in to claim your free project credit.';
			// 		await showToast(message, 'danger');
			// 		savePendingGeneration(payload);
			// 		window.dispatchEvent(
			// 			new CustomEvent('vector:auth-required', {
			// 				detail: { message, reason: 'generate' as const }
			// 			})
			// 		);
			// 		isGenerating = false;
			// 		return;
			// 	}
			// 	if (response.status === 402) {
			// 		const message =
			// 			detail ?? 'You are out of credits. Visit your profile to review your balance.';
			// 		await showToast(message, 'danger');
			// 		window.dispatchEvent(
			// 			new CustomEvent('vector:credits-updated', { detail: { credits: 0 } })
			// 		);
			// 		isGenerating = false;
			// 		return;
			// 	}

			// 	const message = detail || 'We ran into an issue generating your project. Please try again.';
			// 	await showToast(message, 'danger');
			// 	isGenerating = false;
			// 	return;
			// }

			const project = await response.json();
			console.log('Project generation response:', project);
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
            const errorMessage = response.headers.get('x-vector-project-error');

			if (usedFallback && errorMessage) {
				console.error('Project generation failed, using fallback:', decodeURIComponent(errorMessage));
			}

			console.log('Project generation completed:', { source: response.headers.get('x-vector-project-source'), fallback: usedFallback });
			clearPendingGeneration();
			await goto('/project', { state: { project, fallback: usedFallback } });
		} catch (err) {
            console.log('Project generation error:', err);
			const message = 'We ran into an issue generating your project. Please try again.';
			await showToast(message, 'danger');
			isGenerating = false;
			onboardingSubmitting = false;
		}
	}

	async function handleOnboardingSubmit(answers: {
		education: 'high_school' | 'college';
		goal: 'full_time' | 'internship';
		project: 'research' | 'industry';
	}) {
		if (onboardingSubmitting) return;
		onboardingError = null;
		onboardingSubmitting = true;

		try {
			// Save onboarding data to database first
			const {
				data: { user },
				error: uerr
			} = await supabase.auth.getUser();
			if (uerr) throw uerr;
			if (!user) throw new Error('Not signed in');

			const { error } = await supabase
				.from('users')
				.upsert(
					{
						user_id: user.id,
						edu_level: answers.education,
						goal: answers.goal,
						project_type: answers.project
					},
					{ onConflict: 'user_id' }
				)
				.select('user_id');

			if (error) throw error;

			// Update local onboarding state
			onboardingRow = {
				edu_level: answers.education,
				goal: answers.goal,
				project_type: answers.project
			};

			// Now generate the project with default interests if needed
			isGenerating = true;
			showOnboarding = false;
			clearPendingGeneration();

			// If no interests provided, use a default based on onboarding answers
			const defaultInterests = getDefaultInterests(answers);
			const interests = input.trim() || defaultInterests;
			const tags = Array.from(picked);

			if (!interests.trim() && tags.length === 0) {
				// If still no interests or tags, show a helpful message
				await showToast('Please enter your interests to generate a project', 'warning');
				isGenerating = false;
				onboardingSubmitting = false;
				return;
			}

			// Generate project with the determined interests
			const payload = { interests, tags };
			await generateProjectWithPayload(payload);
		} catch (err) {
			onboardingError =
				err instanceof Error ? err.message : 'Unable to save your onboarding answers.';
			onboardingSubmitting = false;
			isGenerating = false;
		}
	}

	function getDefaultInterests(answers: {
		education: 'high_school' | 'college';
		goal: 'full_time' | 'internship';
		project: 'research' | 'industry';
	}) {
		// Generate default interests based on onboarding answers
		const interestsMap: Record<string, string> = {
			'high_school_full_time_research': 'computer science, programming, research',
			'high_school_full_time_industry': 'software development, web development, programming',
			'high_school_internship_research': 'machine learning, data science, research',
			'high_school_internship_industry': 'software engineering, full stack development',
			'college_full_time_research': 'machine learning, artificial intelligence, research',
			'college_full_time_industry': 'software engineering, system design, algorithms',
			'college_internship_research': 'deep learning, computer vision, research',
			'college_internship_industry': 'full stack development, DevOps, cloud computing'
		};

		const key = `${answers.education}_${answers.goal}_${answers.project}`;
		return interestsMap[key] || 'software development, programming';
	}

	async function generateProjectWithPayload(payload: { interests: string; tags: string[] }) {
        isGenerating = true;
        try {
            const response = await fetch('/api/generate-project', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
            });

            // Handle non-OK without double-reading body
            if (!response.ok) {
            let detail: string | null = null;
            try {
                const data = await response.json(); // read ONCE
                if (typeof data?.message === 'string') detail = data.message;
            } catch {
                detail = await response.text(); // still read ONCE total (json OR text)
            }
            throw new Error(detail ?? `HTTP ${response.status}`);
            }

            const project = await response.json(); // success path: read ONCE
            const usedFallback = response.headers.get('x-vector-project-source') === 'fallback';
            const creditsHeader = response.headers.get('x-vector-user-credits');
            if (creditsHeader) {
            const n = Number.parseInt(creditsHeader, 10);
            if (!Number.isNaN(n)) {
                window.dispatchEvent(new CustomEvent('vector:credits-updated', { detail: { credits: n } }));
            }
            }

            // Persist for the /project page (choose A2/A3 approach)
            sessionStorage.setItem('vector:last-project', JSON.stringify(project));

            await goto('/project', { state: { project, fallback: usedFallback } });
        } catch (err) {
            await showToast('We ran into an issue generating your project. Please try again.', 'danger');
        } finally {
            isGenerating = false;
            onboardingSubmitting = false;
        }
    }

	const {
		placeholder = `Tell us about your project idea. If you already have a resumé, drop it into the textbox.`,
		headline = 'Applying to college/jobs?',
		subhead = 'Differentiate yourself with great projects. Vector uses job listings to level up your resumé.',
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

	async function submit() {
		if (isGenerating) return;

		const interests = input.trim();
		const tags = Array.from(picked);

		if (!interests && tags.length === 0) {
			const message = 'Add a short description or pick at least one tag.';
			await showToast(message, 'warning');
			return;
		} else if (!onboardingComplete) {
			showOnboarding = true;
		} else {
			generateProjectWithPayload({ interests, tags });
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
		mounted = true;
		await loadOnboarding();
		await refreshSuggestions();
		const ro = new ResizeObserver(() => clampToTwoRows());
		if (chipsEl) ro.observe(chipsEl);
	});

	type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';
	let toastOpen = $state(false);
	let toastMessage = $state('');
	let toastTone = $state<ToastTone>('neutral');

	async function showToast(message: string, tone: ToastTone = 'neutral') {
		toastMessage = message;
		toastTone = tone;
		toastOpen = false;
		await tick();
		toastOpen = true;
	}
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
						class="h-[150px] w-full resize-none overflow-hidden rounded-3xl border border-stone-200/80 bg-white px-4 py-3 pr-12 text-[15px] leading-6 text-stone-800 ring-0 transition outline-none placeholder:text-stone-300"
					/>
					<button
						data-chip
						onclick={() => {
							showInterestQuiz = true;
						}}
						class="absolute bottom-4 left-3 inline-flex items-center gap-2 rounded-full border border-[#2D2D2D] bg-[#2D2D2D] px-3 py-1.5 text-sm text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none"
					>
						<span class="text-base leading-none">★</span>Rate My Resumé
					</button>

					<button
						class="absolute right-3 bottom-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-800 text-white transition hover:bg-stone-900 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none"
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
<Toast
	message={toastMessage}
	tone={toastTone}
	open={toastOpen}
	on:dismiss={() => (toastOpen = false)}
/>

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
