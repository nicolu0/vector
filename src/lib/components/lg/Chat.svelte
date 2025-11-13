<script lang="ts">
	import { page } from '$app/stores';
	const routeId = $derived($page.params.id ?? null);
	type ChatMessage = {
		id: string;
		role: 'assistant' | 'user';
		content: string;
		created_at?: string;
	};
	type ProjectContext = {
		id: string;
		title: string;
		description?: string | null;
		skills?: string[];
	};
	type MilestoneContext = { id?: string; title?: string; description?: string | null };
	type TaskContext = { id?: string; title?: string; description?: string | null };

	let {
		conversationId = null,
		initialMessages = [],
		userId = null,
		width = 'min(26vw, 22rem)'
	} = $props<{
		conversationId: string | null;
		initialMessages?: ChatMessage[];
		userId: string | null;
		width?: string;
	}>();

	let messages = $state<ChatMessage[]>(initialMessages);
	let input = $state('');
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);
	let scrollRegion: HTMLDivElement | null = null;
	let projectContext = $state<ProjectContext | null>(null);
	let milestoneContext = $state<MilestoneContext | null>(null);
	let taskContext = $state<TaskContext | null>(null);

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
	$effect(() => {
		const project = $page.data?.project;
		projectContext = project
			? {
					id: project.id,
					title: project.title,
					description: project.description ?? '',
					skills: Array.isArray(project.skills) ? project.skills : []
				}
			: null;
	});
	$effect(() => {
		const milestone = $page.data?.milestone;
		milestoneContext = milestone
			? {
					id: milestone.id,
					title: milestone.title,
					description: milestone.description ?? ''
				}
			: null;
	});
	$effect(() => {
		const task = $page.data?.task;
		taskContext = task
			? {
					id: task.id,
					title: task.title,
					description: task.description ?? ''
				}
			: null;
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
				body: JSON.stringify({
					conversationId,
					message: text,
					userId,
					context: {
						project: projectContext,
						milestone: milestoneContext,
						task: taskContext
					}
				})
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
	style={`flex: 0 0 ${width}; width: ${width};`}
>
	<div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" bind:this={scrollRegion}>
		{#each displayMessages as message (message.id)}
			{#if message.role === 'user'}
				<div class="flex justify-end">
					<div
						class="max-w-[80%] rounded-xl bg-stone-200 px-3 py-2 text-xs leading-5 break-words whitespace-pre-wrap text-stone-900"
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
		<div class="w-full">
			<div
				class="w-full rounded-lg border border-stone-200 bg-white p-4 text-xs leading-6 break-words whitespace-pre-wrap text-stone-900"
			>
				PyTorch Tensor Docs have been added to resources.
			</div>
		</div>
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
