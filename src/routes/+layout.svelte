<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { Session, User } from '@supabase/supabase-js';
	import { supabase } from '$lib/supabaseClient';
	import '../app.css';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import favicon from '$lib/assets/favicon.svg';
	import OnboardingFlow from '$lib/components/OnboardingFlow.svelte';

	type LayoutData = {
		user: User | null;
		credits: number | null;
	};

	type AuthIntent = 'general' | 'generate';
	type OnboardingAction = 'profile' | 'generate';
	type OnboardingAnswers = {
		education: 'high_school' | 'college' | null;
		goal: 'full_time' | 'internship' | 'explore' | null;
		project: 'research' | 'industry' | null;
	};

	type VectorOnboarding = {
		education?: 'high_school' | 'college';
		goal?: 'full_time' | 'internship' | 'explore';
		project?: 'research' | 'industry';
		completed?: boolean;
		updated_at?: string;
	} | null;

	const AUTH_INTENT_KEY = 'vector:auth-intent';

	function extractOnboarding(user: User | null): VectorOnboarding {
		if (!user || typeof user.user_metadata !== 'object') return null;
		const raw = (user.user_metadata as Record<string, unknown>).vector_onboarding;
		if (!raw || typeof raw !== 'object') return null;

		const candidate = raw as Record<string, unknown>;
		const education =
			candidate.education === 'high_school' || candidate.education === 'college'
				? candidate.education
				: undefined;
		const goal =
			candidate.goal === 'full_time' ||
			candidate.goal === 'internship' ||
			candidate.goal === 'explore'
				? candidate.goal
				: undefined;
		const project =
			candidate.project === 'research' || candidate.project === 'industry'
				? candidate.project
				: undefined;
		const completed = candidate.completed === true;
		const updated_at = typeof candidate.updated_at === 'string' ? candidate.updated_at : undefined;

		return {
			education,
			goal,
			project,
			completed,
			updated_at
		};
	}

	function isOnboardingComplete(data: VectorOnboarding): boolean {
		if (!data) return false;
		return Boolean(data.completed && data.education && data.goal && data.project);
	}

	function needsOnboarding(user: User | null): boolean {
		if (!user) return false;
		return !isOnboardingComplete(extractOnboarding(user));
	}

	let { children, data } = $props<{ children: () => unknown; data: LayoutData }>();

	let showAuthModal = $state(false);
	let authLoading = $state(false);
	let authError = $state<string | null>(null);
	let sessionExists = $state(Boolean(data?.user));
	let credits = $state<number | null>(data?.credits ?? null);
	let authIntent = $state<AuthIntent | null>(null);

	const initialOnboarding = extractOnboarding(data?.user ?? null);
	const initialNeedsOnboarding = Boolean(data?.user && !isOnboardingComplete(initialOnboarding));

	let onboardingAnswers = $state<OnboardingAnswers>({
		education: initialOnboarding?.education ?? null,
		goal: initialOnboarding?.goal ?? null,
		project: initialOnboarding?.project ?? null
	});
	let showOnboarding = $state(initialNeedsOnboarding);
	let onboardingSubmitting = $state(false);
	let onboardingError = $state<string | null>(null);
	let onboardingAction = $state<OnboardingAction | null>(initialNeedsOnboarding ? 'profile' : null);

	$effect(() => {
		sessionExists = Boolean(data?.user);
		credits = data?.credits ?? null;
	});

	function consumeStoredAuthIntent() {
		if (typeof window === 'undefined') return;
		try {
			const stored = window.sessionStorage.getItem(AUTH_INTENT_KEY);
			if (stored === 'generate' || stored === 'general') {
				authIntent = stored;
			}
			window.sessionStorage.removeItem(AUTH_INTENT_KEY);
		} catch (
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			_err
		) {
			// ignore
		}
	}

	function openAuthModal(message?: string, intent: AuthIntent = 'general') {
		authError = message ?? null;
		authLoading = false;
		authIntent = intent;
		showAuthModal = true;
	}

	function closeAuthModal() {
		if (authLoading) return;
		showAuthModal = false;
		authError = null;
	}

	function dispatchCreditsUpdated(value: number | null) {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(new CustomEvent('vector:credits-updated', { detail: { credits: value } }));
	}

	async function refreshCreditsFromSupabase() {
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			credits = null;
			dispatchCreditsUpdated(null);
			return;
		}

		const { data: row, error } = await supabase
			.from('users')
			.select('credits')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (!error && row && typeof row.credits === 'number') {
			credits = row.credits;
			dispatchCreditsUpdated(row.credits);
		}
	}

	function handleSignedInSession(session: Session, source: 'initial' | 'auth-change') {
		const onboarding = extractOnboarding(session.user);
		onboardingAnswers = {
			education: onboarding?.education ?? onboardingAnswers.education,
			goal: onboarding?.goal ?? onboardingAnswers.goal,
			project: onboarding?.project ?? onboardingAnswers.project
		};

		if (!isOnboardingComplete(onboarding)) {
			onboardingError = null;
			onboardingSubmitting = false;
			showOnboarding = true;
			onboardingAction = authIntent === 'generate' ? 'generate' : (onboardingAction ?? 'profile');
			return;
		}

		showOnboarding = false;
		onboardingAction = null;
		onboardingError = null;
		onboardingSubmitting = false;

		if (authIntent === 'generate') {
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('vector:auth-signed-in'));
			}
		} else if (authIntent === 'general' && source === 'auth-change') {
			goto('/profile');
		}

		authIntent = null;
	}

	onMount(() => {
		consumeStoredAuthIntent();

		supabase.auth.getSession().then(({ data: { session } }) => {
			sessionExists = Boolean(session);
			if (!session) {
				credits = null;
				return;
			}
			handleSignedInSession(session, 'initial');
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			sessionExists = Boolean(newSession);

			if (newSession) {
				authLoading = false;
				showAuthModal = false;
				refreshCreditsFromSupabase();
				handleSignedInSession(newSession, 'auth-change');
			} else {
				credits = null;
				dispatchCreditsUpdated(null);
				authIntent = null;
			}
		});

		const handleAuthRequired = (event: Event) => {
			const detail = (event as CustomEvent<{ message?: string; reason?: 'generate' }>).detail;
			const intent = detail?.reason === 'generate' ? 'generate' : 'general';
			openAuthModal(detail?.message ?? 'Sign in to claim your free project credit.', intent);
		};

		const handleCreditsUpdated = (event: Event) => {
			const detail = (event as CustomEvent<{ credits?: number | null }>).detail;
			if (typeof detail?.credits === 'number' || detail?.credits === null) {
				credits = detail.credits;
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && showAuthModal && !authLoading) {
				closeAuthModal();
			}
		};

		window.addEventListener('vector:auth-required', handleAuthRequired);
		window.addEventListener('vector:credits-updated', handleCreditsUpdated);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			subscription.unsubscribe();
			window.removeEventListener('vector:auth-required', handleAuthRequired);
			window.removeEventListener('vector:credits-updated', handleCreditsUpdated);
			window.removeEventListener('keydown', handleKeyDown);
		};
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
			const { error } = await supabase.auth.updateUser({
				data: {
					vector_onboarding: {
						education: answers.education,
						goal: answers.goal,
						project: answers.project,
						completed: true,
						updated_at: new Date().toISOString()
					}
				}
			});
			if (error) throw error;

			onboardingAnswers = {
				education: answers.education,
				goal: answers.goal,
				project: answers.project
			};
			onboardingSubmitting = false;
			showOnboarding = false;

			const nextAction =
				onboardingAction ??
				(authIntent === 'generate' ? 'generate' : ('profile' as OnboardingAction));

			const intentToUse = authIntent;
			onboardingAction = null;
			authIntent = null;

			if (intentToUse === 'generate' || nextAction === 'generate') {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('vector:auth-signed-in'));
				}
			} else if (nextAction === 'profile') {
				goto('/profile');
			}
		} catch (err) {
			onboardingSubmitting = false;
			onboardingError =
				err instanceof Error ? err.message : 'Unable to save your onboarding answers right now.';
		}
	}

	async function signInWithGoogle() {
		if (authLoading) return;
		authLoading = true;
		authError = null;

		const intent = authIntent ?? 'general';
		if (typeof window !== 'undefined') {
			try {
				window.sessionStorage.setItem(AUTH_INTENT_KEY, intent);
			} catch (
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				_err
			) {
				// ignore
			}
		}

		try {
			const { data: authData, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
					queryParams: {
						prompt: 'select_account'
					}
				}
			});
			if (error) throw error;
			if (authData?.url) {
				window.location.assign(authData.url);
			}
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Unexpected error signing in.';
			authLoading = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen transition-[filter,transform] duration-150 ease-out">
	{#if !$page.url.pathname.startsWith('/waitlist')}
		<header
			class="sticky top-0 z-[70] flex w-full items-center justify-between bg-stone-50 px-6 py-4"
		>
			<button
				class="flex items-center gap-2"
				onclick={() => {
					goto('/');
				}}
			>
				<img src={vectorUrl} alt="vector" class="h-4 w-4" />
				<span class="font-mono tracking-tight">vector</span>
			</button>

			<div class="flex items-center gap-4">
				{#if !sessionExists}
					<button
						class="rounded-md py-1 text-xs tracking-tight text-stone-700 transition hover:text-stone-500"
						>Pricing</button
					>
					<button
						class="rounded-md py-1 text-xs tracking-tight text-stone-700 transition hover:text-stone-500"
					>
						How it works
					</button>
				{/if}

				{#if sessionExists}
					<button
						onclick={() => goto('/dashboard')}
						class="rounded-md py-1 text-xs tracking-tight text-stone-700 transition hover:text-stone-500"
					>
						Dashboard
					</button>
					<button
						onclick={() => goto('/profile')}
						class="rounded-md bg-stone-800 px-3 py-1 text-xs font-medium tracking-tight text-stone-50 transition hover:bg-stone-600"
					>
						Profile
					</button>
				{:else}
					<button
						onclick={() => openAuthModal()}
						class="rounded-md bg-stone-800 px-3 py-1 text-xs font-medium tracking-tight text-stone-50 transition hover:bg-stone-600"
					>
						Sign in
					</button>
				{/if}
			</div>
		</header>
	{/if}

	{@render children()}

	{#if true}
		<OnboardingFlow
			onSubmit={handleOnboardingSubmit}
			submitting={onboardingSubmitting}
			error={onboardingError}
			initialAnswers={onboardingAnswers}
		/>
	{/if}

	{#if showAuthModal}
		<div
			class="fixed inset-0 z-[120] flex items-center justify-center bg-stone-50/80 transition"
			role="dialog"
			aria-modal="true"
			aria-label="Sign in"
			tabindex="-1"
			onclick={(event) => {
				if (authLoading) return;
				if (event.target === event.currentTarget) closeAuthModal();
			}}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !authLoading) closeAuthModal();
			}}
		>
			<div
				class="w-full max-w-sm rounded-3xl border border-stone-200 bg-white/95 p-6 text-stone-800 shadow-[0_12px_32px_rgba(15,15,15,0.12)]"
			>
				<div class="flex items-center justify-between">
					<div class="text-sm font-semibold tracking-tight text-stone-900">Sign in to Vector</div>
					<button
						type="button"
						class="rounded-full p-1 text-stone-500 transition hover:text-stone-800"
						onclick={closeAuthModal}
						title="Close sign in"
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
					</svg>
					<span>{authLoading ? 'Redirecting…' : 'Continue with Google'}</span>
				</button>

				{#if authError}
					<p class="mt-3 text-xs text-rose-600">{authError}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
