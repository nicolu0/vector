<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onSubmit?: () => void;
	}
	let { onSubmit = () => {} }: Props = $props();

	let goal = $state('');

	// Sentences to cycle (exact phrasings you asked for)
	const sentences = [
		'Quant at Jane Street',
		'Firmware at Apple',
		'Hardware at NVIDIA',
		'Robotics at Tesla',
		'ML research at Stanford'
	] as const;

	// Typewriter state
	let sIdx = $state(0); // which sentence
	let subIdx = $state(0); // character index
	let deleting = $state(false);
	let typed = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	const TYPING_MS = 55; // per char while typing
	const DELETING_MS = 35; // per char while deleting
	const HOLD_AFTER_TYPE = 1100; // pause when fully typed
	const HOLD_AFTER_DELETE = 350; // pause when fully deleted

	function loop() {
		const full = sentences[sIdx];

		if (!deleting) {
			// typing forward
			if (subIdx < full.length) {
				subIdx += 1;
				typed = full.slice(0, subIdx);
				timer = setTimeout(loop, TYPING_MS);
			} else {
				// reached end, hold, then start deleting
				timer = setTimeout(() => {
					deleting = true;
					loop();
				}, HOLD_AFTER_TYPE);
			}
		} else {
			// deleting backward
			if (subIdx > 0) {
				subIdx -= 1;
				typed = full.slice(0, subIdx);
				timer = setTimeout(loop, DELETING_MS);
			} else {
				// finished deleting; advance to next sentence
				deleting = false;
				sIdx = (sIdx + 1) % sentences.length;
				timer = setTimeout(loop, HOLD_AFTER_DELETE);
			}
		}
	}
	const enabled = $derived(goal.trim().length > 0);
	onMount(() => {
		loop();
	});
	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	function handleSubmit() {
		document.cookie = `vector:goal=${encodeURIComponent(goal)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
		onSubmit();
	}
</script>

<section class="flex h-full w-full max-w-3xl flex-col justify-center space-y-10">
	<header class="space-y-2">
		<h1 class="text-5xl font-semibold tracking-tight text-stone-900">What is your dream job?</h1>
		<p class="text-xl text-stone-600">
			Vector generates daily tasks and resources to help you build in-demand projects.
		</p>
	</header>

	<form class="space-y-6" onsubmit={handleSubmit}>
		<div class="flex flex-row gap-4 bg-stone-50">
			<input
				type="text"
				class="w-full border-0 bg-transparent px-0 py-3 font-mono text-4xl text-stone-900 caret-stone-700 transition-all placeholder:text-stone-400 focus:border-stone-700 focus:ring-0 focus:outline-none"
				placeholder={`${typed}`}
				bind:value={goal}
				autofocus
				autocomplete="off"
				spellcheck="false"
			/>

			<button
				type="submit"
				disabled={!enabled}
				aria-label="Continue"
				aria-disabled={!enabled}
				class={`inline-flex h-10 w-10 items-center justify-center self-center rounded-xl transition
    ${
			enabled
				? 'animate-nudge-right text-stone-900 hover:bg-stone-100'
				: 'cursor-not-allowed text-stone-400 opacity-60'
		}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-7 w-7"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>
	</form>
</section>

<style>
	/* Optional subtle placeholder fade on update */
	input::placeholder {
		transition: opacity 0.2s ease-in-out;
	}
	@keyframes nudge-right {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(6px);
		}
	}
	.animate-nudge-right {
		animation: nudge-right 1.25s ease-in-out infinite;
	}
</style>
