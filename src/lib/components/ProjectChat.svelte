<script lang="ts">
	const messages = [
		{
			id: 'mentor-1',
			sender: 'Project mentor',
			role: 'mentor',
			time: '2 min ago',
			content:
				'Congrats on picking this project! Ready to map out your first milestone? I pulled a quick outline to get you started.'
		},
		{
			id: 'user-1',
			sender: 'You',
			role: 'user',
			time: '1 min ago',
			content: 'I want to build momentum fast. Where should I focus during the first week?'
		},
		{
			id: 'mentor-2',
			sender: 'Project mentor',
			role: 'mentor',
			time: 'Just now',
			content:
				'Spend the first 3 days scoping the core feature and setting up the repo. On day 4, ship a small vertical slice and share a progress summary.'
		}
	] as const;
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 space-y-3 overflow-y-auto py-4 text-sm leading-6 text-stone-700">
		<div class="flex flex-row justify-between rounded-xl border border-stone-200 bg-stone-50 p-2">
			<div>-</div>
			<div>File System</div>
			<div>x</div>
		</div>
		{#each messages as message (message.id)}
			<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
				<div class={`flex flex-col gap-1`} class:max-w-[75%]={message.role === 'user'}>
					<div
						class={message.role === 'user'
							? 'self-end rounded-xl  bg-stone-200 px-4 py-2 text-stone-800'
							: 'px-4 py-2 text-stone-700'}
					>
						<p class="text-xs leading-6 text-current">{message.content}</p>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<footer class="px-2 py-2">
		<form class="flex items-center">
			<input
				id="project-chat-input"
				type="text"
				placeholder="Ask anything"
				class="w-full flex-1 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-800 transition outline-none focus:border-stone-300 focus:ring-2 focus:ring-black/5"
			/>
		</form>
	</footer>
</div>
