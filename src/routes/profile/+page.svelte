<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	let signingOut = $state(false);
	let signOutError = $state<string | null>(null);
	let userEmail = $state<string | null>(null);

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();

		userEmail = session?.user.email ?? null;
	});

	async function clearSupabaseSession() {
		const auth = supabase.auth as unknown as {
			_removeSession?: () => Promise<void>;
			storageKey?: string;
		};
		if (typeof auth?._removeSession === 'function') {
			await auth._removeSession();
			return;
		}
		if (typeof window === 'undefined') return;
		const storageKey = typeof auth?.storageKey === 'string' ? auth.storageKey : 'supabase.auth.token';
		try {
			window.localStorage.removeItem(storageKey);
			window.localStorage.removeItem(`${storageKey}-code-verifier`);
			window.localStorage.removeItem(`${storageKey}-user`);
		} catch (err) {
			console.warn('Failed to clear Supabase session storage', err);
		}
	}

	async function signOut() {
		if (signingOut) return;
		signOutError = null;
		signingOut = true;

		try {
			const { error } = await supabase.auth.signOut({ scope: 'global' });
			const sessionMissing =
				(error && 'name' in error && error.name === 'AuthSessionMissingError') ||
				(error && 'message' in error && /auth session missing/i.test(error.message));
			if (error && !sessionMissing) {
				throw error;
			}
			await clearSupabaseSession();
			userEmail = null;
			await invalidateAll();
			await goto('/');
		} catch (err) {
			signOutError = err instanceof Error ? err.message : 'Unable to sign out right now.';
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Profile • Vector</title>
</svelte:head>

<div class="min-h-dvh w-full bg-stone-50 px-6 py-4 text-stone-800">
	<div class="mx-auto w-full max-w-4xl space-y-6">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight text-stone-900">Profile</h1>
			<p class="mt-3 text-sm text-stone-500">Manage your account and connected services.</p>
		</div>

		<section
			class="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
		>
			<h2 class="text-sm font-semibold tracking-tight text-stone-900">Account</h2>
			<p class="mt-2 text-sm text-stone-600">
				{#if userEmail}
					Signed in as <span class="font-medium text-stone-800">{userEmail}</span>
				{:else}
					Signed in user details unavailable.
				{/if}
			</p>

			<div class="mt-5 flex flex-col gap-2">
				<button
					type="button"
					disabled={signingOut}
					class="inline-flex w-fit items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
					on:click={signOut}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M10 17l5-5-5-5" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M4 12h11" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M18 19V5" stroke-linecap="round" />
					</svg>
					{signingOut ? 'Signing out…' : 'Sign out'}
				</button>
				{#if signOutError}
					<p class="text-xs text-rose-600">{signOutError}</p>
				{/if}
			</div>
		</section>
	</div>
</div>
