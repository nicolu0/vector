<script lang="ts">
	const messages = [
		{
			id: 'mentor-1',
			sender: 'Project mentor',
			role: 'mentor',
			content: `Let's get started. Any questions on how to set up the project?`
		},
		{
			id: 'user-1',
			sender: 'You',
			role: 'user',
			content: 'i made a directory for the project what do i do now'
		}
	] as const;
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 space-y-3 overflow-y-auto py-4 text-sm leading-6 text-stone-700">
		<div class="flex flex-row justify-center rounded-xl border border-stone-200 bg-stone-50 p-2">
			<div>Introduction</div>
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
