<script lang="ts">
	type ChatMessage = {
		id: string;
		role: 'assistant' | 'user';
		content: string;
		created_at?: string;
	};

	let {
		conversationId = null,
		initialMessages = [],
		userId = null
	} = $props<{
		conversationId: string | null;
		initialMessages?: ChatMessage[];
		userId: string | null;
	}>();

	let messages = $state<ChatMessage[]>(initialMessages);
	let input = $state('');
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);
	let scrollRegion: HTMLDivElement | null = null;

	const welcomeMessage: ChatMessage = {
		id: 'welcome',
		role: 'assistant',
		content: 'Ask me about your milestones, daily tasks, or anything you’re building.'
	};

	const displayMessages = $derived(messages.length > 0 ? messages : [welcomeMessage]);
	const composerDisabled = $derived(!conversationId || sending || !userId);

	$effect(() => {
		messages = initialMessages;
	});

	function makeTempId() {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
		return `temp-${Date.now()}`;
	}

	$effect(() => {
		const count = messages.length;
		if (!scrollRegion || count === 0) return;
		queueMicrotask(() => {
			if (!scrollRegion) return;
			scrollRegion.scrollTo({ top: scrollRegion.scrollHeight, behavior: 'smooth' });
		});
	});

	async function send() {
		const text = input.trim();
		if (!text || !conversationId || sending || !userId) return;

		errorMessage = null;
		const tempId = makeTempId();
		const optimistic: ChatMessage = { id: tempId, role: 'user', content: text };
		messages = [...messages, optimistic];
		input = '';
		sending = true;

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ conversationId, message: text, userId })
			});

			if (!response.ok) {
				const detail = await response.text();
				throw new Error(detail || 'Failed to send message');
			}

			const payload: {
				userMessage?: ChatMessage;
				assistantMessage?: ChatMessage;
			} = await response.json();

			const savedUser = payload.userMessage;
			if (savedUser) {
				messages = messages.map((msg) => (msg.id === tempId ? savedUser : msg));
			}

			const assistantReply = payload.assistantMessage;
			if (assistantReply) {
				messages = [...messages, assistantReply];
			}
		} catch (err) {
			const description = err instanceof Error ? err.message : 'Unable to send message';
			errorMessage = description;
			messages = messages.filter((msg) => msg.id !== tempId);
			input = text;
		} finally {
			sending = false;
		}
	}

	function onComposerKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	}
</script>

<div
	class="flex h-full w-full flex-col border-l border-stone-200 bg-stone-50"
	style="flex: 0 0 min(26vw, 22rem);"
>
	<div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" bind:this={scrollRegion}>
		{#each displayMessages as message (message.id)}
			{#if message.role === 'user'}
				<div class="flex justify-end">
					<div
						class="max-w-[80%] rounded-2xl bg-stone-900 px-3 py-2 text-xs leading-5 break-words whitespace-pre-wrap text-white"
					>
						{message.content}
					</div>
				</div>
			{:else}
				<div class="w-full">
					<div class="w-full text-xs leading-6 break-words whitespace-pre-wrap text-stone-900">
						{message.content}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="bg-stone-50 p-3">
		{#if errorMessage}
			<div
				class="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600"
			>
				{errorMessage}
			</div>
		{/if}
		<div class="flex items-end gap-2">
			<textarea
				class="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-stone-300 bg-stone-50 p-2 text-sm text-stone-700 transition outline-none focus:border-stone-400 focus:ring-0 disabled:opacity-60"
				placeholder={conversationId ? 'Type a message…' : 'Chat is unavailable.'}
				bind:value={input}
				onkeydown={onComposerKeydown}
				disabled={composerDisabled}
			/>
		</div>
	</div>
</div>
