<script lang="ts">
	import { goto } from '$app/navigation';
	import Folder from '$lib/components/sm/Folder.svelte';

	const exampleMilestone = {
		id: 'tutorial',
		title: 'Example Milestone'
	};

	const exampleTasks = [
		{
			id: 'tutorial',
			title: 'Example Task',
			tutorial: true
		}
	];
</script>

<div class="space-y-1 px-2 py-2">
	<button
		class="group flex w-full items-center rounded-md px-2 py-1.5 text-xs font-medium text-stone-600 uppercase hover:bg-stone-200"
		onclick={() => goto('/tutorial')}
	>
		Tutorial
	</button>

	<Folder
		id={'tutorial'}
		name={exampleMilestone.title}
		tasks={exampleTasks}
		initiallyOpen={false}
	/>
</div>
