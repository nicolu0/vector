<script lang="ts">
	import DeliverableGenerator from '$lib/components/DeliverableGenerator.svelte';
	import GoalSetupModal from '$lib/components/GoalSetupModal.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const initialEndGoal = data.endGoal?.trim() ?? '';
	const initialCurrentSkillLevel = data.currentSkillLevel?.trim() ?? '';

	let endGoal = $state(initialEndGoal);
	let currentSkillLevel = $state(initialCurrentSkillLevel);
	let showGoalModal = $state(!(initialEndGoal && initialCurrentSkillLevel));

	function handleGoalSubmit(payload: { endGoal: string; currentSkillLevel: string }) {
		endGoal = payload.endGoal;
		currentSkillLevel = payload.currentSkillLevel;
		showGoalModal = false;
	}

	function handleModalClose() {
		if (endGoal.trim() && currentSkillLevel.trim()) {
			showGoalModal = false;
		}
	}
</script>

<div class="flex h-full w-full flex-row gap-8 p-6">
	<div
		class="flex w-full max-w-xl flex-col gap-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
	>
		<div class="space-y-2">
			<h1 class="text-xl font-semibold text-stone-900">Profile Snapshot</h1>
			<p class="text-sm text-stone-600">
				We use this to tailor each 30-minute deliverable for the user's path.
			</p>
		</div>

		<div class="space-y-4">
			<div class="rounded-lg border border-stone-200 bg-stone-50 p-4">
				<h2 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">End goal</h2>
				<p class="mt-2 text-sm text-stone-800">
					{endGoal || 'Not set yet. Describe where the user is headed.'}
				</p>
			</div>

			<div class="rounded-lg border border-stone-200 bg-stone-50 p-4">
				<h2 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">
					Current skill level
				</h2>
				<p class="mt-2 text-sm text-stone-800">
					{currentSkillLevel || 'Not set yet. Outline experience, gaps, and constraints.'}
				</p>
			</div>
		</div>

		<button
			class="w-fit rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
			type="button"
			onclick={() => (showGoalModal = true)}
		>
			Edit goal & skill
		</button>
	</div>

	<DeliverableGenerator {endGoal} {currentSkillLevel} />
</div>

<GoalSetupModal
	open={showGoalModal}
	initialEndGoal={endGoal}
	initialCurrentSkillLevel={currentSkillLevel}
	onClose={handleModalClose}
	onSubmit={handleGoalSubmit}
/>
