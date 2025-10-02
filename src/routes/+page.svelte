<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import vectorUrl from '$lib/assets/vector.svg?url';

	const NAMES = [
		'steve jobs',
		'mark zuckerberg',
		'elon musk',
		'jeff bezos',
		'sam altman',
		'jensen huang'
	];

	let text = '';
	let i = 0,
		char = 0,
		typing = true;

	const TYPE_MS = 90,
		DELETE_MS = 60,
		HOLD_MS = 2000,
		GAP_MS = 250;

	let t: number | null = null;
	let joinRequested = false;
	let joinCompleted = false;

	let emailEl: HTMLInputElement | null = null;
	onMount(() => {
		const id = window.setTimeout(() => {
			if (emailEl) {
				emailEl.focus({ preventScroll: true });
				emailEl.select();
			}
		}, 0);
		return () => window.clearTimeout(id);
	});

	function tick() {
		if (joinCompleted) return;
		const current = NAMES[i];
		if (typing) {
			if (char < current.length) {
				text = current.slice(0, ++char);
				t = window.setTimeout(tick, TYPE_MS);
			} else {
				typing = false;
				const delay = joinRequested ? DELETE_MS : HOLD_MS;
				t = window.setTimeout(tick, delay);
			}
		} else {
			if (char > 0) {
				text = current.slice(0, --char);
				t = window.setTimeout(tick, DELETE_MS);
			} else {
				if (joinRequested) {
					text = '';
					joinCompleted = true;
					t = null;
					return;
				}
				typing = true;
				i = (i + 1) % NAMES.length;
				t = window.setTimeout(tick, GAP_MS);
			}
		}
	}

	function requestJoin() {}

	onMount(tick);
	onDestroy(() => {
		if (t !== null) window.clearTimeout(t);
	});
</script>

<div class="flex min-h-dvh w-full flex-col items-center justify-center gap-12 bg-stone-50 px-6">
	<div class="flex w-full max-w-sm flex-col gap-2">
		<div>
			<div class="flex flex-row items-center gap-3">
				<img src={vectorUrl} alt="vector" class="h-8 w-8" />
				<div class="font-mono text-4xl text-[#2D2D2D]">vector</div>
			</div>

			<div class="w-full justify-center font-mono text-lg text-[#666]">
				<div class="headline flex items-baseline" aria-live="polite">
					<span class="prefix mr-1">become the next</span>
					<span class="type-box text-[#2D2D2D]">
						<span class="typed">{text}</span>
					</span>
				</div>
			</div>
		</div>
	</div>

	<div class="flex w-full max-w-sm flex-row items-center gap-6">
		<input
			bind:this={emailEl}
			class="waitlist-input w-full border-0 border-b-1 border-[#2D2D2D]/30 bg-transparent font-mono !text-[#2D2D2D] transition
         selection:bg-[#2D2D2D] selection:text-stone-50
          focus:ring-0 focus:outline-none"
			placeholder="join the waitlist w/ email"
			type="email"
			inputmode="email"
			autocomplete="email"
		/>
		<button
			type="button"
			class="flex items-center rounded-md px-2 font-mono text-xs text-[#2D2D2D]
         transition hover:translate-x-1 hover:text-[#2D2D2D]
         focus-visible:outline-1 focus-visible:outline-[#2D2D2D]"
			aria-label="Next"
			onclick={requestJoin}
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
				<line
					x1="14"
					y1="12"
					x2="10"
					y2="8"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
				<line
					x1="14"
					y1="12"
					x2="10"
					y2="16"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
</div>

<style>
	.headline {
		column-gap: 0.5ch;
		white-space: nowrap;
	}

	.type-box {
		width: 100%;
		display: inline-flex;
		align-items: baseline;
		white-space: nowrap;
		overflow: hidden;
		position: relative;
	}

	.typed {
		padding-right: 1px;
		padding-bottom: 1px;
		line-height: 1em;
		display: inline-block;
		animation: caret-blink 1s step-end infinite;
	}

	.waitlist-input {
		background: transparent;
		padding: 0;
		color: color-mix(in srgb, black 60%, transparent);
	}

	.waitlist-input:focus {
		outline: none;
		color: black;
	}

	.waitlist-input::placeholder {
		color: color-mix(in srgb, black 35%, transparent);
	}

	@keyframes caret-blink {
		0%,
		20%,
		100% {
			border-right-color: currentColor;
		}
		50% {
			border-right-color: color-mix(in oklab, currentColor 0%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.typed {
			animation: none;
		}
	}
</style>
