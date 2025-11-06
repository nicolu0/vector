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

	type InitProjectResponse = {
		project: { id: string; title: string; description: string; domain: 'research' | 'internship' };
		milestones: Array<{ id: string; ordinal: number; title: string; summary: string }>;
	};

	let { data, children }: LayoutProps = $props();
	$inspect(data.milestones);

	let goal = $state(data.goal ?? '');
	let userId = $state(data.user?.id ?? null);

	const isAuthed = $derived(Boolean(userId));

	let dbProject = $state(data.project);
	let project = $state<InitProjectResponse['project'] | null>(null);
	let milestones = $state(data.milestones);
	let tasksByMilestone = $state(data.tasksByMilestone ?? {});
	let initLoading = $state(false);
	let projectInitialized = $state(false);

	type AuthUI = {
		openAuthModal: () => void;
		signInWithGoogle: (redirectPath?: string) => Promise<void>;
		signOut: () => Promise<void>;
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
		goal = data.goal ?? '';
		tasksByMilestone = data.tasksByMilestone ?? {};
	});

	async function signOut() {
		await supabase.auth.signOut();
		userId = null;
		await goto('/');
	}

	const authApi: AuthUI = { openAuthModal, signInWithGoogle, signOut };
	setContext<AuthUI>('auth-ui', authApi);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-dvh w-full overflow-hidden bg-stone-50 text-stone-900">
	{#if userId}
		<Sidebar {milestones} {tasksByMilestone} />
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

	<main class="min-h-0 min-w-0 flex-1 overflow-auto">
		{@render children()}
	</main>
	{#if userId}
		<Chat />
	{/if}

	<AuthModal open={authOpen} onClose={closeAuthModal} {signInWithGoogle} />
</div>
