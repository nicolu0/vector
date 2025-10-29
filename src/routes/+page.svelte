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
	<DeliverableGenerator {endGoal} {currentSkillLevel} />
</div>

<GoalSetupModal
	open={showGoalModal}
	initialEndGoal={endGoal}
	initialCurrentSkillLevel={currentSkillLevel}
	onClose={handleModalClose}
	onSubmit={handleGoalSubmit}
/>
