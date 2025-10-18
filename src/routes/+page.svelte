<script lang="ts">
	import { fly } from 'svelte/transition';
	import Toast from '$lib/components/Toast.svelte';
	import { cubicOut } from 'svelte/easing';
	import OnboardingFlow from '$lib/components/OnboardingFlow.svelte';
	import Quiz from '$lib/components/Quiz.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import CheckCircle from '$lib/components/CheckCircle.svelte';

	let showResumeAdded = $state(false);

	let selectedFileName = $state<string | null>(null);
	let fileInputEl: HTMLInputElement | null = null;

	// click handler to open the OS file picker
	function openFilePicker() {
		fileInputEl?.click();
	}

	// errors for the PDF flow
	let pdfError: string | null = $state(null);

	let pdfGetDocument: any; // resolved once on client
	let pdfReady: Promise<void> | null = null;
	let dragging = $state(false);

	function onDragOver(e: DragEvent) {
		e.preventDefault(); // required so drop fires
		dragging = true;
	}
	function onDragLeave() {
		dragging = false;
	}
	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = Array.from(e.dataTransfer?.files ?? []).filter(
			(f) => f.type === 'application/pdf'
		);
		if (files.length === 0) return;
		// handle first (or loop all if you want multi)
		await handlePdf(files[0]); // reuses your existing handlePdf(...)
	}

	function ensurePdfReady() {
		if (pdfReady) return pdfReady;
		pdfReady = (async () => {
			// Only modern entry; no legacy fallback
			const mod: any = await import('pdfjs-dist');
			const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;

			// Set the worker
			(mod.GlobalWorkerOptions ?? mod.default?.GlobalWorkerOptions).workerSrc = workerUrl;

			// Keep a reference to getDocument
			pdfGetDocument = mod.getDocument ?? mod.default?.getDocument;
			if (!pdfGetDocument) {
				throw new Error('pdfjs getDocument not found (check pdfjs-dist version)');
			}
		})();
		return pdfReady;
	}

	async function extractPdfText(file: File): Promise<string> {
		await ensurePdfReady();

		const data = await file.arrayBuffer();
		const pdf = await pdfGetDocument({ data }).promise;

		const pages: string[] = [];
		for (let p = 1; p <= pdf.numPages; p++) {
			const page = await pdf.getPage(p);
			const content = await page.getTextContent();
			const t = (content.items as any[])
				.map((i) => (typeof i.str === 'string' ? i.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (t) pages.push(t);
		}

		return pages
			.join('\n\n--- PAGE BREAK ---\n\n')
			.replace(/\u00AD/g, '')
			.replace(/ {2,}/g, ' ')
			.trim();
	}

	async function onFileChange(e: Event) {
		const el = e.target as HTMLInputElement;
		const file = el.files?.[0];
		if (file) await handlePdf(file);
		el.value = ''; // allow re-picking the same file
	}

	async function handlePdf(file: File) {
		pdfError = null;

		if (file.type !== 'application/pdf') {
			pdfError = 'Only PDF files are supported.';
			await showToast(pdfError, 'warning');
			return;
		}
		if (file.size > 25 * 1024 * 1024) {
			pdfError = 'File too large. Max 25 MB.';
			await showToast(pdfError, 'warning');
			return;
		}

		// progress indicator (still writes into your existing `input`)
		input = input?.trim() ? `${input}\n\n[Extracting PDF…]` : 'Extracting PDF…';

		try {
			const text = await extractPdfText(file);

			console.log('[PDF] extracted chars:', text?.length ?? 0);
			console.log('[PDF] text:\n', text);

			input = text || '';
			selectedFileName = file.name;

			// show the transition screen
			showResumeAdded = true;

			// hide it after the animation; tweak timing to taste
			setTimeout(() => {
				showResumeAdded = false;
			}, 1100);

			if (!text) {
				pdfError = 'No text found (likely a scanned PDF).';
				await showToast(pdfError, 'warning');
			}
		} catch (err) {
			console.error(err);
			pdfError = 'Failed to extract text from PDF.';
			await showToast(pdfError, 'danger');
		}
	}

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
					await showToast(message, 'danger');
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
					await showToast(message, 'danger');
					window.dispatchEvent(
						new CustomEvent('vector:credits-updated', { detail: { credits: 0 } })
					);
					isGenerating = false;
					return;
				}

				const message = detail || 'We ran into an issue generating your project. Please try again.';
				await showToast(message, 'danger');
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
			const message = 'We ran into an issue generating your project. Please try again.';
			await showToast(message, 'danger');
			isGenerating = false;
		}
	}

	async function handleOnboardingSubmit() {
		if (onboardingSubmitting) return;
		onboardingError = null;
		onboardingSubmitting = true;
		isGenerating = true;
		showOnboarding = false;
		clearPendingGeneration();
		await generateProject();
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
			generateProject();
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

				<div
					class="relative mt-4"
					aria-label="Drop PDF here"
					in:fly={{ y: 18, duration: 500, easing: cubicOut, delay: 200 }}
				>
					<div
						class={`group relative grid h-[300px] place-items-center rounded-2xl border
      ${dragging ? 'ring-2 ring-stone-400' : ''}
      ${
				selectedFileName
					? 'border-stone-400 bg-white'
					: 'border-dashed border-stone-300 bg-stone-50'
			}
      cursor-pointer text-stone-600 transition`}
						ondragover={onDragOver}
						ondragleave={onDragLeave}
						ondrop={onDrop}
						onclick={openFilePicker}
						role="button"
						tabindex="0"
						onkeydown={(e: KeyboardEvent) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openFilePicker();
							}
						}}
						aria-describedby="dropzone-help"
					>
						{#if selectedFileName}
							<!-- Selected file state -->
							<div class="pointer-events-none flex flex-col items-center gap-2 px-6 text-center">
								<svg viewBox="0 0 64 64" class="h-10 w-10" aria-hidden="true" role="img">
									<path
										d="M12 8a6 6 0 0 1 6-6h20.5L56 19.5V52a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V8z"
										fill="#F2F2EF"
									/>
									<path d="M38.5 2v11a6 6 0 0 0 6 6H56L38.5 2z" fill="#D1D5DB" />
									<rect x="8" y="38" width="40" height="18" rx="5" fill="#EF4444" />
									<text
										x="28"
										y="50.5"
										text-anchor="middle"
										font-size="10.5"
										font-weight="700"
										fill="#FFFFFF"
										font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'"
									>
										PDF
									</text>
								</svg>

								<div class="inline-flex items-center gap-2">
									<span class="max-w-[520px] truncate text-sm font-medium text-stone-800">
										{selectedFileName}
									</span>
								</div>
								<div id="dropzone-help" class="text-xs text-stone-300">
									Click to choose a different PDF • or drop another file
								</div>
							</div>
						{:else}
							<div class="pointer-events-none flex flex-col items-center gap-2 px-6 text-center">
								<svg viewBox="0 0 64 64" class="h-10 w-10" aria-hidden="true" role="img">
									<path
										d="M12 8a6 6 0 0 1 6-6h20.5L56 19.5V52a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V8z"
										fill="#D5D3D0"
									/>
									<path d="M38.5 2v11a6 6 0 0 0 6 6H56L38.5 2z" fill="#A69F9C" />
									<rect x="8" y="34" width="40" height="18" rx="5" fill="#EF4444" />
									<text
										x="28"
										y="46.5"
										text-anchor="middle"
										font-size="10.5"
										font-weight="700"
										fill="#FFFFFF"
										font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'"
									>
										PDF
									</text>
								</svg>
								<div class="text-sm text-stone-500">Share your resumé to get started</div>
							</div>
						{/if}

						{#if dragging}
							<div
								class="pointer-events-none absolute inset-0 grid place-items-center rounded-3xl
               bg-stone-50/70 text-sm text-stone-500"
							>
								Drop to import
							</div>
						{/if}
					</div>

					<!-- Hidden input (click-to-open support) -->
					<input
						bind:this={fileInputEl}
						type="file"
						accept="application/pdf"
						class="hidden"
						onchange={onFileChange}
					/>
				</div>
			{/if}
		</div>
		{#if !showInterestQuiz}
			<p class="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 text-center text-xs text-stone-600">
				<span> Tip: Don't have a resumé yet? Start your first project </span>
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
{#if showResumeAdded}
	<div
		class="fixed inset-0 z-[70] grid place-items-center bg-white/80 backdrop-blur-sm"
		aria-live="polite"
	>
		<div class="flex flex-col items-center text-stone-800">
			<CheckCircle size={200} duration={900} />
			<div class="mt-4 text-base font-semibold">Resumé added</div>
		</div>
	</div>
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
