<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import type { StoredProject } from '$lib/stores/dashboardProjects';
	import { tick } from 'svelte';

	const { conversationId, projectId, project, userId, loading, errorMessage } = $props<{
		conversationId: string | null;
		projectId: string | null;
		project: StoredProject | null;
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
		role: 'user' | 'mentor' | null;
		pending?: boolean;
	};

	/* -------- Config -------- */
	const STICKY_TOP = 10; // px

	let messages = $state<ChatMessage[]>([]);
	let messagesLoading = $state(false);
	let messagesError = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let mentorError = $state<string | null>(null);
	let inputValue = $state('');
	let sendInFlight = $state(false);
	let mentorInFlight = $state(false);
	let messagesRequestId = 0;

	// Scroll container + last message element + persistent reply spacer
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let lastMessageEl = $state<HTMLDivElement | null>(null);
	let replySpacerHeight = $state(0);

	// Persist spacer while project view is open
	let keepReplySpacer = $state<boolean>(!!project);

	function enablePersistentSpacer() {
		keepReplySpacer = true;
	}

	function disableSpacer() {
		replySpacerHeight = 0;
		keepReplySpacer = false;
		queueMicrotask(() => updateScrollThumb());
	}

	async function recomputeSpacer() {
		if (!keepReplySpacer) return;
		const el = messagesContainer;
		const last = lastMessageEl;
		if (!el || !last) return;

		await tick();
		const containerH = el.clientHeight;
		const lastRect = last.getBoundingClientRect();
		const lastH = Math.max(1, lastRect.height);
		const desiredBottomGap = Math.max(0, containerH - lastH - STICKY_TOP);

		replySpacerHeight = desiredBottomGap;

		queueMicrotask(() => {
			if (!el) return;
			el.scrollTop = el.scrollHeight;
			updateScrollThumb();
		});
	}

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
				.select('id, conversation_id, user_id, content, sequence, created_at, role')
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
		if (!conversationId || !userId) return;
		const trimmed = inputValue.trim();
		if (!trimmed || sendInFlight) return;

		const shouldUpdateStatus = messages.length === 0;
		sendInFlight = true;
		sendError = null;
		mentorError = null;

		const optimisticMessage: ChatMessage = {
			id: `pending-${Date.now()}`,
			conversation_id: conversationId,
			user_id: userId,
			content: trimmed,
			sequence: getNextSequence(),
			created_at: new Date().toISOString(),
			role: 'user',
			pending: true
		};

		messages = [...messages, optimisticMessage];
		inputValue = '';

		// Persist spacer and recompute right away
		enablePersistentSpacer();
		void recomputeSpacer();

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
				.select('id, conversation_id, user_id, content, sequence, created_at, role')
				.single();

			if (error) throw error;
			if (!data) throw new Error('Message insert returned no data.');

			messages = messages.map((message) =>
				message.id === optimisticMessage.id ? ({ ...data, pending: false } as ChatMessage) : message
			);

			if (shouldUpdateStatus && projectId) {
				void updateProjectStatus(projectId);
			}
			if (project) {
				void generateMentorResponse();
			}
		} catch (err) {
			messages = messages.filter((m) => m.id !== optimisticMessage.id);
			sendError = err instanceof Error ? err.message : 'Unable to send message right now.';
			// keeping the spacer persistent
		} finally {
			sendInFlight = false;
		}
	}

	async function updateProjectStatus(projectId: string) {
		try {
			const { error } = await supabase
				.from('projects')
				.update({ status: 'in_progress' })
				.eq('id', projectId)
				.in('status', ['not_started', 'not started', 'Not Started']);

			if (error) throw error;
			dashboardProjects.setProjectStatus(projectId, 'in_progress');
		} catch (err) {
			console.error('Failed to update project status', err);
		}
	}

	function buildProjectContextPayload(currentProject: StoredProject) {
		return {
			title: currentProject.title,
			description: currentProject.description,
			difficulty: currentProject.difficulty,
			timeline: currentProject.timeline,
			skills: currentProject.skills ?? [],
			jobs:
				currentProject.jobs?.map((job) => ({
					title: job.title,
					url: job.url
				})) ?? []
		};
	}

	function normalizeMessageRole(message: ChatMessage) {
		if (message.role === 'mentor' || message.role === 'user') return message.role;
		return message.user_id === userId ? 'user' : 'mentor';
	}

	async function generateMentorResponse() {
		if (!project || !conversationId) return;

		const payload = {
			project: buildProjectContextPayload(project),
			messages: messages
				.filter((message) => !message.pending)
				.map((message) => ({
					role: normalizeMessageRole(message),
					content: message.content
				}))
		};

		if (payload.messages.length === 0) return;

		mentorInFlight = true;
		let optimisticMentor: ChatMessage | null = null;

		try {
			const response = await fetch('/api/project-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const { error } = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
					error?: string;
				};
				throw new Error(error ?? 'Unable to generate mentor response.');
			}

			const { content } = (await response.json()) as { content?: string };
			if (!content) throw new Error('Mentor response was empty.');

			optimisticMentor = {
				id: `mentor-pending-${Date.now()}`,
				conversation_id: conversationId,
				user_id: null,
				content,
				sequence: getNextSequence(),
				created_at: new Date().toISOString(),
				role: 'mentor',
				pending: true
			};

			messages = [...messages, optimisticMentor];

			const { data, error } = await supabase
				.from('messages')
				.insert([
					{
						conversation_id: conversationId,
						user_id: userId,
						content,
						role: 'mentor',
						sequence: optimisticMentor.sequence
					}
				])
				.select('id, conversation_id, user_id, content, sequence, created_at, role')
				.single();

			if (error) throw error;
			if (!data) throw new Error('Mentor insert returned no data.');

			messages = messages.map((m) =>
				m.id === optimisticMentor?.id ? ({ ...data, pending: false } as ChatMessage) : m
			);

			void recomputeSpacer();
		} catch (err) {
			if (optimisticMentor) {
				messages = messages.filter((m) => m.id !== optimisticMentor?.id);
			}
			mentorError = err instanceof Error ? err.message : 'Unable to generate mentor response.';
			void recomputeSpacer();
		} finally {
			mentorInFlight = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void sendMessage();
	}

	/* ------- Scroll thumb ------- */
	function updateScrollThumb() {
		const el = messagesContainer;
		if (!el) return;

		const { scrollHeight, clientHeight, scrollTop } = el;
		const trackPadding = 0;
		el.style.setProperty('--scroll-thumb-track-padding', `${trackPadding}px`);

		if (scrollHeight <= clientHeight + 1 || clientHeight === 0) {
			el.style.setProperty('--scroll-thumb-height', '0px');
			el.style.setProperty('--scroll-thumb-offset', '0px');
			el.style.setProperty('--scroll-thumb-opacity', '0');
			return;
		}

		const trackHeight = Math.max(scrollHeight - trackPadding * 2, 0);
		if (trackHeight <= 0) {
			el.style.setProperty('--scroll-thumb-height', '0px');
			el.style.setProperty('--scroll-thumb-offset', '0px');
			el.style.setProperty('--scroll-thumb-opacity', '0');
			return;
		}

		const maxScrollTop = Math.max(scrollHeight - clientHeight, 0);
		const desiredThumb = Math.max(36, trackHeight * 0.12);
		const thumbHeight = Math.min(trackHeight * 0.4, Math.min(trackHeight, desiredThumb));
		const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
		const progress = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
		const offset = progress * maxThumbOffset;

		el.style.setProperty('--scroll-thumb-height', `${thumbHeight}px`);
		el.style.setProperty('--scroll-thumb-offset', `${offset}px`);
		el.style.setProperty('--scroll-thumb-opacity', '1');
	}

	/* ------- Effects ------- */
	$effect(() => {
		keepReplySpacer = !!project;
		if (!keepReplySpacer) {
			disableSpacer();
		} else {
			queueMicrotask(() => void recomputeSpacer());
		}
	});

	$effect(() => {
		const id = conversationId;
		const requestId = ++messagesRequestId;
		messagesError = null;
		sendError = null;
		mentorError = null;
		mentorInFlight = false;

		if (!id) {
			messages = [];
			messagesLoading = false;
			return;
		}

		messagesLoading = true;
		void fetchMessages(id, requestId);
	});

	$effect(() => {
		const container = messagesContainer;
		if (!container) return;
		queueMicrotask(() => {
			container.scrollTop = container.scrollHeight;
			updateScrollThumb();
			void recomputeSpacer();
		});
	});

	$effect(() => {
		const el = messagesContainer;
		if (!el) return;

		const handleScroll = () => {
			updateScrollThumb();
		};

		el.addEventListener('scroll', handleScroll, { passive: true });
		updateScrollThumb();

		let roContainer: ResizeObserver | null = null;
		let roContent: ResizeObserver | null = null;

		if (typeof ResizeObserver !== 'undefined') {
			roContainer = new ResizeObserver(() => {
				updateScrollThumb();
				void recomputeSpacer();
			});
			roContainer.observe(el);

			const content = el.firstElementChild;
			if (content) {
				roContent = new ResizeObserver(() => {
					updateScrollThumb();
					void recomputeSpacer();
				});
				roContent.observe(content);
			}
		}

		return () => {
			el.removeEventListener('scroll', handleScroll);
			roContainer?.disconnect();
			roContent?.disconnect();
		};
	});

	function lastRef(node: HTMLDivElement, isLast: boolean) {
		if (isLast) lastMessageEl = node;
		return {
			update(v: boolean) {
				if (v) lastMessageEl = node;
				else if (lastMessageEl === node) lastMessageEl = null;
			},
			destroy() {
				if (lastMessageEl === node) lastMessageEl = null;
			}
		};
	}
</script>

<div class="flex h-full flex-col text-sm leading-6 text-stone-700">
	<div class="flex w-full flex-row py-2 pt-3 pr-5">
		<div
			class="w-full justify-center rounded-xl border border-stone-200 bg-stone-50 p-2 text-center text-sm text-stone-600"
			in:fly|global={{ y: -10, duration: 500, easing: cubicOut }}
		>
			Introduction
		</div>
	</div>

	<div
		class="project-chat-scroll flex-1 space-y-3 overflow-y-auto pr-5"
		bind:this={messagesContainer}
	>
		{#if loading}
			<div class="flex justify-center"></div>
		{:else if errorMessage}
			<div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
				{errorMessage}
			</div>
		{:else if !conversationId}
			<div class="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
				Select a project to view its conversation.
			</div>
		{:else if messagesLoading}
			<div class="flex justify-center"></div>
		{:else if messagesError}
			<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
				{messagesError}
			</div>
		{:else if messages.length === 0}
			<div class="p-3 text-xs text-stone-500"></div>
		{:else}
			<div in:fly|global={{ x: 8, duration: 400, easing: cubicOut }} class="flex flex-col gap-y-2">
				{#each messages as message, i (message.id)}
					{@const isUser = message.role === 'user'}
					{@const isLast = i === messages.length - 1}

					<div class={isUser ? 'flex justify-end' : 'flex justify-start'}>
						<div class="flex flex-col gap-1" class:max-w-[75%]={isUser} use:lastRef={isLast}>
							<div
								class={isUser
									? 'self-end rounded-xl bg-stone-200 px-4 py-2 text-stone-800'
									: 'rounded-xl px-4 py-2 text-stone-700'}
								class:opacity-60={message.pending}
							>
								<p class="text-xs leading-6 break-words text-current">{message.content}</p>
							</div>
						</div>
					</div>
				{/each}

				{#if mentorInFlight}
					<div
						class="pointer-events-none flex h-[calc(100%-0.75rem)] items-start pl-4"
						role="status"
						aria-live="polite"
					>
						<span class="typing-dot mt-1 inline-block h-2.5 w-2.5 rounded-full bg-stone-800"></span>
					</div>
				{/if}
				<div style={`height:${replySpacerHeight}px`} aria-hidden="true"></div>
			</div>
		{/if}
	</div>

	<footer class="px-2 py-2 pb-5">
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
				disabled={!conversationId ||
					!userId ||
					loading ||
					messagesLoading ||
					sendInFlight ||
					mentorInFlight}
			/>
			{#if !userId}
				<p class="text-[10px] text-stone-400">Sign in to send messages.</p>
			{:else if sendError}
				<p class="text-[10px] text-rose-600">{sendError}</p>
			{:else if mentorError}
				<p class="text-[10px] text-amber-600">{mentorError}</p>
			{/if}
		</form>
	</footer>
</div>

<style>
	:global(.project-chat-scroll) {
		position: relative;
		scrollbar-width: none;
	}

	:global(.project-chat-scroll)::after {
		content: '';
		position: absolute;
		top: var(--scroll-thumb-track-padding, 0);
		right: 5px;
		width: 1px;
		height: var(--scroll-thumb-height, 0);
		background-color: #aaa;
		opacity: var(--scroll-thumb-opacity, 0);
		pointer-events: none;
		border-radius: 9999px;
		transform: translateY(var(--scroll-thumb-offset, 0));
		will-change: transform, opacity;
	}

	:global(.project-chat-scroll)::-webkit-scrollbar {
		width: 0;
		height: 0;
	}

	:global(.project-chat-scroll)::-webkit-scrollbar-thumb {
		background: transparent;
	}
	@keyframes dot-breathe {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.9;
		}
		50% {
			transform: scale(1.4);
			opacity: 0.6;
		}
	}
	.typing-dot {
		animation: dot-breathe 1.2s ease-in-out infinite;
	}
</style>
