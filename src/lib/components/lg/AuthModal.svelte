<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	let {
		open = false,
		signInWithGoogle,
		onClose
	} = $props<{
		open?: boolean;
		signInWithGoogle: () => void;
		onClose?: () => void;
	}>();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

{#if open}
	<div
		in:fade={{ duration: 200 }}
		class="fixed inset-0 z-[120] flex items-center justify-center bg-stone-50/80"
		role="dialog"
		aria-modal="true"
		aria-label="Sign in"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div
			in:scale={{ start: 0.9, duration: 200 }}
			class="w-full max-w-sm rounded-3xl border border-stone-200 bg-white/95 p-6 text-stone-800 shadow-[0_12px_32px_rgba(15,15,15,0.12)]"
		>
			<div class="flex items-center justify-between">
				<div class="text-sm font-semibold tracking-tight text-stone-900">Sign in to Vector</div>
				<button
					type="button"
					class="rounded-full p-1 text-stone-500 hover:text-stone-800"
					onclick={onClose}
					aria-label="Close sign in"
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
			</div>

			<p class="mt-2 text-xs text-stone-500">
				Save your profile and current task. Track your progress and generate new tasks daily.
			</p>

			<button
				type="button"
				onclick={signInWithGoogle}
				class="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="#4285F4"
						d="M23.25 12.273c0-.815-.066-1.411-.21-2.028H12.24v3.674h6.318c-.128 1.02-.82 2.556-2.357 3.588l-.021.138 3.422 2.652.237.024c2.178-1.924 3.411-4.756 3.411-8.248"
					/>
					<path
						fill="#34A853"
						d="M12.24 24c3.096 0 5.695-1.025 7.593-2.785l-3.62-2.803c-.968.673-2.266 1.144-3.973 1.144-3.036 0-5.613-2.025-6.53-4.82l-.135.011-3.542 2.732-.046.128C2.97 21.83 7.245 24 12.24 24"
					/>
					<path
						fill="#FBBC05"
						d="M5.71 14.736a7.32 7.32 0 0 1-.377-2.293c0-.799.138-1.57.363-2.293l-.006-.153-3.583-2.78-.117.053A11.735 11.735 0 0 0 0 12.443c0 1.924.463 3.741 1.27 5.27z"
					/>
					<path
						fill="#EA4335"
						d="M12.24 4.754c2.154 0 3.605.93 4.434 1.707l3.237-3.16C17.92 1.24 15.336 0 12.24 0 7.245 0 2.97 2.17 1.27 7.173l3.426 2.707c.918-2.796 3.495-5.126 7.544-5.126"
					/>
				</svg>
				<span>Continue with Google</span>
			</button>
		</div>
	</div>
{/if}
