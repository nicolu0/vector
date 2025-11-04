<script lang="ts">
	type Msg = { id: string; role: 'assistant' | 'user'; text: string };

	let messages: Msg[] = [
		{
			id: 'm1',
			role: 'assistant',
			text: 'Hi Andrew — I’m GPT-5 Thinking. Ask me anything about Svelte 5, Supabase, or robotics.'
		},
		{ id: 'm2', role: 'user', text: 'Make me a minimal chat UI that looks like ChatGPT.' },
		{
			id: 'm3',
			role: 'assistant',
			text: 'Done. This demo uses hard-coded messages, rounded bubbles, and a disabled composer.'
		}
	];

	let input = $state('');
</script>

<div
	class="flex h-full w-full flex-col border-l border-stone-200 bg-stone-50"
	style="flex: 0 0 min(26vw, 22rem);"
>
	<div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
		{#each messages as m (m.id)}
			<div class={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
				<div class="flex max-w-[80%] items-start gap-2">
					<div
						class={`rounded-2xl px-3 py-2 text-[13px] leading-5 break-words whitespace-pre-wrap ${
							m.role === 'user' ? 'bg-stone-900 text-white' : 'text-stone-900'
						}`}
					>
						{m.text}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="bg-stone-50 p-3">
		<div class="flex items-end gap-2">
			<textarea
				class="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-stone-300 p-2 text-sm text-stone-600 outline-none focus:border-stone-400 focus:ring-0"
				placeholder="Type a message…"
				bind:value={input}
			/>
		</div>
	</div>
</div>
