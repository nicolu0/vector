<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type Tone = 'neutral' | 'success' | 'warning' | 'danger';

	const props = $props<{
		message?: string;
		tone?: Tone;
		open?: boolean;
		autoHide?: number;
	}>();

	const message = $derived<string>(props.message ?? '');
	const tone = $derived<Tone>(props.tone ?? 'neutral');
	const open = $derived<boolean>(props.open ?? false);
	const autoHide = $derived<number>(props.autoHide ?? 4000);

	const dispatch = createEventDispatcher<{ dismiss: void }>();

	let timeout: ReturnType<typeof setTimeout> | undefined;

	const toneStyles: Record<Tone, { container: string; accent: string; close: string }> = {
		neutral: {
			container:
				'border-stone-200 bg-white text-stone-700 shadow-[0_12px_24px_rgba(15,23,42,0.08)]',
			accent: 'bg-stone-300/80',
			close: 'text-stone-400 hover:text-stone-600'
		},
		success: {
			container:
				'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_12px_24px_rgba(16,185,129,0.18)]',
			accent: 'bg-emerald-500',
			close: 'text-emerald-500/80 hover:text-emerald-700'
		},
		warning: {
			container:
				'border-amber-200 bg-amber-50 text-amber-900 shadow-[0_12px_24px_rgba(245,158,11,0.2)]',
			accent: 'bg-amber-500',
			close: 'text-amber-500/80 hover:text-amber-700'
		},
		danger: {
			container:
				'border-rose-200 bg-rose-50 text-rose-900 shadow-[0_12px_24px_rgba(244,63,94,0.2)]',
			accent: 'bg-rose-500',
			close: 'text-rose-500/80 hover:text-rose-700'
		}
	};

	const toneIcons: Record<Tone, string> = {
		neutral:
			'M12 6.75a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.5a.75.75 0 0 1 .75-.75Zm0 9a.88.88 0 1 1 0-1.75.88.88 0 0 1 0 1.75Z',
		success:
			'M9.75 13.19 7.28 10.72a.75.75 0 1 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l6-6a.75.75 0 0 0-1.06-1.06L9.75 13.19Z',
		warning:
			'M11.47 7.77a.75.75 0 1 1 1.5 0l-.31 4a.44.44 0 0 1-.88 0l-.31-4Zm.53 8.23a.88.88 0 1 1 0-1.75.88.88 0 0 1 0 1.75Z',
		danger:
			'M9.22 8.28a.75.75 0 0 1 1.06 0L12 10l1.72-1.72a.75.75 0 1 1 1.06 1.06L13.06 11.06l1.72 1.72a.75.75 0 1 1-1.06 1.06L12 12.12l-1.72 1.72a.75.75 0 0 1-1.06-1.06L10.94 11.06 9.22 9.34a.75.75 0 0 1 0-1.06Z'
	};

	$effect(() => {
		if (!open || autoHide <= 0) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = undefined;
			}
			return;
		}

		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => dispatch('dismiss'), autoHide);

		return () => {
			if (timeout) {
				clearTimeout(timeout);
				timeout = undefined;
			}
		};
	});

	function handleDismiss() {
		dispatch('dismiss');
	}
</script>

{#if open}
	<div class="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
		<div
			class={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border px-4 py-3 pl-5 transition ${toneStyles[tone].container}`}
			role="status"
			aria-live="polite"
			onclick={handleDismiss}
			in:fly={{ y: 16, duration: 200 }}
			out:fade={{ duration: 150 }}
		>
			<div class="flex items-start gap-2">
				<div class="mt-0.5 inline-flex h-4 w-4 items-center justify-center">
					{#if tone === 'success'}
						<!-- Check Circle -->
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="9" />
							<path d="M8.5 12.5l2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{:else if tone === 'warning'}
						<!-- Warning Triangle -->
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="M12 3l9 16H3l9-16Z" stroke-linejoin="round" />
							<path d="M12 9v4" stroke-linecap="round" />
							<path d="M12 16.5h.01" stroke-linecap="round" />
						</svg>
					{:else if tone === 'danger'}
						<!-- X Circle -->
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="9" />
							<path d="M15 9l-6 6M9 9l6 6" stroke-linecap="round" />
						</svg>
					{:else}
						<!-- Info Circle (neutral) -->
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="9" />
							<path d="M12 8h.01" stroke-linecap="round" />
							<path d="M12 11v5" stroke-linecap="round" />
						</svg>
					{/if}
				</div>
				<p class="flex-1 text-xs leading-5">{message}</p>
			</div>
		</div>
	</div>
{/if}
