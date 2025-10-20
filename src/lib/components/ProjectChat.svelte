<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly, slide, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';
	import { dashboardProjects } from '$lib/stores/dashboardProjects';
	import type { StoredProject } from '$lib/stores/dashboardProjects';
	import { tick } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';

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

	export type Deliverable = {
		task: string;
		spec: string;
		implementation: string[];
		code: string;
	};

	export type LearningMaterial = {
		title: string;
		body: string;
	};

	type MentorPacket = { title: string; content: string; action?: Record<string, unknown> | null };
	type ProjectSection = {
		name: string;
		overview: string;
		deliverables: Deliverable[];
		learning_materials: LearningMaterial[];
	};

	/* -------- Config -------- */
	const PERSISTENT_SPACER_HEIGHT = 160; // px

	let messages = $state<ChatMessage[]>([]);

	let sections = $state<ProjectSection[]>(project.metadata);
	let sectionsDropdownOpen = $state(false);
	let dropdownTrigger = $state<HTMLButtonElement | null>(null);
	let dropdownMenu = $state<HTMLDivElement | null>(null);
	let selectedSection = $derived<ProjectSection | null>(sections[0]);

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

	let currentIndex = $derived(sections.findIndex((s) => s === selectedSection));

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

	/** New metadata schema: metadata is an array of “sections”. */
	function sanitizeSections(value: unknown): ProjectSection[] {
		if (!Array.isArray(value)) return [];
		return value
			.map((item) => {
				if (!item || typeof item !== 'object') return null;
				const o = item as Record<string, unknown>;
				const name = typeof o.name === 'string' ? o.name : null;
				const overview = typeof o.overview === 'string' ? o.overview : null;

				// Optional arrays; coerce to string[]
				const arr = (v: unknown) =>
					Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

				if (!name || !overview) return null;
				return {
					name,
					overview,
					deliverables: Array.isArray(o.deliverables)
						? o.deliverables.map((d: unknown) => {
								if (!d || typeof d !== 'object')
									return { task: '', spec: '', implementation: [], code: '' };
								const deliverable = d as Record<string, unknown>;
								return {
									task: typeof deliverable.task === 'string' ? deliverable.task : '',
									spec: typeof deliverable.spec === 'string' ? deliverable.spec : '',
									implementation: Array.isArray(deliverable.implementation)
										? deliverable.implementation.filter((item: unknown) => typeof item === 'string')
										: [],
									code: typeof deliverable.code === 'string' ? deliverable.code : ''
								};
							})
						: [],
					learning_materials: Array.isArray(o.learning_materials)
						? o.learning_materials.map((m: unknown) => {
								if (!m || typeof m !== 'object') return { title: '', body: '' };
								const material = m as Record<string, unknown>;
								return {
									title: typeof material.title === 'string' ? material.title : '',
									body: typeof material.body === 'string' ? material.body : ''
								};
							})
						: []
				};
			})
			.filter(Boolean) as ProjectSection[];
	}

	function buildProjectContextPayload(currentProject: StoredProject) {
		const sections = sanitizeSections(currentProject.metadata);

		return {
			title: currentProject.title,
			description: currentProject.description,
			difficulty: currentProject.difficulty,
			timeline: currentProject.timeline,
			skills: currentProject.skills ?? [],
			metadata: sections,
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

	async function continueToNextSection() {
		if (!allDeliverablesDone) {
			await showToast('Complete all deliverables before continuing.', 'warning');
			return;
		}
		if (currentIndex == null || currentIndex < 0) return;
	}

	function toggleSectionsDropdown() {
		if (!sections.length) return;
		sectionsDropdownOpen = !sectionsDropdownOpen;
	}

	function closeSectionsDropdown() {
		if (!sectionsDropdownOpen) return;
		sectionsDropdownOpen = false;
	}

	function selectSection(index: number) {
		const section = sections[index];
		if (!section) return;
		selectedSection = section;
		closeSectionsDropdown();
	}

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

	$effect(() => {
		if (!project) {
			resetSpacerState();
			return;
		}
		recomputeSpacer();
	});

	const deliverableFiles = $derived<string[]>(
		Array.from(
			new Set(
				(selectedSection?.deliverables ?? [])
					.map((d) => d?.task)
					.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
			)
		)
	);

	const totalDeliverables = $derived<number>(deliverableFiles.length);

	const completedDeliverables = $derived<number>(
		deliverableFiles.reduce((acc, f) => acc + (isDone(f) ? 1 : 0), 0)
	);

	// Allow continue if none are required OR all are done
	const allDeliverablesDone = $derived<boolean>(
		totalDeliverables === 0 || completedDeliverables >= totalDeliverables
	);

	let hintOpen = $state<Record<string, boolean>>({});

	function toggleHint(file: string, e?: MouseEvent | KeyboardEvent) {
		e?.preventDefault();
		e?.stopPropagation();
		hintOpen[file] = !hintOpen[file];
	}

	function hintIdFor(file: string) {
		// basic id safe-ifier
		return `hint-${file.replace(/[^a-z0-9_-]/gi, '-')}`;
	}

	let loadingFiles = $state<Record<string, boolean>>({});

	function isLoading(file: string) {
		return !!loadingFiles[file];
	}

	let completingFiles = $state<Record<string, boolean>>({});

	function isCompleting(file: string) {
		return !!completingFiles[file];
	}

	async function markDoneAsync(file: string, e?: MouseEvent | KeyboardEvent) {
		e?.preventDefault();
		e?.stopPropagation();
		if (isDone(file) || isLoading(file) || isCompleting(file)) return;

		// 1) loading (your current spinner)
		loadingFiles[file] = true;
		try {
			// TODO: replace with real API call
			await new Promise((r) => setTimeout(r, 4000));
		} finally {
			loadingFiles[file] = false;
		}

		// 2) completing: draw the ring
		completingFiles[file] = true;
		try {
			// let the ring-draw animation play (keep in sync with CSS duration)
			await new Promise((r) => setTimeout(r, 320));
			// 3) completed: your existing check
			completedFiles[file] = true;
		} finally {
			completingFiles[file] = false;
		}
	}

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
		if (messages.length === 0) return;
		maybeLockSpacer();
	});

	$effect(() => {
		if (!sectionsDropdownOpen) return;
		if (typeof window === 'undefined') return;

		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) return;
			if (dropdownTrigger?.contains(target)) return;
			if (dropdownMenu?.contains(target)) return;
			closeSectionsDropdown();
		};

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeSectionsDropdown();
			}
		};

		window.addEventListener('click', handleClick);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('click', handleClick);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	let completedFiles = $state<Record<string, boolean>>({});

	function isDone(file: string) {
		return !!completedFiles[file];
	}
	function toggleDone(file: string, e?: MouseEvent | KeyboardEvent) {
		e?.preventDefault();
		e?.stopPropagation();
		completedFiles[file] = !completedFiles[file];
	}

	const hintText: Record<string, string> = {
		'dataset.py': `
const value = 'the code lol';
const another = 'example';
function demo() {
  return '🙂';
}`
	};
</script>

<div
	class="flex h-full [transform:translateZ(0)] flex-col text-sm leading-6"
	style="--pane-footer-h: 48px; --pane-footer-gap: 8px; --pane-fade-h: 20px;"
>
	<div class="flex w-full flex-row py-4 pr-5 pl-1">
		<div class="relative flex w-full flex-row">
			<div class="relative w-full rounded-xl pl-1 text-start text-stone-900">
				<span class="block overflow-hidden pr-8 whitespace-nowrap">
					{selectedSection?.name}
				</span>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-stone-100 to-transparent"
				/>
			</div>
			<button
				type="button"
				class="inline-grid h-6 w-6 place-items-center rounded-sm text-stone-600 transition hover:bg-stone-200/70 hover:text-stone-900 focus:outline-none disabled:opacity-60"
				onclick={toggleSectionsDropdown}
				bind:this={dropdownTrigger}
				aria-haspopup="listbox"
				aria-expanded={sectionsDropdownOpen}
				disabled={sections.length === 0}
			>
				<!-- Animated hamburger / close -->
				<span class="relative inline-block h-4 w-3" aria-hidden="true">
					<!-- top bar -->
					<span
						class="absolute top-1/2 right-0 left-0 block h-px rounded bg-current
             transition-transform duration-200 ease-in-out"
						class:-translate-y-[4px]={!sectionsDropdownOpen}
						class:translate-y-0={sectionsDropdownOpen}
						class:rotate-45={sectionsDropdownOpen}
					/>
					<!-- middle bar -->
					<span
						class="absolute top-1/2 right-0 left-0 block h-px origin-center rounded-full bg-current
             transition-transform duration-200 ease-in-out"
						style:transform={`scaleX(${sectionsDropdownOpen ? 0.08 : 1})`}
					/>
					<!-- bottom bar -->
					<span
						class="absolute top-1/2 right-0 left-0 block h-px rounded bg-current
             transition-transform duration-200 ease-in-out"
						class:translate-y-[4px]={!sectionsDropdownOpen}
						class:translate-y-0={sectionsDropdownOpen}
						class:-rotate-45={sectionsDropdownOpen}
					/>
				</span>
			</button>

			{#if sectionsDropdownOpen}
				<div
					class="absolute top-full right-0 left-0 z-20 mt-2 rounded-lg border border-stone-200 bg-stone-100 shadow-2xl"
					in:fly|global={{ y: -4, duration: 200, easing: cubicOut }}
					bind:this={dropdownMenu}
				>
					{#if sections.length === 0}
						<div class="px-3 py-2 text-stone-400">No sections available</div>
					{:else}
						<ul class="flex flex-col gap-y-1 overflow-y-auto p-2" role="listbox">
							{#each sections as section, index}
								<button
									type="button"
									class="flex w-full items-start rounded-lg px-3 py-2 text-left hover:bg-stone-200/60"
									class:bg-stone-200={section === selectedSection}
									onclick={() => selectSection(index)}
									role="option"
									aria-selected={selectedSection?.name === section.name}
								>
									<span class="text-left text-xs text-stone-900">{section.name}</span>
								</button>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div
		class="project-chat-scroll flex-1 space-y-3 overflow-y-auto pr-5"
		style="padding-bottom: calc(var(--pane-footer-h) + var(--pane-footer-gap));"
		bind:this={messagesContainer}
	>
		{#if project.metadata}
			<div
				in:fly|global={{ x: 8, duration: 400, easing: cubicOut }}
				class="flex flex-col gap-y-10 pl-2 text-stone-600"
			>
				{#if selectedSection}
					<div class="flex justify-start">
						<div class="flex flex-col gap-2">
							{#if selectedSection.overview}
								<div>
									<p class="text-xs font-semibold tracking-tight text-stone-900">Overview</p>
									<p class="mt-1 text-xs">
										{selectedSection.overview}
									</p>
								</div>
							{/if}

							{#if selectedSection.deliverables?.length}
								<div class="mt-2">
									<p class="text-xs font-semibold tracking-tight text-stone-900">Deliverables</p>
									<ul class="mt-1 divide-y divide-stone-200 rounded-lg text-xs">
										{#each selectedSection.deliverables as item, i (item.task)}
											<li class="p-0">
												<details class="group">
													<summary
														class="flex w-full cursor-pointer items-center justify-between px-3 py-2 select-none"
													>
														<div class="flex min-w-0 items-center gap-2">
															<button
																type="button"
																class="group relative grid h-3 w-3 place-items-center rounded-full focus:outline-none
    {isDone(item.task) ? 'bg-stone-900' : ''}"
																role="checkbox"
																aria-checked={isDone(item.task)}
																aria-label={isLoading(item.task)
																	? 'Marking as done…'
																	: isDone(item.task)
																		? 'Mark as not done'
																		: 'Mark as done'}
																title={isLoading(item.task)
																	? 'Marking as done…'
																	: isDone(item.task)
																		? 'Mark as not done'
																		: 'Mark as done'}
																onclick={(e) => {
																	if (isLoading(item.task) || isCompleting(item.task)) return;
																	if (isDone(item.task)) toggleDone(item.task, e);
																	else markDoneAsync(item.task, e);
																}}
																disabled={isLoading(item.task) || isCompleting(item.task)}
															>
																{#if isLoading(item.task)}
																	<!-- (unchanged) your existing spinner -->
																	<svg
																		class="absolute inset-0 h-3 w-3 animate-spin"
																		viewBox="0 0 12 12"
																		fill="none"
																		aria-hidden="true"
																	>
																		<circle
																			cx="6"
																			cy="6"
																			r="5.3"
																			stroke="currentColor"
																			stroke-width="0.8"
																			class="text-stone-400"
																			vector-effect="non-scaling-stroke"
																			style="shape-rendering: geometricPrecision;"
																		/>
																		<path
																			d="M6 0.75 A5.25 5.25 0 0 1 11.25 6"
																			stroke="currentColor"
																			stroke-width="0.8"
																			stroke-linecap="round"
																			fill="none"
																			class="text-stone-900 opacity-90"
																			vector-effect="non-scaling-stroke"
																			style="shape-rendering: geometricPrecision;"
																		/>
																	</svg>
																{:else if isCompleting(item.task)}
																	<!-- NEW: draw the ring, then we’ll flip to completed (check) -->
																	<svg
																		class="absolute inset-0 h-3 w-3"
																		viewBox="0 0 12 12"
																		fill="none"
																		aria-hidden="true"
																	>
																		<!-- faint base ring -->
																		<circle
																			cx="6"
																			cy="6"
																			r="5.3"
																			stroke="currentColor"
																			stroke-width="0.8"
																			class="text-stone-300 opacity-80"
																			vector-effect="non-scaling-stroke"
																		/>
																		<!-- ring draws from 12 o’clock -->
																		<circle
																			cx="6"
																			cy="6"
																			r="5.3"
																			stroke="currentColor"
																			stroke-width="0.8"
																			fill="none"
																			stroke-linecap="round"
																			class="ring-draw text-stone-900"
																			vector-effect="non-scaling-stroke"
																		/>
																	</svg>
																{:else if isDone(item.task)}
																	<!-- (unchanged) your existing check -->
																	<svg
																		viewBox="0 0 24 24"
																		class="h-3 w-3 text-stone-50"
																		fill="none"
																		aria-hidden="true"
																	>
																		<path
																			d="M7 12.5 L10.25 15.75 L16.75 9.25"
																			pathLength="0.5"
																			class="check-path"
																			stroke="currentColor"
																			stroke-width="2"
																			stroke-linecap="round"
																			stroke-linejoin="round"
																		/>
																	</svg>
																{:else}
																	<!-- (unchanged) idle rings -->
																	<span
																		class="pointer-events-none absolute inset-0 scale-95 rounded-full border border-[1px]
                border-dashed border-stone-400 opacity-100 transition-[opacity,transform] duration-200 ease-out
                group-hover:scale-95 group-hover:opacity-0"
																	/>
																	<span
																		class="pointer-events-none absolute inset-0 scale-95 rounded-full border border-[1px]
                border-stone-400 opacity-0 transition-[opacity,transform] duration-200 ease-out
                group-hover:scale-95 group-hover:opacity-100"
																	/>
																{/if}
															</button>

															<span
																class="task-label strike-anim min-w-0 font-mono tracking-tighter break-words
           {isDone(item.task) ? 'done text-stone-400' : 'text-stone-800'}"
															>
																{item.task ?? 'Create ' + item.task}
															</span>
														</div>

														<div class="flex flex-row items-center justify-center gap-1">
															{#if isLoading(item.task)}
																<span
																	class="file-label sheen relative inline-flex min-w-0 items-center gap-1 self-end text-[9px] text-stone-400"
																	transition:fly|global={{
																		y: 1,
																		duration: 200,
																		easing: cubicOut
																	}}
																	aria-live="polite"
																>
																	<span>Syncing</span>
																	<!-- GitHub mark -->
																	<svg
																		class="h-3 w-3"
																		viewBox="0 0 16 16"
																		fill="currentColor"
																		aria-hidden="true"
																	>
																		<path
																			d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38
           0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
           -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
           .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
           0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.11 0 0 .67-.21 2.2.82
           .64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82
           .44 1.1.16 1.91.08 2.11.51.56.82 1.27.82 2.15
           0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
           0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8
           c0-4.42-3.58-8-8-8z"
																		/>
																	</svg>
																</span>
															{/if}

															<svg
																class="ml-2 h-3 w-3 shrink-0 text-stone-500 transition-transform duration-200 group-open:rotate-90"
																viewBox="0 0 20 20"
																fill="currentColor"
																aria-hidden="true"
															>
																<path
																	fill-rule="evenodd"
																	d="M6.22 7.22a.75.75 0 0 1 1.06 0L10 9.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 8.28a.75.75 0 0 1 0-1.06z"
																	clip-rule="evenodd"
																/>
															</svg>
														</div>
													</summary>

													<div class="space-y-2 px-3 pt-1 pb-3 text-stone-700">
														{#if item.spec}
															<div class="pl-5 break-words">
																<span class=" text-stone-700/90">{item.spec}</span>
															</div>
														{/if}

														{#if item.implementation?.length}
															<div class="space-y-1 pl-5">
																<div class="text-stone-900">How to implement</div>
																<ul class="list-disc space-y-1 pl-5">
																	{#each item.implementation as imp}
																		<li class="break-words text-stone-700/90">{imp}</li>
																	{/each}
																</ul>
															</div>
														{/if}
														<!-- Hint block -->
														<div class="px-3">
															<div class="mt-2 overflow-hidden rounded-lg border border-stone-200">
																<!-- Header bar -->
																<button
																	type="button"
																	class="flex w-full items-center justify-between bg-stone-900 px-3 py-1.5 text-[11px] text-stone-50 hover:bg-stone-800 focus:ring-2 focus:ring-stone-400/40 focus:outline-none"
																	onclick={(e) => toggleHint(item.task, e)}
																	aria-expanded={!!hintOpen[item.task]}
																	aria-controls={hintIdFor(item.task)}
																>
																	<!-- left: filename -->
																	<span class="font-mono tracking-tight">{item.task}</span>

																	<!-- right: Show/Hide + chevron -->
																	<span class="inline-flex items-center gap-1 text-stone-200">
																		{hintOpen[item.task] ? 'Hide Hint' : 'Show Hint'}
																		<svg
																			class="h-3 w-3 transition-transform duration-200"
																			viewBox="0 0 20 20"
																			fill="currentColor"
																			aria-hidden="true"
																			style:transform={`rotate(${hintOpen[item.task] ? 180 : 0}deg)`}
																		>
																			<path
																				fill-rule="evenodd"
																				d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
																				clip-rule="evenodd"
																			/>
																		</svg>
																	</span>
																</button>

																<!-- Expanding body -->
																{#if hintOpen[item.task]}
																	<div
																		id={hintIdFor(item.task)}
																		class="bg-stone-950/95"
																		in:slide={{ duration: 180, easing: cubicOut }}
																		out:slide={{ duration: 140, easing: cubicOut }}
																	>
																		<pre
																			class="max-h-40 overflow-auto px-4 py-3 text-[11px] leading-relaxed text-stone-100 md:px-5">
<code>{hintText[item.task] ?? `// no hint for ${item.task}`}</code>
        </pre>
																	</div>
																{/if}
															</div>
														</div>
													</div>
												</details>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Learning Materials -->
							{#if selectedSection.learning_materials?.length}
								<div class="mt-2">
									<p class="text-xs font-semibold tracking-tight text-stone-900">
										Learning Materials
									</p>
									<div class="mt-1 space-y-3">
										{#each selectedSection.learning_materials as material}
											<div class="rounded-lg border border-stone-200 bg-stone-50 p-3">
												<h4 class="text-sm font-medium text-stone-900">{material.title}</h4>
												<p class="mt-1 text-xs text-stone-600">{material.body}</p>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="text-xs text-stone-500">No section selected.</div>
				{/if}
			</div>
		{/if}
		{#if sections.length > 1 && currentIndex > -1 && currentIndex < sections.length - 1}
			<div class="fixed inset-x-0 bottom-0 z-20 pr-3">
				<div
					class="pointer-events-none absolute right-0 left-0"
					style="
        top: calc(-1 * var(--pane-fade-h));
        height: var(--pane-fade-h);
        background: linear-gradient(
          to top,
          rgb(245, 245, 245) 0%,
          rgba(245,245,245,0.8) 50%,
          rgba(245,245,245,0) 100%
        );
      "
				></div>

				<div
					class="relative flex h-[var(--pane-footer-h)] items-center justify-between
               border-t border-stone-100 bg-stone-100 px-3"
				>
					<div class="text-xs text-stone-600">
						{completedDeliverables}/{totalDeliverables} Deliverables Completed
					</div>

					<button
						type="button"
						class="group inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs
         text-stone-700 transition hover:bg-stone-200/60 focus:outline-none
         disabled:cursor-not-allowed disabled:opacity-50"
						onclick={continueToNextSection}
						disabled={!allDeliverablesDone}
						aria-disabled={!allDeliverablesDone}
						title={!allDeliverablesDone
							? 'Finish all deliverables first'
							: `Continue to ${sections[currentIndex + 1].name}`}
					>
						Continue

						<!-- wrapper gets the looping animation only when enabled -->
						<span class="inline-block" class:arrow-wiggle={allDeliverablesDone}>
							<svg
								viewBox="0 0 24 24"
								class="h-3.5 w-3.5 translate-x-0 transition-transform duration-150 ease-out"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M3 12h14" />
								<path d="M13 7l5 5-5 5" />
							</svg>
						</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
	<Toast
		message={toastMessage}
		tone={toastTone}
		open={toastOpen}
		on:dismiss={() => (toastOpen = false)}
	/>
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
	:global(.project-chat-scroll)::after {
		transition: opacity 220ms ease;
	}

	.check-path {
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		fill: none;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw-check 420ms ease-out 200ms forwards;
	}

	@keyframes draw-check {
		to {
			stroke-dashoffset: 0;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.check-path {
			animation: none;
			stroke-dashoffset: 0;
		}
	}

	/* Base: inline element with an animatable strike line */
	.strike-anim {
		position: relative;
		display: inline-block; /* so the ::after width matches the text */
		transition: color 220ms ease 200ms; /* color fades after 500ms delay */
	}

	/* The “strike” line */
	.strike-anim::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1.5px;
		background: currentColor;
		transform: scaleX(0);
		transform-origin: left center;
		transition: transform 220ms ease 200ms; /* draw after 500ms delay */
		pointer-events: none;
	}

	/* When marked done: draw the line (with the 500ms delay above) */
	.strike-anim.done::after {
		transform: scaleX(1);
	}

	/* When toggling back to not-done: remove delay so it clears immediately */
	.strike-anim:not(.done) {
		transition-delay: 0ms;
	}
	.strike-anim:not(.done)::after {
		transition-delay: 0ms;
	}

	/* Reduce-motion users: no animation, just show/hide */
	@media (prefers-reduced-motion: reduce) {
		.strike-anim,
		.strike-anim::after {
			transition: none !important;
		}
	}
	/* subtle horizontal nudge */
	@keyframes nudge-x {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(2px);
		} /* ~translate-x-0.5 */
	}

	.arrow-wiggle {
		animation: nudge-x 1.2s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.arrow-wiggle {
			animation: none !important;
		}
	}
	/* Shiny sheen that sweeps across the whole inline group */
	.sheen {
		position: relative;
		overflow: hidden; /* contain the sweeping highlight */
	}

	.sheen::after {
		content: '';
		position: absolute;
		inset: -6px 0; /* a bit taller to catch tiny icons/text */
		pointer-events: none;
		/* angled highlight band with soft edges */
		background: linear-gradient(
			110deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0) 35%,
			rgba(255, 255, 255, 0.55) 50%,
			rgba(255, 255, 255, 0) 65%,
			rgba(255, 255, 255, 0) 100%
		);
		transform: translateX(-150%);
		animation: sheen-sweep 1.6s ease-in-out infinite;
		mix-blend-mode: screen; /* lets the highlight “lift” both text and icon */
		opacity: 0.9; /* tweak for subtlety on light UIs */
	}

	@keyframes sheen-sweep {
		to {
			transform: translateX(150%);
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.sheen::after {
			animation: none;
			opacity: 0;
		}
	}
	/* ===== Completing ring draw ===== */
	.ring-draw {
		stroke-dasharray: 0 33.3; /* start with nothing drawn */
		stroke-dashoffset: 0;
		animation: ring-draw-kf 300ms ease-out forwards;
	}

	@keyframes ring-draw-kf {
		to {
			stroke-dasharray: 33.3 0; /* draw full circle */
		}
	}

	/* reduce motion: no animation */
	@media (prefers-reduced-motion: reduce) {
		.ring-draw {
			animation: none !important;
			stroke-dasharray: 33.3 0 !important;
		}
	}
</style>
