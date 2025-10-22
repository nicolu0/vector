<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, blur, scale, fly } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';
	import vectorUrl from '$lib/assets/vector.svg?url';

	type Status = 'idle' | 'loading' | 'success' | 'error';

	const dispatch = createEventDispatcher<{ close: void }>();

	let { open = false, canDismiss = true } = $props<{
		open?: boolean;
		canDismiss?: boolean;
	}>();

	let emailEl: HTMLInputElement | null = $state(null);
	let email = $state('');
	let status = $state<Status>('idle');
	let errMsg = $state('');

	let overlayEl: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!open || typeof window === 'undefined') return;
		const id = window.setTimeout(() => {
			if (overlayEl) {
				overlayEl.focus({ preventScroll: true });
			}
			if (emailEl) {
				emailEl.focus({ preventScroll: true });
				emailEl.select();
			}
		}, 0);

		return () => {
			window.clearTimeout(id);
		};
	});

	function attemptClose() {
		if (!canDismiss || status === 'loading') return;
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			attemptClose();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			attemptClose();
		}
	}

	function isValidEmail(s: string) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
	}

	async function requestJoin() {
		if (status === 'loading' || status === 'success') return;
		if (!isValidEmail(email)) {
			status = 'error';
			errMsg = 'enter a valid email';
			return;
		}
		status = 'loading';
		errMsg = '';
		const { error } = await supabase.from('waitlist').upsert({ email }, { onConflict: 'email' });
		if (error) {
			console.error(error);
			status = 'error';
			errMsg = 'failed to join, try again';
			return;
		}
		status = 'success';
		errMsg = '';
	}
</script>

{#if open}
	<div
		bind:this={overlayEl}
		in:blur={{ duration: 150 }}
		class="fixed inset-0 z-[999] flex items-center justify-center bg-stone-50 p-6"
		role="dialog"
		aria-modal="true"
		aria-label="Join the waitlist"
		tabindex="-1"
		onclick={handleBackdropClick}
	>
		<div
			in:fly={{ y: 8, delay: 200, duration: 180 }}
			class="relative w-full max-w-xl px-8 py-12 text-stone-800 sm:px-10"
		>
			{#if canDismiss}
				<button
					type="button"
					class="absolute top-4 right-4 rounded-full p-1 text-stone-500 transition hover:text-stone-800 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
					onclick={attemptClose}
					disabled={status === 'loading'}
					aria-label="Close waitlist"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 6l12 12M6 18L18 6" stroke-linecap="round" />
					</svg>
				</button>
			{/if}

			<div class="flex flex-col items-center gap-12 pt-6 sm:pt-4">
				<div class="flex w-full max-w-sm flex-col gap-2">
					<div>
						<div class="flex flex-row items-center gap-3">
							<img src={vectorUrl} alt="vector" class="h-8 w-8" />
							<div class="font-mono text-4xl text-[#2D2D2D]">vector</div>
						</div>

						<div class="w-full justify-center font-mono text-lg text-[#666]">
							<div class="headline flex items-baseline" aria-live="polite">
								<span class="prefix mr-1">be so good it feels like nepotism</span>
							</div>
						</div>
					</div>
				</div>

				<div class="flex w-full max-w-sm flex-col gap-3">
					<div class="flex w-full flex-row items-end gap-6">
						<div class="relative w-full" class:underline-shrink={status === 'success'}>
							{#if status !== 'success'}
								<input
									bind:this={emailEl}
									bind:value={email}
									class="waitlist-input w-full border-0 bg-transparent font-mono !text-[#2D2D2D]
             transition selection:bg-[#2D2D2D] selection:text-stone-50
             focus:ring-0 focus:outline-none"
									placeholder="join the waitlist w/ email"
									type="email"
									inputmode="email"
									autocomplete="email"
									onkeydown={(e) => {
										if (e.key === 'Enter') requestJoin();
									}}
									aria-invalid={status === 'error'}
									aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
								/>
							{:else}
								<div class="pb-1 font-mono text-sm text-[#2D2D2D]">you’re on the waitlist.</div>
							{/if}

							<span class="underline-bar" aria-hidden="true"></span>
						</div>
						<button
							type="button"
							class="group flex items-center self-end rounded-md px-2 font-mono text-xs text-[#2D2D2D]
         transition hover:text-[#2D2D2D]
         focus-visible:outline-1 focus-visible:outline-[#2D2D2D]"
							aria-label={status === 'success' ? 'Joined' : 'Next'}
							onclick={requestJoin}
							disabled={status === 'loading' || status === 'success'}
						>
							<span class="relative inline-block h-5 w-5">
								{#if status === 'loading'}
									<span
										class="absolute inset-0 animate-spin rounded-full border border-[#2D2D2D] border-t-transparent"
										aria-hidden="true"
									/>
								{:else if status === 'success'}
									<svg
										viewBox="0 0 24 24"
										class="check-svg absolute inset-0 -translate-y-0.5 text-[#2D2D2D]"
										fill="none"
										aria-hidden="true"
									>
										<!-- 1) check draws left→right -->
										<path d="M6 12l4 4 8-8" pathLength="1" class="check-path" />

										<!-- 2) tiny dot at the tip; pops in, then implodes -->
										<circle cx="18" cy="8" r="1.6" class="check-tip-dot" />
									</svg>
								{:else}
									<!-- Only the arrow moves on hover -->
									<svg
										viewBox="0 0 24 24"
										class="absolute inset-0 transition-transform duration-150 group-hover:translate-x-1"
										fill="none"
										aria-hidden="true"
									>
										<line
											x1="14"
											y1="12"
											x2="10"
											y2="8"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
										/>
										<line
											x1="14"
											y1="12"
											x2="10"
											y2="16"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
										/>
									</svg>
								{/if}
							</span>
						</button>
					</div>

					{#if status === 'error'}
						<p id="waitlist-error" class="font-mono text-xs text-rose-600">{errMsg}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.headline {
		column-gap: 0.5ch;
		white-space: nowrap;
	}

	.waitlist-input {
		background: transparent;
		padding: 0;
		color: color-mix(in srgb, black 60%, transparent);
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

	/* Draw left→right, then erase left→right (no fade) */
	.check-path {
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		fill: none;

		/* normalized length via pathLength="1" */
		stroke-dasharray: 1;
		stroke-dashoffset: 1;

		/* 1) draw (0→420ms), 2) small gap, 3) erase (0→1) from the start */
		animation:
			draw-check 420ms ease-out forwards,
			erase-check 320ms ease-in 1020ms forwards; /* start ~100ms after draw */
	}

	@keyframes draw-check {
		to {
			stroke-dashoffset: 0;
		} /* reveal left→right */
	}

	@keyframes erase-check {
		from {
			stroke-dashoffset: 0;
		} /* start fully drawn */
		to {
			stroke-dashoffset: -1;
		} /* erase left→right */
	}

	/* Reduced motion: show instantly, then hide instantly */
	@media (prefers-reduced-motion: reduce) {
		.check-path {
			animation: none;
			stroke-dashoffset: 0;
		}
		.check-tip-dot {
			animation: none;
			opacity: 0;
			transform: scale(0);
		}
	}

	/* Underline element under the input/text */
	.underline-bar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: color-mix(in srgb, #2d2d2d 30%, transparent);
		transform-origin: left; /* anchor on the left */
		transform: scaleX(1);
		opacity: 1;
		pointer-events: none;
	}

	.underline-shrink .underline-bar {
		animation: underline-shrink 200ms ease-in forwards;
		animation-delay: 1200ms;
	}

	@keyframes underline-shrink {
		to {
			transform: scaleX(0);
			opacity: 0;
		}
	}

	/* Prefer reduced motion: just hide it */
	@media (prefers-reduced-motion: reduce) {
		.underline-shrink .underline-bar {
			animation: none;
			transform: scaleX(0);
			opacity: 0;
		}
	}
</style>
