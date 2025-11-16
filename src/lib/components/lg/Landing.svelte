<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	const EMAIL = '21andrewch@gmail.com';
	let copied = false;
	let hovering = false;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		try {
			await navigator.clipboard.writeText(EMAIL);
			copied = true;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 3000);
		} catch {}
	}
</script>

<section
	class="flex h-full w-full flex-col items-center justify-center selection:bg-stone-600 selection:text-stone-50"
	style="font-family: 'Cormorant Garamond', serif"
>
	<div class="flex max-w-xl flex-col">
		<h2 class="line mb-1 text-xl tracking-wide text-stone-700 italic">
			vector (v) <span style="font-family: 'Inter'">-</span> to find one's direction
		</h2>
		<p class="text-xl text-stone-600" style="font-family: 'Cormorant Garamond', serif">
			We help you build stand-out projects with daily tasks tailored to your goals, interests, and
			skill. generates daily tasks and resources to help you build in-demand projects. Vector
			generates
			<button
				onclick={() => goto('/demo')}
				class="italic underline decoration-[1px] underline-offset-2">demo project</button
			>
			daily tasks and resources to help you build in-demand projects.
		</p>
		<div class="line my-8 flex w-full items-center justify-center gap-4">
			<span class="h-px w-1/5 rounded-full bg-stone-200"></span>

			<img
				src="/mastery.svg"
				alt="mastery"
				class="pointer-events-none h-4 w-4 object-contain select-none"
			/>

			<span class="h-px w-1/5 rounded-full bg-stone-200"></span>
		</div>
		<h2 class="line mb-1 text-xl tracking-wide text-stone-700 italic">
			you (n) <span style="font-family: 'Inter'">-</span> an ambitious student
		</h2>
		<div class="text-xl text-stone-600" style="font-family: 'Cormorant Garamond', serif">
			Vector is looking to work with students interested in tech. If this is you,
			<span class="relative inline-block">
				<button
					class="italic underline decoration-[1px] underline-offset-2"
					onclick={copy}
					aria-describedby="contact-tip"
				>
					contact us
				</button>

				{#if copied}
					<div
						id="contact-tip"
						class="pointer-events-none absolute top-[110%] flex flex-row items-center gap-1 rounded-md bg-stone-700 px-2 py-1 text-xs whitespace-nowrap text-stone-50 shadow-md"
						in:fly={{ y: -2, duration: 200 }}
						out:fade={{ duration: 120 }}
					>
						{#if copied}
							<svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none">
								<path
									d="M7 12.5 L10.25 15.75 L16.75 9.25"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									pathLength="100"
									class="check"
									class:check-animated={copied}
								/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none"> </svg>
						{/if}
						Email copied to clipboard
					</div>
				{/if}
			</span>
		</div>
	</div>
</section>

<style>
	.check {
		/* Static checkmark: fully drawn */
		stroke-dasharray: none;
		stroke-dashoffset: 0;
	}

	.check-animated {
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
		animation: draw-check 200ms 100ms ease-out forwards;
	}

	@keyframes draw-check {
		from {
			stroke-dashoffset: 100;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
