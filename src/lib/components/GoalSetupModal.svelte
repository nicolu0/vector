<script lang="ts">
	interface Props {
		open: boolean;
		initialEndGoal?: string;
		initialCurrentSkillLevel?: string;
		onClose?: () => void;
		onSubmit?: (payload: { endGoal: string; currentSkillLevel: string }) => void;
	}

	let {
		open,
		initialEndGoal = '',
		initialCurrentSkillLevel = '',
		onClose = () => {},
		onSubmit = () => {}
	}: Props = $props();

	let step = $state(0);
	let endGoal = $state(initialEndGoal);
	let currentSkillLevel = $state(initialCurrentSkillLevel);
	let touched = $state(false);

	function resetFromInitials() {
		endGoal = initialEndGoal;
		currentSkillLevel = initialCurrentSkillLevel;
		step = 0;
		touched = false;
	}

	$effect(() => {
		if (open) {
			resetFromInitials();
		}
	});

	function handleClose() {
		onClose();
	}

function handleNext() {
	if (step === 0) {
		if (!endGoal.trim()) {
			touched = true;
			return;
		}
		step = 1;
		touched = false;
		return;
	}

	if (!currentSkillLevel.trim()) {
		touched = true;
		return;
	}

	onSubmit({
		endGoal: endGoal.trim(),
		currentSkillLevel: currentSkillLevel.trim()
	});
	onClose();
}

	const questions = [
		{
			id: 'goal',
			title: "What's the end goal?",
			description:
				'Describe the future state or accomplishment this user wants. Be concrete and inspiring.',
			placeholder: 'e.g. Ship a production-ready ML service that automates sales insights.'
		},
		{
			id: 'skill',
			title: "What's their current skill level?",
			description:
				'Capture experience, strengths, or gaps that matter for reaching the goal.',
			placeholder: 'e.g. Comfortable with Python scripting, limited infra/xgboost experience.'
		}
	] as const;

	const currentQuestion = $derived(questions[step]);
</script>

{#if open}
	<div
		class="fixed inset-0 z-[140] flex min-h-full w-full flex-col bg-stone-950/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Set goal and current skill"
		tabindex="-1"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				handleClose();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				handleClose();
			}
		}}
	>
		<div class="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-12">
			<div class="relative w-full rounded-3xl border border-stone-800/40 bg-stone-950/70 p-8 shadow-[0_40px_70px_rgba(28,24,22,0.45)] backdrop-blur">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-xs uppercase tracking-[0.2em] text-stone-400">Daily workflow</p>
						<h1 class="mt-2 text-2xl font-semibold text-stone-100">
							{currentQuestion.title}
						</h1>
						<p class="mt-2 max-w-2xl text-sm text-stone-300">
							{currentQuestion.description}
						</p>
					</div>

					<button
						type="button"
						class="rounded-full p-2 text-stone-400 transition hover:bg-stone-800 hover:text-stone-100"
						onclick={handleClose}
						aria-label="Close goal setup"
					>
						<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M6 6l12 12M6 18L18 6" stroke-linecap="round" />
						</svg>
					</button>
				</div>

				<div class="mt-8">
					{#if currentQuestion.id === 'goal'}
						<textarea
							class="h-44 w-full resize-none rounded-2xl border border-stone-800 bg-stone-900/70 p-4 text-sm leading-relaxed text-stone-100 placeholder:text-stone-500 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/40"
							bind:value={endGoal}
							placeholder={currentQuestion.placeholder}
							autofocus
						></textarea>
						{#if touched && !endGoal.trim()}
							<p class="mt-2 text-xs text-rose-400">Tell us where the user is headed.</p>
						{/if}
					{:else}
						<textarea
							class="h-44 w-full resize-none rounded-2xl border border-stone-800 bg-stone-900/70 p-4 text-sm leading-relaxed text-stone-100 placeholder:text-stone-500 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500/40"
							bind:value={currentSkillLevel}
							placeholder={currentQuestion.placeholder}
							autofocus
						></textarea>
						{#if touched && !currentSkillLevel.trim()}
							<p class="mt-2 text-xs text-rose-400">Describe the current skills so we can level up correctly.</p>
						{/if}
					{/if}
				</div>

				<div class="mt-10 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-500">
					<span>Step {step + 1} of {questions.length}</span>
					<div class="flex items-center gap-2">
						<span class="text-[10px] font-semibold text-stone-400">
							{Math.round(((step + 1) / questions.length) * 100)}% ready
						</span>
						<div class="h-1 w-24 overflow-hidden rounded-full bg-stone-800">
							<div
								class="h-full rounded-full bg-stone-300 transition-all"
								style={`width: ${Math.round(((step + 1) / questions.length) * 100)}%`}
							></div>
						</div>
					</div>
				</div>

				<div class="mt-6 flex items-center justify-end gap-3">
					{#if step === 1}
						<button
							type="button"
							class="rounded-xl border border-stone-700 px-4 py-2 text-sm font-medium text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
							onclick={() => {
								step = 0;
								touched = false;
							}}
						>
							Back
						</button>
					{/if}
					<button
						type="button"
						class="rounded-xl bg-stone-100 px-5 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
						onclick={handleNext}
						disabled={step === 0 ? !endGoal.trim() : !currentSkillLevel.trim()}
					>
						{step === questions.length - 1 ? 'Save & Continue' : 'Next question'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
