<script lang="ts">
	import AuthModal from '$lib/components/lg/AuthModal.svelte';
	import { browser } from '$app/environment';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import Sidebar from '$lib/components/lg/Sidebar.svelte';
	import { supabase } from '$lib/supabaseClient';
	import Chat from '$lib/components/lg/Chat.svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { setContext } from 'svelte';
	import { onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import type { LayoutProps } from './$types';
	import { VIEWER_CONTEXT_KEY, type ViewSelection, type ViewerContext } from '$lib/contexts/viewer';

	let authOpen = $state(false);
	const DEFAULT_CHAT_WIDTH = 352;
	const MIN_CHAT_WIDTH = 260;
	const MAX_CHAT_WIDTH = 640;

	let { data, children }: LayoutProps = $props();

	let userId = $state(data.user?.id ?? null);
	let project = $state(data.project ?? null);
	let milestones = $state(data.milestones);
	let tasks = $state(data.tasks ?? []);
	let tasksByMilestone = $state(data.tasksByMilestone ?? {});
	let currentMilestoneId = $state(data.currentMilestoneId ?? null);
	let currentTaskId = $state(data.currentTaskId ?? null);
	let chat = $state(data.chat);
	let chatWidth = $state(DEFAULT_CHAT_WIDTH);
	let resizingChat = $state(false);
	let selectedMilestoneId = $state<string | null>(null);
	let selectedTaskId = $state<string | null>(null);

	type AuthUI = {
		openAuthModal: () => void;
		signInWithGoogle: (redirectPath?: string) => Promise<void>;
		signOut: () => Promise<void>;
	};
	type GeneratedTask = {
		id: string;
		title: string;
		description: string;
		milestone_id: string;
		ordinal: number;
	};
	type GenerateAPI = {
		generateTask: () => Promise<GeneratedTask>;
	};

	function openAuthModal() {
		authOpen = true;
	}
	function closeAuthModal() {
		authOpen = false;
	}

	async function signInWithGoogle() {
		try {
			const redirectTo = browser ? `${window.location.origin}/` : undefined;
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo,
					queryParams: { prompt: 'select_account' }
				}
			});
			if (error) throw error;
		} catch (err) {}
	}

	$effect(() => {
		userId = data.user?.id ?? null;
		project = data.project ?? null;
		milestones = data.milestones ?? [];
		tasks = data.tasks ?? [];
		tasksByMilestone = data.tasksByMilestone ?? {};
		currentMilestoneId = data.currentMilestoneId ?? null;
		currentTaskId = data.currentTaskId ?? null;
		chat = data.chat;
	});

	function clampChatWidth(value: number) {
		return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, value));
	}

	if (browser) {
		const viewportTarget = Math.round(window.innerWidth * 0.32);
		chatWidth = clampChatWidth(Math.min(DEFAULT_CHAT_WIDTH, viewportTarget));
	}

	function startChatResize(event: PointerEvent) {
		if (!browser) return;
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = chatWidth;
		resizingChat = true;

		const handleMove = (moveEvent: PointerEvent) => {
			const delta = startX - moveEvent.clientX;
			chatWidth = clampChatWidth(startWidth + delta);
		};

		const stop = () => {
			resizingChat = false;
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
		};

		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', stop);
		window.addEventListener('pointercancel', stop);
	}

	async function signOut() {
		await supabase.auth.signOut();
		userId = null;
		await goto('/');
	}

	const authApi: AuthUI = { openAuthModal, signInWithGoogle, signOut };
	setContext<AuthUI>('auth-ui', authApi);

	async function generateTask(): Promise<GeneratedTask> {
		console.log('generating');
		const res = await fetch('/api/generate-task', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				projectId: 'fde711f8-20b6-49a8-80c9-7a51fbce54c2',
				milestoneId: data.milestones[1].id
			})
		});
		if (!res.ok) throw new Error(await res.text());
		const { task } = await res.json();
		return task as GeneratedTask;
	}
	let sidebarCollapsed = $state(false);
	function toggleSidebar() {
		console.log(sidebarCollapsed);
		sidebarCollapsed = !sidebarCollapsed;
	}
	const generateApi: GenerateAPI = { generateTask };
	setContext<GenerateAPI>('generate-task', generateApi);
	const EXPANDED_WIDTH = 'min(21vw, 20rem)';
	const LEFT_BTN = 28; // 7 * 4px (h-7/w-7)
	const RIGHT_BTN = 28;
	const H_PAD = 20; // px-3 on both sides = 12px*2
	const SPACER_EXPANDED = `calc(${EXPANDED_WIDTH} - ${LEFT_BTN + RIGHT_BTN + H_PAD}px)`;

	const selectionStore = writable<ViewSelection>({ type: 'project' });

	function selectProject() {
		selectionStore.set({ type: 'project' });
	}
	function selectMilestone(id: string) {
		selectionStore.set({ type: 'milestone', id });
	}
	function selectTask(id: string) {
		selectionStore.set({ type: 'task', id });
	}

	let milestoneOrdinal = $derived.by((): number | null => {
		if (selectedMilestoneId) {
			const m = milestones.find((m) => m.id === selectedMilestoneId);
			return m?.ordinal ?? null;
		}
		if (selectedTaskId) {
			const t = tasks.find((t) => t.id === selectedTaskId);
			if (!t) return null;
			const m = milestones.find((m) => m.id === t.milestone_id);
			return m?.ordinal ?? null;
		}
		return null;
	});

	let taskOrdinal = $derived.by((): number | null => {
		if (selectedTaskId) {
			const t = tasks.find((t) => t.id === selectedTaskId);
			return t?.ordinal ?? null;
		}

		return null;
	});

	const viewerContext: ViewerContext = {
		selection: selectionStore,
		selectProject,
		selectMilestone,
		selectTask
	};
	setContext<ViewerContext>(VIEWER_CONTEXT_KEY, viewerContext);

	const unsubscribeSelection = selectionStore.subscribe((selection) => {
		selectedTaskId = selection.type === 'task' ? selection.id : null;
		selectedMilestoneId = selection.type === 'milestone' ? selection.id : null;
	});

	onDestroy(() => {
		unsubscribeSelection();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh w-full overflow-hidden bg-stone-50 text-stone-900">
	{#if userId}
		<div
			class={`fixed z-20 flex items-center overflow-hidden px-3 pt-3 pb-2 ${sidebarCollapsed ? 'bg-stone-50' : ''}`}
			style={`width:${EXPANDED_WIDTH};`}
		>
			<button
				type="button"
				onclick={() => {
					selectProject();
					goto('/');
				}}
				class="flex h-7 w-7 items-center justify-center rounded-md text-stone-700 hover:bg-stone-200 hover:text-stone-900"
				aria-label="Go to home"
			>
				<img src={vectorUrl} alt="vector" class="h-5 w-5" />
			</button>

			<div
				class="flex-none transition-[flex-basis] duration-200 ease-out"
				style:flex-basis={sidebarCollapsed ? '8px' : SPACER_EXPANDED}
			/>

			<button
				type="button"
				onclick={toggleSidebar}
				class="inline-flex h-6 w-6 items-center justify-center rounded-md leading-none text-stone-400 transition duration-200 hover:bg-stone-200 focus:outline-none"
				aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<svg
					class="block h-3 w-3 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="2" y="3" width="21" height="18" rx="3" ry="3" />
					<path d="M9 3.6v16" />
				</svg>
			</button>
		</div>
		<Sidebar
			{sidebarCollapsed}
			{toggleSidebar}
			{milestones}
			{tasksByMilestone}
			{currentMilestoneId}
			{currentTaskId}
			tutorial={data.tutorial}
			email={data?.user?.email}
			{userId}
			{selectedMilestoneId}
			{selectedTaskId}
			onSelectMilestone={selectMilestone}
			onSelectTask={selectTask}
		/>
	{:else}
		<button
			type="button"
			onclick={() => {
				selectProject();
				openAuthModal();
			}}
			class="fixed top-3 left-3 flex items-center gap-2 rounded-md px-1 py-1 text-stone-700 transition hover:bg-stone-200 hover:text-stone-900"
			aria-label="Go to home"
		>
			<img src={vectorUrl} alt="vector" class="h-5 w-5" />
		</button>
	{/if}

	<div class="flex min-h-0 min-w-0 flex-1">
		<main class="min-h-0 min-w-0 flex-1 overflow-auto">
			<div
				class="sticky top-0 z-[20] flex h-12 items-center bg-stone-50 pt-3 pb-2
           text-[10px] font-medium text-stone-600 uppercase
           transition-[margin-left] duration-200 ease-out"
				style:margin-left={sidebarCollapsed ? '4.5rem' : '1.2rem'}
			>
				<svg
					class="h-3 w-3 text-stone-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M18 2L12 21" />
				</svg>
				<div class="rounded-md p-1 px-1 hover:bg-stone-200">PROJECT</div>
				{#if selectedMilestoneId || selectedTaskId}
					<svg
						class="h-3 w-3 text-stone-400"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M18 2L12 21" />
					</svg>
					<div class="rounded-md p-1 px-1 hover:bg-stone-200">MILESTONE {milestoneOrdinal}</div>
				{/if}
				{#if selectedTaskId}
					<svg
						class="h-3 w-3 text-stone-400"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M18 2L12 21" />
					</svg>
					<div class="rounded-md p-1 px-1 hover:bg-stone-200">TASK {taskOrdinal}</div>
				{/if}
			</div>

			{@render children()}
		</main>

		{#if userId}
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize chat panel"
				class={`h-full w-2 flex-shrink-0 cursor-col-resize transition select-none ${
					resizingChat ? 'bg-stone-300' : 'bg-transparent hover:bg-stone-200/50'
				}`}
				onpointerdown={startChatResize}
			/>
			<Chat
				conversationId={chat?.conversationId ?? null}
				initialMessages={chat?.messages ?? []}
				{userId}
				width={`${chatWidth}px`}
			/>
		{/if}
	</div>

	<AuthModal open={authOpen} onClose={closeAuthModal} {signInWithGoogle} />
</div>
