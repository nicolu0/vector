<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	const { conversationId, userId, loading, errorMessage } = $props<{
		conversationId: string | null;
		userId: string | null;
		loading: boolean;
		errorMessage: string | null;
	}>();

	type ChatMessage = {
		id: string;
		conversation_id: string;
		user_id: string | null;
		sequence: number | null;
		content: string;
		created_at: string | null;
		pending?: boolean;
	};

	let messages = $state<ChatMessage[]>([]);
	let messagesLoading = $state(false);
	let messagesError = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let inputValue = $state('');
	let sendInFlight = $state(false);
	let messagesRequestId = 0;

	function getNextSequence() {
		return (
			messages.reduce((max, message) => {
				const value = typeof message.sequence === 'number' ? message.sequence : 0;
				return value > max ? value : max;
			}, 0) + 1
		);
	}

	async function fetchMessages(id: string, requestId: number) {
		try {
			const { data, error } = await supabase
				.from('messages')
				.select('id, conversation_id, user_id, content, sequence, created_at')
				.eq('conversation_id', id)
				.order('sequence', { ascending: true });

			if (error) throw error;
			if (requestId !== messagesRequestId) return;

			messages = (data ?? []) as ChatMessage[];
		} catch (err) {
			if (requestId !== messagesRequestId) return;
			messagesError = err instanceof Error ? err.message : 'Unable to load messages right now.';
			messages = [];
		} finally {
			if (requestId === messagesRequestId) {
				messagesLoading = false;
			}
		}
	}

	async function sendMessage() {
		console.log('sending');
		if (!conversationId || !userId) return;
		const trimmed = inputValue.trim();
		if (!trimmed || sendInFlight) return;

		sendInFlight = true;
		sendError = null;

		const optimisticMessage: ChatMessage = {
			id: `pending-${Date.now()}`,
			conversation_id: conversationId,
			user_id: userId,
			content: trimmed,
			sequence: getNextSequence(),
			created_at: new Date().toISOString(),
			pending: true
		};

		messages = [...messages, optimisticMessage];
		inputValue = '';

		try {
			const { data, error } = await supabase
				.from('messages')
				.insert([
					{
						conversation_id: conversationId,
						user_id: userId,
						content: trimmed,
						role: 'user',
						sequence: optimisticMessage.sequence
					}
				])
				.select('id, conversation_id, user_id, content, sequence, created_at')
				.single();

			console.log('error: ', error);
			if (error) throw error;
			if (!data) throw new Error('Message insert returned no data.');

			messages = messages.map((message) =>
				message.id === optimisticMessage.id ? ({ ...data, pending: false } as ChatMessage) : message
			);
		} catch (err) {
			messages = messages.filter((message) => message.id !== optimisticMessage.id);
			sendError = err instanceof Error ? err.message : 'Unable to send message right now.';
		} finally {
			sendInFlight = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void sendMessage();
	}

	$effect(() => {
		const id = conversationId;
		const requestId = ++messagesRequestId;
		messagesError = null;
		sendError = null;

		if (!id) {
			messages = [];
			messagesLoading = false;
			return;
		}

		messagesLoading = true;
		void fetchMessages(id, requestId);
	});
</script>

<div class="flex h-full flex-col text-sm leading-6 text-stone-700">
	<div class="flex-1 space-y-3 overflow-y-auto py-4">
		{#if loading}
			<div class="flex justify-center">
				<div class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
					Loading conversation…
				</div>
			</div>
		{:else if errorMessage}
			<div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
				{errorMessage}
			</div>
		{:else if !conversationId}
			<div class="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
				Select a project to view its conversation.
			</div>
		{:else}
			<div
				class="flex flex-row justify-center rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-600"
			>
				Introduction
			</div>
			{#if messagesLoading}
				<div class="flex justify-center">
					<div class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
						Loading messages…
					</div>
				</div>
			{:else if messagesError}
				<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
					{messagesError}
				</div>
			{:else if messages.length === 0}
				<div class="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-500">
					No messages yet. Say hello to get started.
				</div>
			{:else}
				{#each messages as message (message.id)}
					{@const isUser = message.user_id === userId}
					<div class={isUser ? 'flex justify-end' : 'flex justify-start'}>
						<div class="flex flex-col gap-1" class:max-w-[75%]={isUser}>
							<div
								class={isUser
									? 'self-end rounded-xl bg-stone-200 px-4 py-2 text-stone-800'
									: 'rounded-xl bg-white px-4 py-2 text-stone-700'}
								class:opacity-60={message.pending}
							>
								<p class="text-xs leading-6 break-words text-current">{message.content}</p>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		{/if}
	</div>

	<footer class="px-2 py-2">
		<form class="flex flex-col gap-2" onsubmit={handleSubmit} autocomplete="off">
			<input
				id="project-chat-input"
				type="text"
				autocomplete="off"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
				placeholder="Ask anything"
				bind:value={inputValue}
				class="w-full flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800 transition outline-none focus:border-stone-300 focus:ring-2 focus:ring-black/5"
				disabled={!conversationId || !userId || loading || messagesLoading || sendInFlight}
			/>
			{#if !userId}
				<p class="text-[10px] text-stone-400">Sign in to send messages.</p>
			{:else if sendError}
				<p class="text-[10px] text-rose-600">{sendError}</p>
			{/if}
		</form>
	</footer>
</div>
