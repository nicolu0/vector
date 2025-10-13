<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import type { StoredProject } from '$lib/stores/dashboardProjects';
	import type { Milestone } from '$lib/types/project';
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
		action?: Record<string, unknown> | null;
	};

	type MentorPacket = { title: string; content: string; action?: Record<string, unknown> | null };

	/* -------- Config -------- */
	const PERSISTENT_SPACER_HEIGHT = 160; // px

	let messages = $state<ChatMessage[]>([]);
	let messagesLoading = $state(false);
	let messagesError = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let mentorError = $state<string | null>(null);
	let inputValue = $state('');
	let sendInFlight = $state(false);
	let mentorInFlight = $state(false);
	let messagesRequestId = 0;

	let currentTitle = $state('Mentor');

	// Scroll container + persistent reply spacer
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let replySpacerHeight = $state(0);
	let spacerLocked = $state(false);

	function recomputeSpacer() {
		replySpacerHeight = spacerLocked ? PERSISTENT_SPACER_HEIGHT : 0;
		queueMicrotask(() => updateScrollThumb());
	}
	function lockSpacer() {
		if (spacerLocked) return;
		spacerLocked = true;
		replySpacerHeight = PERSISTENT_SPACER_HEIGHT;
		queueMicrotask(() => {
			const el = messagesContainer;
			if (!el) return;
			el.scrollTop = el.scrollHeight;
			updateScrollThumb();
		});
	}
	function resetSpacerState() {
		spacerLocked = false;
		replySpacerHeight = 0;
		queueMicrotask(() => updateScrollThumb());
	}
	function maybeLockSpacer() {
		if (spacerLocked) return;
		const userCount = messages.filter((m) => m.role === 'user').length;
		const mentorCount = messages.filter((m) => m.role === 'mentor').length;
		if (userCount >= 2 && mentorCount >= 1) lockSpacer();
	}
	async function scrollToBottom() {
		await tick();
		const el = messagesContainer;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
		updateScrollThumb();
		recomputeSpacer();
		if (spacerLocked) {
			queueMicrotask(() => {
				if (!messagesContainer) return;
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				updateScrollThumb();
			});
		}
	}
	function getNextSequence() {
		return (
			messages.reduce((max, m) => {
				const v = typeof m.sequence === 'number' ? m.sequence : 0;
				return v > max ? v : max;
			}, 0) + 1
		);
	}

	async function fetchMessages(id: string, requestId: number) {
		try {
			const { data, error } = await supabase
				.from('messages')
				.select('id, conversation_id, user_id, content, sequence, created_at, role, action')
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
			if (requestId === messagesRequestId) messagesLoading = false;
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

		const optimistic: ChatMessage = {
			id: `pending-${Date.now()}`,
			conversation_id: conversationId,
			user_id: userId,
			content: trimmed,
			sequence: getNextSequence(),
			created_at: new Date().toISOString(),
			role: 'user',
			pending: true,
			action: null
		};
		messages = [...messages, optimistic];
		inputValue = '';
		recomputeSpacer();

		try {
			const { data, error } = await supabase
				.from('messages')
				.insert([
					{
						conversation_id: conversationId,
						user_id: userId,
						content: trimmed,
						role: 'user',
						sequence: optimistic.sequence,
						action: null
					}
				])
				.select('id, conversation_id, user_id, content, sequence, created_at, role, action')
				.single();
			if (error) throw error;
			if (!data) throw new Error('Message insert returned no data.');
			messages = messages.map((m) =>
				m.id === optimistic.id ? ({ ...data, pending: false } as ChatMessage) : m
			);
			if (shouldUpdateStatus && projectId) void updateProjectStatus(projectId);
			if (project) void generateMentorResponse();
		} catch (err) {
			messages = messages.filter((m) => m.id !== optimistic.id);
			sendError = err instanceof Error ? err.message : 'Unable to send message right now.';
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
		const rawMilestones =
			currentProject.metadata?.milestones?.map((ms) => {
				if (!ms || typeof ms !== 'object') return null;
				const { name, objective, success_metrics } = ms as typeof ms & {
					success_metrics?: unknown;
				};
				if (typeof name !== 'string' || typeof objective !== 'string') return null;
				const metrics = Array.isArray(success_metrics)
					? success_metrics.filter((x): x is string => typeof x === 'string' && x.trim())
					: [];
				return { name, objective, success_metrics: metrics };
			}) ?? [];
		const milestones = rawMilestones.filter(Boolean) as Milestone[];

		return {
			title: currentProject.title,
			description: currentProject.description,
			difficulty: currentProject.difficulty,
			timeline: currentProject.timeline,
			skills: currentProject.skills ?? [],
			metadata: { milestones },
			jobs: currentProject.jobs?.map((j) => ({ title: j.title, url: j.url })) ?? []
		};
	}

	function normalizeMessageRole(m: ChatMessage) {
		if (m.role === 'mentor' || m.role === 'user') return m.role;
		return m.user_id === userId ? 'user' : 'mentor';
	}

	// Parse mentor JSON content into { title, content, action }
	function parseMentorPacket(s: string): MentorPacket {
		try {
			const o = JSON.parse(String(s ?? '{}'));
			return {
				title: typeof o?.title === 'string' && o.title.trim() ? o.title : 'Mentor',
				content: typeof o?.content === 'string' ? o.content : '',
				action: o && typeof o.action === 'object' ? o.action : null
			};
		} catch {
			return { title: 'Mentor', content: String(s ?? ''), action: null };
		}
	}

	function computeLatestTitle(): string {
		for (let i = messages.length - 1; i >= 0; i--) {
			const m = messages[i];
			if (m.role !== 'mentor') continue;
			try {
				const o = JSON.parse(String(m.content ?? '{}'));
				if (o?.title && typeof o.title === 'string') return o.title;
			} catch {
				/* ignore non-JSON mentor content */
			}
		}
		return 'Mentor';
	}

	async function generateMentorResponse() {
		if (!project || !conversationId) return;

		const payload = {
			project: buildProjectContextPayload(project),
			messages: messages
				.filter((m) => !m.pending)
				.map((m) => ({
					role: normalizeMessageRole(m),
					content: m.content
				}))
		};

		if (payload.messages.length === 0) return;

		mentorInFlight = true;
		let optimisticMentor: ChatMessage | null = null;

		try {
			const response = await fetch('/api/mentor', {
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

			const result = (await response.json()) as MentorPacket;
			if (!result?.content) throw new Error('Mentor response was empty.');

			const contentJson = JSON.stringify({
				title: result.title ?? 'Mentor',
				content: result.content,
				action: result.action ?? null
			});

			optimisticMentor = {
				id: `mentor-pending-${Date.now()}`,
				conversation_id: conversationId,
				user_id: null,
				content: contentJson,
				sequence: getNextSequence(),
				created_at: new Date().toISOString(),
				role: 'mentor',
				pending: true,
				action: null
			};

			messages = [...messages, optimisticMentor];

			const { data, error } = await supabase
				.from('messages')
				.insert([
					{
						conversation_id: conversationId,
						user_id: userId,
						content: contentJson,
						role: 'mentor',
						sequence: optimisticMentor.sequence,
						action: null
					}
				])
				.select('id, conversation_id, user_id, content, sequence, created_at, role, action')
				.single();

			if (error) throw error;
			if (!data) throw new Error('Mentor insert returned no data.');
			messages = messages.map((m) =>
				m.id === optimisticMentor?.id ? ({ ...data, pending: false } as ChatMessage) : m
			);

			currentTitle = computeLatestTitle();
			recomputeSpacer();
		} catch (err) {
			if (optimisticMentor) messages = messages.filter((m) => m.id !== optimisticMentor?.id);
			mentorError = err instanceof Error ? err.message : 'Unable to generate mentor response.';
			recomputeSpacer();
		} finally {
			mentorInFlight = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void sendMessage();
	}

	/* ------- Scroll thumb ------- */
	let thumbVisible = $state(false);
	let scrollIdleTimer: number | null = null;
	function showThumbTemporarily(ms = 900) {
		thumbVisible = true;
		updateScrollThumb();
		if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
		scrollIdleTimer = window.setTimeout(() => {
			thumbVisible = false;
			updateScrollThumb();
			scrollIdleTimer = null;
		}, ms);
	}
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
		el.style.setProperty('--scroll-thumb-opacity', thumbVisible ? '1' : '0');
	}

	/* ------- Effects ------- */
	$effect(() => {
		currentTitle = computeLatestTitle();
	});

	$effect(() => {
		if (!project) {
			resetSpacerState();
			return;
		}
		recomputeSpacer();
	});

	$effect(() => {
		const id = conversationId;
		const requestId = ++messagesRequestId;
		messagesError = null;
		sendError = null;
		mentorError = null;
		mentorInFlight = false;
		resetSpacerState();

		if (!id) {
			messages = [];
			messagesLoading = false;
			return;
		}

		messagesLoading = true;
		void fetchMessages(id, requestId);
	});

	$effect(() => {
		const el = messagesContainer;
		if (!el) return;
		const handleScroll = () => {
			showThumbTemporarily();
			updateScrollThumb();
		};
		const handleEnter = () => showThumbTemporarily(1200);
		const handleMove = () => showThumbTemporarily(1200);
		const handleLeave = () => {
			thumbVisible = false;
			updateScrollThumb();
		};
		el.addEventListener('scroll', handleScroll, { passive: true });
		el.addEventListener('mouseenter', handleEnter);
		el.addEventListener('mousemove', handleMove);
		el.addEventListener('mouseleave', handleLeave);
		showThumbTemporarily(1200);
		updateScrollThumb();
		return () => {
			el.removeEventListener('scroll', handleScroll);
			el.removeEventListener('mouseenter', handleEnter);
			el.removeEventListener('mousemove', handleMove);
			el.removeEventListener('mouseleave', handleLeave);
			if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
		};
	});

	$effect(() => {
		const id = conversationId;
		if (!id) return;

		if (!messagesLoading && messages.length > 0) {
			void scrollToBottom();
		}

		// Seed initial mentor message if no history
		if (!messagesLoading && messages.length === 0 && id && userId) {
			const seed: MentorPacket = {
				title: 'Assessment',
				content: 'How experienced are you with Python?',
				action: null
			};
			const seedContent = JSON.stringify(seed);
			const optimisticId = `mentor-seed-${Date.now()}`;
			const nextSeq = getNextSequence();

			messages = [
				...messages,
				{
					id: optimisticId,
					conversation_id: id,
					user_id: null,
					content: seedContent,
					sequence: nextSeq,
					created_at: new Date().toISOString(),
					role: 'mentor',
					pending: true,
					action: null
				}
			];

			(async () => {
				try {
					const { data, error } = await supabase
						.from('messages')
						.insert([
							{
								conversation_id: id,
								user_id: userId,
								content: seedContent,
								role: 'mentor',
								sequence: nextSeq,
								action: null
							}
						])
						.select('id, conversation_id, user_id, content, sequence, created_at, role, action')
						.single();

					if (!error && data) {
						messages = messages.map((m) =>
							m.id === optimisticId ? ({ ...data, pending: false } as ChatMessage) : m
						);
						currentTitle = computeLatestTitle();
						void scrollToBottom();
					}
				} catch {
					/* non-fatal */
				}
			})();
		}
	});

	$effect(() => {
		const lastId = messages.length ? messages[messages.length - 1]?.id : null;
		const container = messagesContainer;
		if (!container) return;
		if (!lastId) {
			updateScrollThumb();
			return;
		}
		void scrollToBottom();
	});

	$effect(() => {
		if (messages.length === 0) return;
		maybeLockSpacer();
	});
</script>

<div class="flex h-full flex-col text-sm leading-6 text-stone-700">
	<div class="flex w-full flex-row py-2 pr-5 pl-1">
		<div
			class="w-full justify-center rounded-xl border border-stone-200 bg-stone-50 p-2 text-center text-sm text-stone-600"
			in:fly|global={{ y: -10, duration: 500, easing: cubicOut }}
		>
			{currentTitle}
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
			<div
				in:fly|global={{ x: 8, duration: 400, easing: cubicOut }}
				class="flex flex-col gap-y-4 pl-2"
			>
				{#each messages as message (message.id)}
					{@const isUser = message.role === 'user'}
					<div class={isUser ? 'flex justify-end' : 'flex justify-start'}>
						<div class="flex flex-col gap-1" class:max-w-[75%]={isUser}>
							{#if isUser}
								<p
									class="rounded-lg bg-stone-200 p-3 py-2 text-xs leading-6 break-words whitespace-pre-wrap text-current"
								>
									{message.content}
								</p>
							{:else}
								{@const parsed = parseMentorPacket(String(message.content ?? ''))}
								<p class="p-3 py-2 text-xs leading-6 break-words whitespace-pre-wrap text-current">
									{parsed.content}
								</p>
							{/if}
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
	:global(.project-chat-scroll)::after {
		transition: opacity 220ms ease;
	}
</style>
