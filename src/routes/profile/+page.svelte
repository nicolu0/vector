<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';
	import { getContext, onMount, tick } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { hasVisitedRoute, markRouteVisited } from '$lib/stores/pageVisits';
	import Toast from '$lib/components/Toast.svelte';

	const routeVisitKey = 'profile';
	const initialShouldAnimate =
		typeof window === 'undefined' ? false : !hasVisitedRoute(routeVisitKey);
	if (typeof window !== 'undefined' && initialShouldAnimate) {
		markRouteVisited(routeVisitKey);
	}
	const shouldAnimateProfile = initialShouldAnimate;

	let signingOut = $state(false);
	let signOutError = $state<string | null>(null);
	let userEmail = $state<string | null>(null);
	let credits = $state<number | null>(null);
	let eduLevel = $state<string | null>(null);
	let goal = $state<string | null>(null);
	let projectType = $state<string | null>(null);

	const pretty = (v: string | null) =>
		v ? v.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Not set';

	type LayoutAuthStateApi = {
		resetUserState: () => void;
	};
	const layoutAuthState = getContext<LayoutAuthStateApi | null>('auth-state');

	type Plan = {
		name: string;
		price: string;
		cadence: string;
		description: string;
		features: string[];
		isCurrent?: boolean;
		compareAtPrice?: string;
		paymentLink?: string;
	};

	const plans: Plan[] = [
		{
			name: 'Free',
			price: '$0',
			cadence: 'forever',
			description: 'Explore Vector with one complimentary project credit.',
			features: ['1 project credit included', 'Regenerate saved projects', 'Community tips'],
			isCurrent: true
		},
		{
			name: 'Plus Weekly',
			price: '$6',
			cadence: 'per week',
			description: 'Stay in rhythm with fresh credits every week.',
			features: ['1 credit added every week', 'Priority project tuning', 'Cancel anytime'],
			paymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK_WEEKLY
		},
		{
			name: 'Plus Monthly',
			price: '$20',
			cadence: 'per month',
			description: 'Best for consistent builders working on multiple tracks.',
			compareAtPrice: '$24',
			features: [
				'5 credits refreshed monthly',
				'Email support with quick replies',
				'Early feature access'
			],
			paymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK_MONTHLY
		}
	];

	let checkoutLoading = $state<string | null>(null);
	let checkoutError = $state<string | null>(null);
	let checkoutMessage = $state<string | null>(null);
	type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';
	let toastOpen = $state(false);
	let toastMessage = $state('');
	let toastTone = $state<ToastTone>('neutral');

	async function showToast(message: string, tone: ToastTone = 'neutral') {
		toastMessage = message;
		toastTone = tone;
		toastOpen = false;
		await tick();
		toastOpen = true;
	}
	function hydrateOnboarding(
		row: { edu_level?: string | null; goal?: string | null; project_type?: string | null } | null
	) {
		eduLevel = row?.edu_level ?? null;
		goal = row?.goal ?? null;
		projectType = row?.project_type ?? null;
	}

	onMount(() => {
		const syncAccount = async () => {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			userEmail = user?.email ?? null;

			if (!user?.id) return;

			// 1) Try read
			const { data, error } = await supabase
				.from('users')
				.select('credits, edu_level, goal, project_type')
				.eq('user_id', user.id)
				.maybeSingle();

			if (!error && data) {
				if (typeof data.credits === 'number') credits = data.credits;
				hydrateOnboarding(data);
				return;
			}

			// 2) If row missing, create with defaults
			if (!error && data === null) {
				const { data: inserted, error: insertError } = await supabase
					.from('users')
					.insert({ user_id: user.id, credits: 1 }) // minimal bootstrap
					.select('credits, edu_level, goal, project_type')
					.single();

				if (!insertError && inserted) {
					credits = typeof inserted.credits === 'number' ? inserted.credits : 1;
					hydrateOnboarding(inserted);
					return;
				}

				// 3) Handle race on unique constraint
				if (insertError?.code === '23505') {
					const { data: existing } = await supabase
						.from('users')
						.select('credits, edu_level, goal, project_type')
						.eq('user_id', user.id)
						.single();

					if (existing) {
						if (typeof existing.credits === 'number') credits = existing.credits;
						hydrateOnboarding(existing);
					}
				}
			}
		};

		const handleCreditsUpdated = (event: Event) => {
			const detail = (event as CustomEvent<{ credits?: number | null }>).detail;
			if (typeof detail?.credits === 'number' || detail?.credits === null) {
				credits = detail.credits;
			}
		};

		// Initial sync
		syncAccount();
		void persistCachedProject();

		// Listen for credits updates from other parts of the app
		window.addEventListener('vector:credits-updated', handleCreditsUpdated);

		// Handle checkout querystring noise
		if (typeof window !== 'undefined') {
			const currentUrl = new URL(window.location.href);
			const status = currentUrl.searchParams.get('checkout');

			if (status === 'success') {
				checkoutMessage =
					'Success! Stripe is processing your subscription. Check your email for confirmation.';
			} else if (status === 'cancel') {
				checkoutError = 'Checkout was cancelled. You were not charged.';
			}

			if (status) {
				currentUrl.searchParams.delete('checkout');
				const nextQuery = currentUrl.searchParams.toString();
				const nextUrl = `${currentUrl.pathname}${nextQuery ? `?${nextQuery}` : ''}${currentUrl.hash}`;
				window.history.replaceState(null, '', nextUrl);
			}
		}

		return () => {
			window.removeEventListener('vector:credits-updated', handleCreditsUpdated);
		};
	});

	type CachedProject = {
		title: string;
		difficulty: string;
		timeline: string;
		description: string;
		jobs: unknown;
		skills: unknown;
	};

	async function persistCachedProject() {
		if (typeof window === 'undefined') return;
		const raw = sessionStorage.getItem('vector:cached-project');
		if (!raw) return;

		let project: CachedProject | null = null;
		try {
			project = JSON.parse(raw) as CachedProject;
		} catch {
			sessionStorage.removeItem('vector:cached-project');
			await showToast('We could not save that project. Please try again.', 'danger');
			return;
		}

		if (!project) return;

		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user?.id) {
			await showToast('Sign in to save your project to the dashboard.', 'warning');
			return;
		}

		const insertPayload = {
			user_id: user.id,
			title: project.title,
			difficulty: project.difficulty,
			timeline: project.timeline,
			description: project.description,
			jobs: project.jobs,
			skills: project.skills
		};

		const { error } = await supabase.from('projects').insert([insertPayload]);
		if (!error) {
			sessionStorage.removeItem('vector:cached-project');
			await showToast('Project saved to your dashboard.', 'success');
		} else {
			await showToast('We could not save that project. Please try again.', 'danger');
		}
	}

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
		const storageKey =
			typeof auth?.storageKey === 'string' ? auth.storageKey : 'supabase.auth.token';
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
			const { error } = await supabase.auth.signOut();
			console.log('error', error);
			const sessionMissing =
				(error && 'name' in error && error.name === 'AuthSessionMissingError') ||
				(error && 'message' in error && /auth session missing/i.test(error.message));
			if (error && !sessionMissing) {
				throw error;
			}
			await clearSupabaseSession();
			layoutAuthState?.resetUserState();
			userEmail = null;
			credits = null;
			await invalidateAll();
			await goto('/');
		} catch (err) {
			signOutError = err instanceof Error ? err.message : 'Unable to sign out right now.';
		} finally {
			signingOut = false;
		}
	}

	function handlePlanSelection(plan: Plan) {
		if (!plan.paymentLink || plan.isCurrent || checkoutLoading) return;
		checkoutError = null;
		checkoutMessage = null;
		checkoutLoading = plan.paymentLink;
		if (typeof window === 'undefined') {
			checkoutError = 'Checkout is only available in the browser.';
			checkoutLoading = null;
			return;
		}
		try {
			const url = new URL(plan.paymentLink, window.location.origin);
			window.location.assign(url.toString());
		} catch (err) {
			checkoutError = 'Unable to open checkout right now.';
			checkoutLoading = null;
		}
	}
</script>

<svelte:head>
	<title>Profile</title>
</svelte:head>

<div class="min-h-dvh w-full bg-stone-50 px-6 py-4 text-stone-800">
	<div class="mx-auto w-full max-w-5xl space-y-6">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight text-stone-800">Profile</h1>
		</div>

		{#if checkoutMessage}
			<div
				class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
			>
				{checkoutMessage}
			</div>
		{/if}

		{#if checkoutError}
			<div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
				{checkoutError}
			</div>
		{/if}

		<div class="mt-6 grid gap-4 md:grid-cols-3">
			{#each plans as plan, index}
				<div
					class="flex h-full flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
					in:fly|global={shouldAnimateProfile
						? { y: 10, duration: 500, easing: cubicOut, delay: index * 50 }
						: undefined}
				>
					<div class="space-y-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
								{plan.name}
							</p>
							<div class="mt-2 flex items-baseline gap-3">
								<div class="flex items-baseline gap-2">
									{#if plan.compareAtPrice}
										<span
											class="text-3xl font-medium text-stone-400 line-through decoration-stone-300 decoration-2"
										>
											{plan.compareAtPrice}
										</span>
									{/if}
									<span class="text-3xl font-semibold text-stone-900">{plan.price}</span>
									<span class="text-xs tracking-tight text-stone-500 uppercase">
										{plan.cadence}
									</span>
								</div>
							</div>
							<p class="mt-3 text-sm text-stone-600">{plan.description}</p>
						</div>

						<ul class="space-y-2 text-sm text-stone-700">
							{#each plan.features as feature}
								<li class="flex items-start gap-2">
									<span class="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-500" />
									<span>{feature}</span>
								</li>
							{/each}
						</ul>
					</div>

					<button
						type="button"
						class={`mt-6 inline-flex w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold tracking-tight transition ${
							plan.isCurrent
								? 'cursor-default border-stone-200 bg-stone-200 text-stone-500'
								: 'border-stone-900 bg-stone-900 text-stone-50 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60'
						}`}
						disabled={plan.isCurrent || !plan.paymentLink || checkoutLoading !== null}
						on:click={() => handlePlanSelection(plan)}
					>
						{#if plan.isCurrent}
							Current plan
						{:else if checkoutLoading === plan.paymentLink}
							Redirecting…
						{:else}
							Upgrade
						{/if}
					</button>
				</div>
			{/each}
		</div>
		<div
			class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700"
			in:fly|global={shouldAnimateProfile
				? { y: 10, duration: 500, easing: cubicOut, delay: 200 }
				: undefined}
		>
			<div class="flex items-center justify-between">
				<span class="font-medium text-stone-900">Credits</span>
				<span
					class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold tracking-tight text-stone-700"
				>
					{credits ?? 0} / 1
				</span>
			</div>
			<p class="mt-2 text-xs text-stone-500">
				Use one credit to generate a tailored project. Sign in again later to refresh your balance.
			</p>
		</div>
		<div class="mt-6 grid gap-4 md:grid-cols-3">
			<div
				class="flex h-full flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
				in:fly|global={shouldAnimateProfile
					? { y: 10, duration: 500, easing: cubicOut, delay: 300 }
					: undefined}
			>
				<div class="flex flex-row items-center justify-between">
					<p class="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Education</p>
					<span
						class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold tracking-tight text-stone-700"
					>
						{pretty(eduLevel)}
					</span>
				</div>
			</div>

			<!-- Goal -->
			<div
				class="flex h-full flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
				in:fly|global={shouldAnimateProfile
					? { y: 10, duration: 500, easing: cubicOut, delay: 300 }
					: undefined}
			>
				<div class="flex flex-row items-center justify-between">
					<p class="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Goal</p>
					<span
						class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold tracking-tight text-stone-700"
					>
						{pretty(goal)}
					</span>
				</div>
			</div>

			<div
				class="flex h-full flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
				in:fly|global={shouldAnimateProfile
					? { y: 10, duration: 500, easing: cubicOut, delay: 300 }
					: undefined}
			>
				<div class="flex flex-row items-center justify-between">
					<p class="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
						Project Type
					</p>
					<span
						class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold tracking-tight text-stone-700"
					>
						{pretty(projectType)}
					</span>
				</div>
			</div>
		</div>

		<section
			class="rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
			in:fly|global={shouldAnimateProfile
				? { y: 10, duration: 500, easing: cubicOut, delay: 500 }
				: undefined}
		>
			<h2 class="text-sm font-semibold tracking-tight text-stone-900">Account</h2>
			<p class="mt-2 text-sm text-stone-600">
				{#if userEmail}
					Signed in as <span class="font-medium text-stone-800">{userEmail}</span>
				{:else}
					Signed in user details unavailable.
				{/if}
			</p>

			<div class="mt-5 space-y-4">
				<div class="flex flex-col gap-2">
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
			</div>
		</section>
	</div>
</div>
<Toast
	message={toastMessage}
	tone={toastTone}
	open={toastOpen}
	on:dismiss={() => (toastOpen = false)}
/>
