<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	type Answers = {
		education: 'high_school' | 'college' | null;
		goal: 'full_time' | 'internship' | 'explore' | null;
		project: 'research' | 'industry' | null;
	};

	const {
		onSubmit = (async () => {}) as (answers: {
			education: 'high_school' | 'college';
			goal: 'full_time' | 'internship' | 'explore';
			project: 'research' | 'industry';
		}) => Promise<void>,
		submitting = false,
		error = null as string | null,
		initialAnswers = {} as Partial<Answers>
	} = $props<{
		onSubmit?: (answers: {
			education: 'high_school' | 'college';
			goal: 'full_time' | 'internship' | 'explore';
			project: 'research' | 'industry';
		}) => Promise<void>;
		submitting?: boolean;
		error?: string | null;
		initialAnswers?: Partial<Answers>;
	}>();

	type StepId = 'education' | 'goal' | 'project';

	type StepOption = {
		value: 'high_school' | 'college' | 'full_time' | 'internship' | 'explore' | 'research' | 'industry';
		label: string;
		description: string;
	};

	type Step = {
		id: StepId;
		title: string;
		description: string;
		options: StepOption[];
	};

	const steps: Step[] = [
		{
			id: 'education',
			title: 'Where are you in school?',
			description: 'Pick the option that fits your current education level.',
			options: [
				{
					value: 'high_school',
					label: 'High school',
					description: 'Working toward your diploma or equivalent.'
				},
				{
					value: 'college',
					label: 'College / university',
					description: 'Enrolled in an undergraduate or graduate program.'
				}
			]
		},
		{
			id: 'goal',
			title: 'What are you aiming for?',
			description: 'We’ll align projects to support the outcome you care about most.',
			options: [
				{
					value: 'full_time',
					label: 'Land a full-time role',
					description: 'Prepare portfolio-ready work that impresses hiring managers.'
				},
				{
					value: 'internship',
					label: 'Land an internship',
					description: 'Show initiative with projects that stand out to recruiters.'
				},
				{
					value: 'explore',
					label: 'Learn and explore',
					description: 'Try new areas, build confidence, and discover what you enjoy.'
				}
			]
		},
		{
			id: 'project',
			title: 'What type of project fits best?',
			description: 'Choose the format you’d like Vector to prioritize.',
			options: [
				{
					value: 'research',
					label: 'Research-style deep dive',
					description: 'Structured investigations that highlight analysis and rigor.'
				},
				{
					value: 'industry',
					label: 'Industry-ready build',
					description: 'Deployed projects that mirror real-world products.'
				}
			]
		}
	];

	let stepIndex = $state(0);
	let answers = $state<Answers>({
		education: initialAnswers.education ?? null,
		goal: initialAnswers.goal ?? null,
		project: initialAnswers.project ?? null
	});

	const currentStep = $derived(steps[stepIndex]);
	const totalSteps = steps.length;
	const percentComplete = $derived(Math.round(((stepIndex + 1) / totalSteps) * 100));
	const progress = tweened(percentComplete, { duration: 240, easing: cubicOut });
	let canContinue = $state(false);

	function selectOption(value: StepOption['value']) {
		if (currentStep.id === 'education' && (value === 'high_school' || value === 'college')) {
			answers = {
				...answers,
				education: value
			};
		}
		if (currentStep.id === 'goal' && (value === 'full_time' || value === 'internship' || value === 'explore')) {
			answers = {
				...answers,
				goal: value
			};
		}
		if (currentStep.id === 'project' && (value === 'research' || value === 'industry')) {
			answers = {
				...answers,
				project: value
			};
		}
	}

	function isSelected(value: StepOption['value']) {
		return (
			(currentStep.id === 'education' && answers.education === value) ||
			(currentStep.id === 'goal' && answers.goal === value) ||
			(currentStep.id === 'project' && answers.project === value)
		);
	}

	$effect(() => {
		progress.set(percentComplete);

		if (currentStep.id === 'education') {
			canContinue = answers.education !== null;
			return;
		}
		if (currentStep.id === 'goal') {
			canContinue = answers.goal !== null;
			return;
		}
		canContinue = answers.project !== null;
	});

	async function next() {
		if (!canContinue || submitting) return;
		if (stepIndex < totalSteps - 1) {
			stepIndex += 1;
			return;
		}
		if (!answers.education || !answers.goal || !answers.project) return;
		await onSubmit({
			education: answers.education,
			goal: answers.goal,
			project: answers.project
		});
	}

	function back() {
		if (stepIndex === 0 || submitting) return;
		stepIndex -= 1;
	}
</script>

<div
	class="fixed inset-x-0 top-[56px] z-[110] flex h-[calc(100vh-56px)] items-center justify-center bg-stone-50 px-4 text-stone-900"
	role="dialog"
	aria-modal="true"
	aria-label="Vector onboarding"
>
	<div class="mb-16 flex max-h-[80vh] min-h-0 w-full max-w-3xl flex-col px-2 sm:px-4">
		<div class="space-y-3">
			<p class="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Step {stepIndex + 1} of {totalSteps}</p>
			<div>
				<h2 class="text-3xl font-semibold tracking-tight">{currentStep.title}</h2>
				<p class="mt-2 text-sm text-stone-600">{currentStep.description}</p>
			</div>
		</div>

		<div class="mt-6 grid gap-4 md:grid-cols-2">
			{#each currentStep.options as option}
				<button
					type="button"
					class={`min-h-[196px] w-full rounded-2xl border p-6 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 ${
						isSelected(option.value)
							? 'border-stone-900 bg-white shadow-[0_12px_32px_rgba(28,25,23,0.18)]'
							: 'border-stone-200 bg-white hover:scale-[1.02] hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(87,83,78,0.14)]'
					}`}
					onclick={() => selectOption(option.value)}
					aria-pressed={isSelected(option.value)}
					disabled={submitting}
				>
					<div class="flex h-full flex-col">
						<div
							class={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${
								isSelected(option.value) ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-stone-50 text-stone-700'
							}`}
						>
							{#if option.value === 'high_school'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M3 9.5L12 5l9 4.5-9 4.5-9-4.5Z" stroke-linecap="round" stroke-linejoin="round" />
									<path d="M6 11.25V15a6 6 0 0 0 12 0v-3.75" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							{:else if option.value === 'college'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" stroke-linejoin="round" />
									<path d="M7 12v4" stroke-linecap="round" />
									<path d="M17 12v4" stroke-linecap="round" />
									<path d="M5 20h14" stroke-linecap="round" />
								</svg>
							{:else if option.value === 'full_time'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M4 7h16v10H4z" stroke-linejoin="round" />
									<path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke-linecap="round" stroke-linejoin="round" />
									<path d="M7 11h10" stroke-linecap="round" />
								</svg>
							{:else if option.value === 'internship'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<rect x="3.5" y="6" width="17" height="12" rx="2" />
									<path d="M7 10h10" stroke-linecap="round" />
									<path d="M7 14h5" stroke-linecap="round" />
								</svg>
							{:else if option.value === 'explore'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M12 3v2" stroke-linecap="round" />
									<path d="M19.5 6.5 18 8" stroke-linecap="round" />
									<path d="M21 13h-2" stroke-linecap="round" />
									<path d="M5 13H3" stroke-linecap="round" />
									<path d="M6 6 4.5 4.5" stroke-linecap="round" />
									<circle cx="12" cy="13" r="5" />
									<path d="M12 10.5a2.5 2.5 0 0 0-2.5 2.857 2.5 2.5 0 0 1 2.143 2.143A2.5 2.5 0 0 0 14.5 12.5 2.5 2.5 0 0 1 12 10.5Z" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							{:else if option.value === 'research'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M9.5 4h5v6.5l2 2V20l-4.5-2L7.5 20v-7.5l2-2z" stroke-linejoin="round" />
									<path d="M15 10.5h4" stroke-linecap="round" />
								</svg>
							{:else if option.value === 'industry'}
								<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M4 20V8l6-4v16" stroke-linejoin="round" />
									<path d="m10 8 6-4v16" stroke-linejoin="round" />
									<path d="M4 20h16" stroke-linecap="round" />
									<path d="M8 12h1" stroke-linecap="round" />
									<path d="M14 12h1" stroke-linecap="round" />
								</svg>
							{/if}
						</div>
						<div class="flex-1 space-y-2">
							<div class="text-lg font-semibold">{option.label}</div>
							<p class="text-sm text-stone-600">{option.description}</p>
						</div>
						{#if isSelected(option.value)}
							<div class="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-tight text-stone-700">
								<svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.75">
									<path d="M4.5 10.5 8 14l7.5-7.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
								<span>Selected</span>
							</div>
						{/if}
					</div>
				</button>
			{/each}
		</div>

		{#if error}
			<div class="mt-6 rounded-full bg-rose-50 px-4 py-2 text-center text-xs font-semibold tracking-tight text-rose-600 sm:self-end">
				{error}
			</div>
		{/if}

		<div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
				onclick={back}
				disabled={stepIndex === 0 || submitting}
			>
				Back
			</button>
			<button
				type="button"
				class={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2 text-sm font-semibold tracking-tight transition ${
					canContinue && !submitting
						? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
						: 'bg-stone-300 text-stone-600'
				}`}
				onclick={next}
				disabled={!canContinue || submitting}
			>
				{stepIndex === totalSteps - 1 ? (submitting ? 'Saving…' : 'Finish') : 'Continue'}
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M5 12h14" stroke-linecap="round" />
					<path d="M13 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>
	</div>

	<div class="fixed inset-x-0 bottom-0 z-[120] bg-white/80 shadow-md backdrop-blur-sm">
		<div class="relative h-[3px] w-full overflow-hidden rounded-full bg-stone-200">
			<div class="relative h-full" style={`width:${$progress}%`}>
				<div class="absolute inset-0 rounded-full bg-stone-900"></div>
			</div>
		</div>
	</div>
</div>
