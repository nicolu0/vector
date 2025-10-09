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
	<div class="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm leading-6 text-stone-700">
		{#each messages as message (message.id)}
			<div class={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
				<div class="flex max-w-[75%] flex-col gap-1">
					<div
						class={message.role === 'user'
							? 'self-end rounded-2xl border border-stone-900 bg-stone-900 px-4 py-2 text-stone-50 shadow-sm'
							: 'rounded-2xl border border-stone-200 bg-white px-4 py-2 text-stone-700 shadow-sm'}
					>
						<div class="text-xs font-medium tracking-wide text-stone-400 uppercase">
							{message.sender}
						</div>
						<p class="mt-1 text-[15px] leading-6 text-current">{message.content}</p>
					</div>
					<div
						class={message.role === 'user'
							? 'text-right text-[11px] tracking-tight text-stone-400 uppercase'
							: 'text-[11px] tracking-tight text-stone-400 uppercase'}
					>
						{message.time}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<footer class="border-t border-stone-200 bg-stone-50/80 px-4 py-3">
		<form class="flex items-center gap-2">
			<label class="sr-only" for="project-chat-input">Message mentor</label>
			<input
				id="project-chat-input"
				type="text"
				placeholder="Share a win or ask what to do next…"
				class="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 transition outline-none focus:border-stone-300 focus:ring-2 focus:ring-black/5"
				disabled
			/>
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-500 transition"
				disabled
			>
				Send
			</button>
		</form>
	</footer>
</div>
