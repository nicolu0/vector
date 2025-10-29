<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { fade, blur, slide, scale } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import '../app.css';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import favicon from '$lib/assets/favicon.svg';
	import { setContext } from 'svelte';

	type AuthUI = {
		openAuthModal: () => void;
	};
	type OnboardingUI = {
		openOnboarding: () => void;
	};
	type AuthStateUI = {
		resetUserState: () => void;
	};

	let { children } = $props();

	let userExists = $state(false);
	let credits: number | null = $state(null);

	let showAuthModal = $state(false);
	let authLoading = $state(false);
	let authError: string | null = $state(null);

	type OnboardingAnswers = {
		education: 'high_school' | 'college' | null;
		goal: 'full_time' | 'internship' | 'explore' | null;
		project: 'research' | 'industry' | null;
	};

	let showOnboarding = $state(false);
	let onboardingSubmitting = $state(false);
	let onboardingError: string | null = $state(null);
	let onboardingAnswers: OnboardingAnswers = $state({
		education: null,
		goal: null,
		project: null
	});
	function resetUserState() {
		userExists = false;
		credits = null;
		showOnboarding = false;
		onboardingAnswers = {
			education: null,
			goal: null,
			project: null
		};
	}

	async function fetchCredits(userId: string) {
		const { data, error } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', userId)
			.maybeSingle();
		if (!error && data && typeof data.credits === 'number') {
			credits = data.credits;
		} else {
			credits = null;
		}
	}

	async function fetchOnboardingFromDB(userId: string) {
		const { data, error } = await supabase
			.from('users')
			.select('edu_level, goal, project_type')
			.eq('user_id', userId)
			.maybeSingle();
		if (error) throw error;

		const education =
			data?.edu_level === 'high_school' || data?.edu_level === 'college' ? data.edu_level : null;
		const goal =
			data?.goal === 'full_time' || data?.goal === 'internship' || data?.goal === 'explore'
				? data.goal
				: null;
		const project =
			data?.project_type === 'research' || data?.project_type === 'industry'
				? data.project_type
				: null;

		onboardingAnswers = { education, goal, project };
		showOnboarding = !education || !goal || !project; // mounts -> transitions run
	}

	function openOnboarding() {
		showOnboarding = true;
	}
	function openAuthModal() {
		showAuthModal = true;
		authLoading = false;
	}
	function closeAuthModal() {
		if (authLoading) return;
		showAuthModal = false;
		authError = null;
	}

	onMount(() => {
		(async () => {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			userExists = Boolean(user);
			if (user) {
				await fetchCredits(user.id);
				await fetchOnboardingFromDB(user.id);
			}
		})();
	});

	async function handleOnboardingSubmit(answers: {
		education: 'high_school' | 'college';
		goal: 'full_time' | 'internship' | 'explore';
		project: 'research' | 'industry';
	}) {
		if (onboardingSubmitting) return;
		onboardingError = null;
		onboardingSubmitting = true;

		try {
			const {
				data: { user },
				error: uerr
			} = await supabase.auth.getUser();
			if (uerr) throw uerr;
			if (!user) throw new Error('Not signed in');

			const { error } = await supabase
				.from('users')
				.upsert(
					{
						user_id: user.id,
						edu_level: answers.education,
						goal: answers.goal,
						project_type: answers.project
					},
					{ onConflict: 'user_id' }
				)
				.select('user_id');

			if (error) throw error;

			await fetchOnboardingFromDB(user.id);
			if (!showOnboarding) {
				onboardingError = null;
			}
		} catch (err) {
			onboardingError =
				err instanceof Error ? err.message : 'Unable to save your onboarding answers.';
		} finally {
			onboardingSubmitting = false;
		}
	}

	async function signInWithGoogle() {
		if (authLoading) return;
		authLoading = true;
		authError = null;

		try {
			const redirectTo = browser ? `${window.location.origin}/profile` : undefined;
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: redirectTo,
					queryParams: { prompt: 'select_account' }
				}
			});
			if (error) throw error;
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Unexpected error signing in.';
			authLoading = false;
		}
	}
	const authApi: AuthUI = { openAuthModal };
	setContext('auth-ui', authApi);
	const onboardingApi: OnboardingUI = { openOnboarding };
	setContext('onboarding-ui', onboardingApi);
	const authStateApi: AuthStateUI = { resetUserState };
	setContext('auth-state', authStateApi);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden">
	<header
		class="sticky top-0 z-[70] flex w-full items-center justify-between border border-b-1 border-stone-200 bg-stone-50 px-6 py-4"
	>
		<button class="flex items-center gap-2" onclick={() => goto('/')}>
			<img src={vectorUrl} alt="vector" class="h-4 w-4" />
			<span class="font-mono tracking-tight">vector</span>
		</button>

		<div class="flex items-center gap-4">
			{#if userExists}
				<button
					onclick={() => goto('/dashboard')}
					class="rounded-md py-1 text-xs text-stone-700 hover:text-stone-500">Dashboard</button
				>
				<button
					onclick={() => goto('/profile')}
					class="rounded-md py-1 text-xs font-medium text-stone-700 hover:text-stone-500"
					>Profile</button
				>
			{:else}
				<button
					onclick={() => openAuthModal()}
					class="rounded-md bg-stone-800 px-3 py-1 text-xs font-medium text-stone-50 hover:bg-stone-600"
					>Sign in</button
				>
			{/if}
		</div>
	</header>

	<main id="app-main" class="overflow-clipped min-h-0 flex-1">
		{@render children()}
	</main>

	{#if showAuthModal}
		<div
			in:fade={{ duration: 200 }}
			class="fixed inset-0 z-[120] flex items-center justify-center bg-stone-50/80"
			role="dialog"
			aria-modal="true"
			aria-label="Sign in"
			tabindex="-1"
			onclick={(e) => {
				if (!authLoading && e.target === e.currentTarget) closeAuthModal();
			}}
			onkeydown={(e) => {
				if (!authLoading && e.key === 'Escape') closeAuthModal();
			}}
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
						onclick={closeAuthModal}
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
					Create an account to save projects and receive detailed guidance.
				</p>

				<button
					type="button"
					onclick={signInWithGoogle}
					disabled={authLoading}
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
					</svg> <span>{authLoading ? 'Redirecting…' : 'Continue with Google'}</span>
				</button>

				{#if authError}
					<p class="mt-3 text-xs text-rose-600">{authError}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
