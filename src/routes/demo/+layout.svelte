<script lang="ts">
	import AuthModal from '$lib/components/lg/AuthModal.svelte';
	import { browser } from '$app/environment';
	import vectorUrl from '$lib/assets/vector.svg?url';
	import Sidebar from '$lib/components/lg/Sidebar.svelte';
	import { supabase } from '$lib/supabaseClient';
	import Chat from '$lib/components/lg/Chat.svelte';
	import '../../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { setContext } from 'svelte';
	import { onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import type { LayoutProps } from './$types';
	import { VIEWER_CONTEXT_KEY, type ViewSelection, type ViewerContext } from '$lib/stores/viewer';
	import { tasksByMilestoneStore } from '$lib/stores/tasks';
	import { todosByTaskStore, type TodosMap } from '$lib/stores/todos';
	import { APP_MODE_CONTEXT_KEY, type AppModeContext } from '$lib/context/appMode';

	let authOpen = $state(false);
	const DEFAULT_CHAT_WIDTH = 352;
	const MIN_CHAT_WIDTH = 260;
	const MAX_CHAT_WIDTH = 640;

	let { data, children }: LayoutProps = $props();
	const appModeContext: AppModeContext = { isDemo: true };
	setContext(APP_MODE_CONTEXT_KEY, appModeContext);

	let userId = $state(data.user?.id ?? null);
	let project = $state(data.project ?? null);
	let milestones = $state(data.milestones);
	let tasks = $state(data.tasks ?? []);
	$inspect('tasks: ', tasks);
	let tasksByMilestone = $state(data.tasksByMilestone ?? {});
	let todosByTask = $state(data.todosByTask ?? {});
	let currentMilestoneId = $state(data.currentMilestoneId ?? null);
	let currentTaskId = $state(data.currentTaskId ?? null);
	let chat = $state(data.chat);
	let chatWidth = $state(DEFAULT_CHAT_WIDTH);
	let resizingChat = $state(false);
	let selectedMilestoneId = $state<string | null>(null);
	let selectedTaskId = $state<string | null>(null);

	let headerElement = $state<HTMLElement | null>(null);
	let scrollContainer = $state<HTMLElement | null>(null);
	let headerHeight = $state(0);
	let thumbTop = $state(0);
	let thumbHeight = $state(0);
	let isScrolling = $state(false);
	let scrollHideTimeout: ReturnType<typeof setTimeout> | null = null;

	function updateThumb() {
		const el = scrollContainer;
		if (!el) return;

		const view = el.clientHeight;
		const content = el.scrollHeight;

		if (content <= view) {
			thumbTop = 0;
			thumbHeight = 0;
			return;
		}

		const ratio = view / content;
		const minThumb = 32;
		thumbHeight = Math.max(minThumb, view * ratio);

		const maxThumbTop = view - thumbHeight;
		const scrollRatio = el.scrollTop / (content - view);
		thumbTop = maxThumbTop * scrollRatio;
	}

	function handleScroll() {
		updateThumb();
		isScrolling = true;

		if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
		scrollHideTimeout = setTimeout(() => {
			isScrolling = false;
		}, 500);
	}

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
		if (data?.tasksByMilestone) {
			tasksByMilestoneStore.set(data.tasksByMilestone);
		}
		if (data?.todosByTask) {
			todosByTaskStore.set(data.todosByTask);
		}
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
	const LEFT_BTN = 28;
	const RIGHT_BTN = 28;
	const H_PAD = 20;
	const SPACER_EXPANDED = `calc(${EXPANDED_WIDTH} - ${LEFT_BTN + RIGHT_BTN + H_PAD}px)`;

	const selectionStore = writable<ViewSelection>({ type: 'project' });
	let currentSelection = $state<ViewSelection>({ type: 'project' });

	function selectProject() {
		selectionStore.set({ type: 'project' });
	}
	function selectMilestone(id: string) {
		selectionStore.set({ type: 'milestone', id });
	}
	function selectTask(id: string) {
		selectionStore.set({ type: 'task', id });
	}

	let breadcrumbMilestoneId = $derived.by((): string | null => {
		if (selectedMilestoneId) return selectedMilestoneId;
		if (selectedTaskId) {
			const t = tasks.find((t) => t.id === selectedTaskId);
			return t?.milestone_id ?? null;
		}
		return null;
	});

	let milestoneOrdinal = $derived.by((): number | null => {
		if (!breadcrumbMilestoneId) return null;
		const milestone = milestones.find((m) => m.id === breadcrumbMilestoneId);
		return milestone?.ordinal ?? null;
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
		currentSelection = selection;
		selectedTaskId = selection.type === 'task' ? selection.id : null;
		selectedMilestoneId = selection.type === 'milestone' ? selection.id : null;
	});

	onDestroy(() => {
		unsubscribeSelection();
	});

	const selectionKey = $derived.by(() => {
		const s = currentSelection;
		if (s.type === 'project') return 'project';
		if (s.type === 'milestone') return `m:${s.id}`;
		if (s.type === 'task') return `t:${s.id}`;
		return 'project';
	});

	$effect(() => {
		const s = selectionKey;
		const el = scrollContainer;
		if (!browser || !el) return;

		el.scrollTop = 0;
		el.scrollLeft = 0;

		queueMicrotask(() => {
			updateThumb();
		});
	});

	$effect(() => {
		const el = headerElement;
		if (!browser || !el) return;
		headerHeight = el.offsetHeight;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh w-full overflow-hidden bg-stone-50 text-stone-900">
	<div
		class={`fixed z-20 flex items-center overflow-hidden px-3 pt-3 pb-2 ${sidebarCollapsed ? 'bg-stone-50' : ''}`}
		style={`width:${EXPANDED_WIDTH};`}
	>
		<button
			type="button"
			onclick={() => {
				selectProject();
			}}
			class="flex h-7 w-7 items-center justify-center rounded-md text-stone-700 transition hover:bg-stone-200 hover:text-stone-900 duration-200 ease-out"
			aria-label="Go to home"
		>
			<img src={vectorUrl} alt="vector" class="h-5 w-5 opacity-80 hover:opacity-90 transition-opacity duration-200 ease-out" />
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

	<div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
		<main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div
				bind:this={headerElement}
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
				<button
					type="button"
					class="rounded-md px-1 py-0.5 hover:bg-stone-200 focus:outline-none"
					onclick={selectProject}
				>
					PROJECT
				</button>
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
					<button
						type="button"
						class="rounded-md px-1 py-0.5 hover:bg-stone-200 focus:outline-none disabled:opacity-50"
						onclick={() => {
							if (breadcrumbMilestoneId) {
								selectMilestone(breadcrumbMilestoneId);
							}
						}}
						disabled={!breadcrumbMilestoneId}
					>
						MILESTONE {milestoneOrdinal}
					</button>
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
					<button
						type="button"
						class="rounded-md px-1 py-0.5 hover:bg-stone-200 focus:outline-none disabled:opacity-50"
						onclick={() => {
							if (selectedTaskId) {
								selectTask(selectedTaskId);
							}
						}}
						disabled={!selectedTaskId}
					>
						TASK {taskOrdinal}
					</button>
				{/if}
			</div>

			<div
				bind:this={scrollContainer}
				class="scrollbar-hide flex-1 overflow-auto"
				onscroll={handleScroll}
			>
				{@render children()}
			</div>
		</main>

		<div
			class="relative h-full w-1 flex-shrink-0"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize chat panel"
		>
			<div
				class={`h-full w-1 flex-shrink-0 cursor-col-resize transition select-none ${
					resizingChat ? 'bg-stone-300' : 'bg-transparent hover:bg-stone-200/50'
				}`}
				onpointerdown={startChatResize}
			/>

			{#if thumbHeight > 0}
				<div
					class="pointer-events-none absolute right-0 w-full bg-stone-400/80 transition-opacity duration-150"
					style:top={`${thumbTop + headerHeight}px`}
					style:height={`${thumbHeight}px`}
					style:opacity={isScrolling ? 1 : 0}
				/>
			{/if}
		</div>
		<Chat
			conversationId={chat?.conversationId ?? null}
			initialMessages={chat?.messages ?? []}
			{userId}
			width={`${chatWidth}px`}
		/>
	</div>
</div>
