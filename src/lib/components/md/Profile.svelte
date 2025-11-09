<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	let {
		name = 'User',
		email = '',
		sidebarCollapsed = false,
		avatarUrl = '',
		onSignOut,
		onResetProgress = null
	} = $props<{
		name?: string;
		email?: string;
		sidebarCollapsed?: boolean;
		avatarUrl?: string;
		onSignOut: () => void;
		onResetProgress?: (() => Promise<void>) | null;
	}>();

	let open = $state(false);
	let resetting = $state(false);
	let resetError = $state<string | null>(null);

	function close() {
		open = false;
	}
	function toggle() {
		open = !open;
	}
	function backdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}
	function esc(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function run(cb?: () => void) {
		close();
		cb?.();
	}

	async function handleReset() {
		if (!onResetProgress || resetting) return;
		resetError = null;
		resetting = true;
		try {
			await onResetProgress();
			close();
		} catch (err) {
			console.error('Failed to reset progress', err);
			resetError = 'Could not reset progress. Try again.';
		} finally {
			resetting = false;
		}
	}
</script>

<div class="p-2">
	<button
		type="button"
		class="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-stone-200/70"
		onclick={toggle}
		aria-haspopup="dialog"
		aria-expanded={open}
	>
		{#if avatarUrl}
			<img src={avatarUrl} alt="" class="h-7 w-7 rounded-full object-cover" />
		{:else}
			<span class="font-mono tracking-tighter text-stone-500">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					shape-rendering="geometricPrecision"
					class="h-4 w-4 transition-colors duration-200"
				>
					<path d="M20 21.5v-2.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2.5h16" />
					<circle cx="12" cy="7" r="4" />
				</svg>
			</span>
		{/if}
		{#if !sidebarCollapsed}
			<div class="flex flex-col">
				<span class="text-xs font-medium">Profile</span>
			</div>
		{/if}
	</button>
</div>

{#if open}
	<div
		in:fade={{ duration: 150 }}
		class="fixed bottom-16 left-2 z-[120] flex items-start justify-end"
		role="dialog"
		aria-modal="true"
		aria-label="Profile menu"
		onclick={backdrop}
		onkeydown={esc}
		tabindex="-1"
	>
		<!-- Panel -->
		<div
			in:scale={{ start: 0.98, duration: 150 }}
			class="inset-0 rounded-2xl border border-stone-200 bg-white/95 p-2 text-stone-800 shadow-[0_20px_60px_rgba(15,15,15,0.18)] backdrop-blur"
		>
			<div class="px-3 py-2 text-xs font-medium text-stone-500">{email}</div>

			<ul class="py-1 text-sm">
				{#if onResetProgress}
					<li>
						<button
							class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
							onclick={handleReset}
							aria-label="Reset progress"
							disabled={resetting}
						>
							<span>Reset progress</span>
							{#if resetting}
								<svg
									viewBox="0 0 24 24"
									class="h-4 w-4 animate-spin text-stone-500"
									fill="none"
									aria-hidden="true"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									/>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 0 1 8-8v4l3-3-3-3v0a12 12 0 0 0-12 12h4Z"
									/>
								</svg>
							{/if}
						</button>
					</li>
				{/if}
				<li>
					<a
						href="https://buy.stripe.com/4gM9AS4VZbSY0OU9he9R602"
						target="_blank"
						rel="noreferrer"
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100"
						aria-label="Open pricing"
					>
						Pricing
					</a>
				</li>
				<li>
					<button
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose-700 hover:bg-rose-50"
						onclick={() => run(onSignOut)}
						aria-label="Sign out"
					>
						Log out
					</button>
				</li>
			</ul>

			{#if resetError}
				<div class="px-3 pb-2 text-xs text-rose-600">{resetError}</div>
			{/if}
		</div>
	</div>
{/if}
