<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import projectData from '$lib/mock/project.sample.json';
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import { isProject, type Project } from '$lib/types/project';
	import { getContext, tick } from 'svelte';
	import { onMount } from 'svelte';

	type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';
	let toastOpen = $state(false);
	let toastMessage = $state('');
	let toastTone = $state<ToastTone>('neutral');

	async function showToast(message: string, tone: ToastTone = 'neutral') {
		toastMessage = message;
		toastTone = tone;
		toastOpen = false;
		await tick();
		toastOpen = true;
	}

	type AuthUI = {
		openAuthModal: () => void;
		closeAuthModal: () => void;
	};

	const { openAuthModal } = getContext<AuthUI>('auth-ui');
	const fallbackProject = projectData as Project;
	const navigationState = import.meta.env.SSR
		? undefined
		: (get(page).state as { project?: unknown; fallback?: boolean } | undefined);
	const generatedCandidate = navigationState?.project;
	const hasGeneratedProject = true; // isProject(generatedCandidate)
	const project = $state<Project>(
		hasGeneratedProject ? (generatedCandidate as Project) : fallbackProject
	);
	const usingFallback = $state(navigationState?.fallback === true || !hasGeneratedProject);

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	async function createIntroConversation(projectId: string, userId: string) {
		const { error } = await supabase
			.from('conversations')
			.insert([{ project_id: projectId, user_id: userId, title: 'Introduction' }]);

		if (error) {
			throw error;
		}
	}

	async function saveProject() {
		if (saving) return;
		saveError = null;
		saving = true;

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (!user) {
				sessionStorage.setItem('vector:cached-project', JSON.stringify(project));
				openAuthModal();
				return;
			}

			const insertPayload = {
				user_id: user.id,
				title: project.title,
				difficulty: project.difficulty,
				timeline: project.timeline,
				description: project.description,
				jobs: project.jobs,
				skills: project.skills,
				metadata: project.metadata
			};

			const { data, error } = await supabase
				.from('projects')
				.insert([insertPayload])
				.select('id')
				.single();

			if (error) throw error;
			if (!data?.id) {
				throw new Error('Project saved without an id.');
			}

			await createIntroConversation(data.id, user.id);

			dashboardProjects.invalidate();
			saving = false;
			await goto('/dashboard');
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Unable to save project right now.';
			saving = false;
		}
	}
	onMount(() => {
		if (usingFallback) {
			showToast('This is hardcoded... text 5109358199 any complaints.', 'warning');
		}
	});
</script>

<div class="flex h-full w-full flex-col bg-stone-50">
	<div class="flex w-full px-2 py-2">
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-stone-400 transition hover:text-stone-900"
			aria-label="Back"
			onclick={() => goto('/')}
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			Back
		</button>
	</div>

	<!-- This wrapper is the scroller's *bounded* container -->
	<div class="mx-auto min-h-0 w-full max-w-4xl flex-1 px-4">
		<!-- Make ProjectDetail fill that space -->
		<div class="h-full overflow-y-auto pb-8">
			<ProjectDetail {project} {saving} {saveError} {saveProject} showSaveButton />
		</div>
	</div>
</div>
<Toast
	message={toastMessage}
	tone={toastTone}
	open={toastOpen}
	on:dismiss={() => (toastOpen = false)}
/>
