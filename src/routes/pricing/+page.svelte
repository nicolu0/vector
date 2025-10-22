<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { tick } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	// Page-only toast (reuse your app <Toast> if you prefer)
	let toastOpen = $state(false);
	let toastMessage = $state('');
	let toastTone = $state<'neutral' | 'success' | 'warning' | 'danger'>('neutral');
	async function showToast(msg: string, tone: typeof toastTone = 'neutral') {
		toastMessage = msg;
		tone && (toastTone = tone);
		toastOpen = false;
		await tick();
		toastOpen = true;
	}

	type Plan = {
		name: 'Free' | 'Plus Weekly' | 'Plus Monthly';
		price: string;
		cadence: string;
		description: string;
		features: string[];
		compareAtPrice?: string;
		paymentLink?: string;
		cta?: string;
		popular?: boolean;
	};

	const plans: Plan[] = [
		{
			name: 'Free',
			price: '$0',
			cadence: 'forever',
			description: 'Just upload your resumé to get started',
			features: [
				'AI powered resumé analysis',
				'Save projects to your dashboard',
				'1 suggested fix per existing project',
				'Generate 1 new project'
			],
			cta: 'Get started'
		},
		{
			name: 'Plus Weekly',
			price: '$15',
			cadence: 'per week',
			description: 'Reach your goals faster',
			features: [
				'Generate 1 new project per week',
				'Custom suggestions using job listings',
				'Tailored experience around your goals',
				'Unlimited improvements per project',
				'Unlimited messages with Vector',
				'Unlimited documentation generation',
				'Cancel anytime'
			],
			paymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK_WEEKLY,
			cta: 'Subscribe',
			popular: true
		},
		{
			name: 'Plus Monthly',
			price: '$50',
			cadence: 'per month',
			description: 'Become an expert',
			compareAtPrice: '$60',
			features: [
				'Generate 4 new project per month',
				'Custom suggestions using job listings',
				'Tailored experience around your goals',
				'Unlimited improvements per project',
				'Unlimited messages with Vector',
				'Unlimited documentation generation',
				'Cancel anytime'
			],
			paymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK_MONTHLY,
			cta: 'Subscribe'
		}
	];

	let checkoutLoading = $state<string | null>(null);
	let checkoutError = $state<string | null>(null);
	let checkoutMessage = $state<string | null>(null);

	function handlePlanSelection(plan: Plan) {
		if (!plan.paymentLink || checkoutLoading) return;
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
		} catch {
			checkoutError = 'Unable to open checkout right now.';
			checkoutLoading = null;
		}
	}

	// Optional: if user lands here after Stripe redirect (?checkout=success|cancel)
	if (typeof window !== 'undefined') {
		const currentUrl = new URL(window.location.href);
		const status = currentUrl.searchParams.get('checkout');
		if (status === 'success') {
			checkoutMessage =
				'Success! Stripe is processing your subscription. Watch your email for confirmation.';
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

	// Guard: if user isn’t signed in and tries to subscribe, nudge them
	async function requireAuthOrToast() {
		const { data } = await supabase.auth.getUser();
		if (!data?.user) {
			await showToast('Please sign in before subscribing.', 'warning');
			return false;
		}
		return true;
	}

	async function onSelect(plan: Plan) {
		if (plan.paymentLink) {
			if (!(await requireAuthOrToast())) return;
			handlePlanSelection(plan);
		} else {
			// Free plan -> suggest sign-in (if not) or go to app
			const { data } = await supabase.auth.getUser();
			if (!data?.user) {
				await showToast('Create an account to start for free.', 'neutral');
				// e.g., open your auth modal here
				return;
			}
			// e.g., navigate to dashboard if signed in
			window.location.assign('/dashboard');
		}
	}
</script>

<svelte:head>
	<title>Pricing — Vector</title>
	<meta
		name="description"
		content="Choose a Vector plan and turn projects into offers. Free, Weekly, and Monthly."
	/>
</svelte:head>

<div class="min-h-dvh w-full bg-stone-50 px-6 py-6 text-stone-800">
	<div class="mx-auto w-full max-w-6xl">
		<header class="mx-auto">
			<h1 class="text-4xl font-semibold tracking-tight text-stone-900">Pricing</h1>
			<p class="mt-3 text-stone-600">
				Become an expert with project-based learning. Upgrade your resumé and level up your skills.
				Improve existing projects or generate new ones.
			</p>

			{#if checkoutMessage}
				<div
					class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
				>
					{checkoutMessage}
				</div>
			{/if}
			{#if checkoutError}
				<div
					class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
				>
					{checkoutError}
				</div>
			{/if}
		</header>

		<!-- Plans -->
		<section class="mt-10 grid gap-5 md:grid-cols-3">
			{#each plans as plan, i}
				<article
					class={`flex h-full flex-col justify-between rounded-2xl border p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${
						plan.popular
							? 'border-stone-900 bg-stone-900 text-stone-50'
							: 'border-stone-200 bg-stone-50 text-stone-800'
					}`}
					in:fly|global={{ y: 12, duration: 500, easing: cubicOut, delay: i * 70 }}
				>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<p
								class={`text-xs font-semibold tracking-[0.18em] uppercase ${plan.popular ? 'text-stone-300' : 'text-stone-500'}`}
							>
								{plan.name}
							</p>
							{#if plan.popular}
								<span
									class="rounded-full border border-stone-700 bg-stone-800 px-2 py-0.5 text-[11px] font-semibold"
									>Most popular</span
								>
							{/if}
						</div>

						<div class="flex items-baseline gap-3">
							<div class="flex items-baseline gap-2">
								{#if plan.compareAtPrice}
									<span
										class={`text-3xl font-medium line-through decoration-2 ${plan.popular ? 'text-stone-400 decoration-stone-500' : 'text-stone-400 decoration-stone-300'}`}
									>
										{plan.compareAtPrice}
									</span>
								{/if}
								<span
									class={`text-4xl font-semibold ${plan.popular ? 'text-white' : 'text-stone-900'}`}
									>{plan.price}</span
								>
								<span
									class={`text-xs tracking-tight uppercase ${plan.popular ? 'text-stone-300' : 'text-stone-500'}`}
								>
									{plan.cadence}
								</span>
							</div>
						</div>

						<p class={`${plan.popular ? 'text-stone-200' : 'text-stone-600'} text-sm`}>
							{plan.description}
						</p>

						<ul class={`space-y-2 text-sm ${plan.popular ? 'text-stone-100' : 'text-stone-700'}`}>
							{#each plan.features as feature}
								<li class="flex items-start gap-2">
									<span
										class={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${plan.popular ? 'bg-stone-300' : 'bg-stone-500'}`}
									/>
									<span>{feature}</span>
								</li>
							{/each}
						</ul>
					</div>

					<button
						type="button"
						class={`mt-6 inline-flex w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold tracking-tight transition
							${
								plan.popular
									? 'border-stone-100 bg-stone-100 text-stone-900 hover:bg-white'
									: 'border-stone-900 bg-stone-900 text-stone-50 hover:bg-stone-700'
							}
						`}
						aria-label={`${plan.cta ?? 'Select'} ${plan.name}`}
						disabled={checkoutLoading !== null}
						on:click={() => onSelect(plan)}
					>
						{#if checkoutLoading === plan.paymentLink}
							Redirecting…
						{:else}
							{plan.cta ?? 'Select'}
						{/if}
					</button>
				</article>
			{/each}
		</section>
	</div>
</div>
