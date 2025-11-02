<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		initialEndGoal?: string;
		onSubmit?: (payload: { endGoal: string }) => void;
	}

	const examples = [
		{ role: 'Firmware', company: 'Apple' },
		{ role: 'Robotics', company: 'Tesla' },
		{ role: 'Quant', company: 'Jane Street' }
	] as const;

	let { initialEndGoal = '', onSubmit = () => {} }: Props = $props();

	const [initialRole, initialCompany] = initialEndGoal.includes('@')
		? initialEndGoal
				.split('@')
				.map((part) => part.trim())
				.slice(0, 2)
		: ['', ''];

	let role = $state(initialRole ?? '');
	let company = $state(initialCompany ?? '');
	let touchedRole = $state(false);
	let touchedCompany = $state(false);

	let exampleIndex = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	const rolePlaceholder = $derived(examples[exampleIndex].role);
	const companyPlaceholder = $derived(examples[exampleIndex].company);

	let animateRole = $state(false);
	let animateCompany = $state(false);

	const rolePlaceholderClass = $derived(animateRole ? 'placeholder-fade' : '');
	const companyPlaceholderClass = $derived(animateCompany ? 'placeholder-fade' : '');

	onMount(() => {
		intervalId = setInterval(() => {
			animateRole = true;
			animateCompany = true;
			setTimeout(() => {
				exampleIndex = (exampleIndex + 1) % examples.length;
				animateRole = false;
				animateCompany = false;
			}, 250);
		}, 2200);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});

	function handleSubmit() {
		if (!role.trim()) touchedRole = true;
		if (!company.trim()) touchedCompany = true;
		if (!role.trim() || !company.trim()) return;

		const endGoal = `${role.trim()} @ ${company.trim()}`;
		onSubmit({ endGoal });
	}
</script>

<section class="flex h-full w-full max-w-3xl flex-col justify-center space-y-10">
	<header class="space-y-4">
		<h1 class="text-4xl font-semibold tracking-tight text-stone-900">What is your dream job?</h1>
		<p class="text-base text-stone-600">
			Vector generates daily tasks to help you build in-demand projects.
		</p>
	</header>

	<div class="space-y-6">
		<div class="flex flex-col gap-4 bg-stone-50 md:flex-row md:items-center md:gap-3">
			<input
				type="text"
				class={`w-full border-0 bg-transparent px-0 py-3 font-mono text-4xl text-stone-900 transition-all placeholder:text-stone-400 focus:border-stone-700 focus:ring-0 focus:outline-none ${rolePlaceholderClass}`}
				placeholder={rolePlaceholder}
				bind:value={role}
				onblur={() => (touchedRole = true)}
				autofocus
			/>
			<span class="self-center px-2 text-4xl font-semibold text-stone-400">@</span>
			<input
				type="text"
				class={`w-full border-0 bg-transparent px-0 py-3 font-mono text-4xl text-stone-900 transition-all placeholder:text-stone-400 focus:border-stone-700 focus:ring-0 focus:outline-none ${companyPlaceholderClass}`}
				placeholder={companyPlaceholder}
				bind:value={company}
				onblur={() => (touchedCompany = true)}
			/>
		</div>
	</div>

	<footer class="flex items-center justify-end">
		<button
			type="button"
			onclick={handleSubmit}
			disabled={!role.trim() || !company.trim()}
			class="inline-flex h-10 w-10 items-center justify-center text-stone-700 transition hover:border-stone-500 hover:text-stone-900"
			aria-label="Continue"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</footer>
</section>

<style>
	:global(.placeholder-fade::placeholder) {
		opacity: 0;
		transition: opacity 0.2s ease-in-out;
	}

	:global(input::placeholder) {
		transition: opacity 0.2s ease-in-out;
	}
</style>
