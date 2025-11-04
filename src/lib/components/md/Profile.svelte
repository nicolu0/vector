<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	let {
		name = 'User',
		email = '',
		sidebarCollapsed = false,
		avatarUrl = '',
		onSignOut
	} = $props<{
		name?: string;
		email?: string;
		sidebarCollapsed?: boolean;
		avatarUrl?: string;
		onSignOut: () => void;
	}>();

	let open = $state(false);

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

	// Small helper so clicking a menu item both closes and runs a callback
	function run(cb?: () => void) {
		close();
		cb?.();
	}
</script>

<!-- Trigger (fits your sidebar footer) -->
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
			<div class="h-7 w-7 rounded-full bg-stone-300" />
		{/if}
		{#if !sidebarCollapsed}
			<div class="flex flex-col">
				<span class="text-sm font-medium">{name}</span>
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
		</div>
	</div>
{/if}
