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
	import type { LayoutProps } from './$types';

	let authOpen = $state(false);
	const DEFAULT_CHAT_WIDTH = 352;
	const MIN_CHAT_WIDTH = 260;
	const MAX_CHAT_WIDTH = 640;

	let { data, children }: LayoutProps = $props();
	$inspect(data.milestones);

	let userId = $state(data.user?.id ?? null);

	let milestones = $state(data.milestones);
	let tasksByMilestone = $state(data.tasksByMilestone ?? {});
	let chat = $state(data.chat);
	let chatWidth = $state(DEFAULT_CHAT_WIDTH);
	let resizingChat = $state(false);

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
		tasksByMilestone = data.tasksByMilestone ?? {};
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
	const generateApi: GenerateAPI = { generateTask };
	setContext<GenerateAPI>('generate-task', generateApi);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh w-full overflow-hidden bg-stone-50 text-stone-900">
	{#if userId}
		<Sidebar {milestones} {tasksByMilestone} tutorial={data.tutorial} email={data?.user?.email} />
	{:else}
		<button
			type="button"
			onclick={openAuthModal}
			class="fixed top-3 left-3 flex items-center gap-2 rounded-md px-1 py-1 text-stone-700 transition hover:bg-stone-200 hover:text-stone-900"
			aria-label="Go to home"
		>
			<img src={vectorUrl} alt="vector" class="h-5 w-5" />
		</button>
	{/if}

	<div class="flex min-h-0 min-w-0 flex-1">
		<main class="min-h-0 min-w-0 flex-1 overflow-auto">
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
