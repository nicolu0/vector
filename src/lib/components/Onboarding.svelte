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

	onMount(() => {
		intervalId = setInterval(() => {
			exampleIndex = (exampleIndex + 1) % examples.length;
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

<section class="flex h-full w-full max-w-3xl flex-col justify-center">
	<header class="space-y-4">
		<h1 class="text-4xl font-semibold tracking-tight text-stone-900">What is your dream job?</h1>
		<p class="text-base text-stone-600">
			Vector generates daily tasks that get you there one step at a time.
		</p>
	</header>

	<div class="space-y-6">
		<div class="flex flex-col gap-4 bg-stone-50 md:flex-row md:items-center md:gap-3">
			<input
				type="text"
				class="w-full border-0 border-b-1 border-stone-300 bg-transparent px-0 py-3 text-lg text-stone-900 transition-colors placeholder:text-stone-400 focus:border-stone-700 focus:ring-0 focus:outline-none"
				placeholder={rolePlaceholder}
				bind:value={role}
				onblur={() => (touchedRole = true)}
				autofocus
			/>
			<span class="self-center px-2 text-lg font-semibold text-stone-400">@</span>
			<input
				type="text"
				class="w-full border-0 border-b-1 border-stone-300 bg-transparent px-0 py-3 text-lg text-stone-900 transition-colors placeholder:text-stone-400 focus:border-stone-700 focus:ring-0 focus:outline-none"
				placeholder={companyPlaceholder}
				bind:value={company}
				onblur={() => (touchedCompany = true)}
			/>
		</div>
	</div>

	<footer class="mt-8 flex items-center justify-end gap-3">
		<button
			type="button"
			class="rounded-xl bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
			onclick={handleSubmit}
			disabled={!role.trim() || !company.trim()}
		>
			Save & Continue
		</button>
	</footer>
</section>
