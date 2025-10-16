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
		action?: Record<string, unknown> | null;
	};

	export type Deliverable = {
		file: string; // e.g., "dataset.py"
		spec?: string; // brief spec sentence
		how_to_implement?: string[]; // bullet list of steps
	};

	type MentorPacket = { title: string; content: string; action?: Record<string, unknown> | null };
	type ProjectSection = {
		name: string;
		overview: string;
		required_skills?: string[];
		what_and_how?: Deliverable[];
		learning_materials?: string[];
		code_snippets?: string[];
		python_functions?: string[];
	};

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

	let sections = $state<ProjectSection[]>(project.metadata);
	let sectionsDropdownOpen = $state(false);
	let dropdownTrigger = $state<HTMLButtonElement | null>(null);
	let dropdownMenu = $state<HTMLDivElement | null>(null);
	let selectedSection = $derived<ProjectSection | null>(sections[0]);
	let lastProjectId = $state<string | null>(null);

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
					required_skills: arr(o.required_skills),
					learning_materials: arr(o.learning_materials),
					code_snippets: arr(o.code_snippets),
					python_functions: arr(o.python_functions)
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

	function areSectionsEqual(a: ProjectSection[], b: ProjectSection[]) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i += 1) {
			const left = a[i];
			const right = b[i];
			if (!right) return false;
			if (left.name !== right.name) return false;
			if (left.overview !== right.overview) return false;
		}
		return true;
	}

	function getSectionElementId(index: number) {
		return `project-section-${index}`;
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
</script>

<div class="flex h-full flex-col text-sm leading-6">
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
		class="project-chat-scroll flex-1 space-y-3 overflow-y-auto pr-5 pb-4"
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

							{#if selectedSection.what_and_how?.length}
								<div class="mt-2">
									<p class="text-xs font-semibold tracking-tight text-stone-900">Deliverables</p>
									<ul
										class="mt-1 divide-y divide-stone-200 rounded-lg border border-stone-200 text-xs"
									>
										{#each selectedSection.what_and_how as item, i (item.file)}
											<li class="p-0">
												<details class="group">
													<summary
														class="flex w-full cursor-pointer items-center justify-between px-3 py-2 select-none"
													>
														<div class="flex min-w-0 items-center gap-2">
															<button
																type="button"
																class="group relative grid h-3 w-3 place-items-center rounded-full focus:outline-none
           {isDone(item.file) ? 'bg-[#2D2D2D]' : ''}"
																role="checkbox"
																aria-checked={isDone(item.file)}
																aria-label={isDone(item.file) ? 'Mark as not done' : 'Mark as done'}
																onclick={(e) => toggleDone(item.file, e)}
																onkeydown={(e) =>
																	(e.key === ' ' || e.key === 'Enter') && toggleDone(item.file, e)}
															>
																{#if !isDone(item.file)}
																	<!-- dashed ring (default) -->
																	<span
																		class="pointer-events-none absolute inset-0 scale-100 rounded-full border border-dashed
               border-stone-400 opacity-100
               transition-[opacity,transform] duration-200 ease-out
               group-hover:scale-95 group-hover:opacity-0"
																	/>
																	<!-- solid ring (on hover) -->
																	<span
																		class="pointer-events-none absolute inset-0 scale-95 rounded-full border
               border-stone-400 opacity-0
               transition-[opacity,transform] duration-200 ease-out
               group-hover:scale-100 group-hover:opacity-100"
																	/>
																{/if}

																{#if isDone(item.file)}
																	<!-- animated check -->
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
																{/if}
															</button>

															<span
																class="file-label strike-anim min-w-0 font-mono tracking-tighter break-words
           {isDone(item.file) ? 'done text-stone-400' : 'text-stone-800'}"
															>
																{item.file}
															</span>
														</div>

														<!-- Right: chevron -->
														<svg
															class="ml-2 h-3.5 w-3.5 shrink-0 text-stone-500 transition-transform duration-200 group-open:rotate-90"
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
													</summary>

													<div class="space-y-2 px-3 pt-1 pb-3 text-stone-700">
														{#if item.spec}
															<div class="pl-5 break-words">
																<span class=" text-stone-700/90">{item.spec}</span>
															</div>
														{/if}

														{#if item.how_to_implement?.length}
															<div class="space-y-1 pl-5">
																<div class="text-stone-900">How to implement</div>
																<ul class="list-disc space-y-1 pl-5">
																	{#each item.how_to_implement as imp}
																		<li class="break-words text-stone-700/90">{imp}</li>
																	{/each}
																</ul>
															</div>
														{/if}
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
									<ul class="mt-1 list-disc pl-5 text-xs">
										{#each selectedSection.learning_materials as item}
											<li class="break-words">{item}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Code Snippets (as bullet text; switch to <pre> if you later store code blocks) -->
							{#if selectedSection.code_snippets?.length}
								<div class="mt-2">
									<p class="text-xs font-semibold tracking-tight text-stone-900">Code Snippets</p>
									<ul class="mt-1 list-disc pl-5 text-xs">
										{#each selectedSection.code_snippets as item}
											<li class="break-words">{item}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Python Functions -->
							{#if selectedSection.python_functions?.length}
								<div class="mt-2">
									<p class="text-[11px] font-medium text-stone-600">Python Functions</p>
									<ul class="mt-1 list-disc pl-5 text-xs">
										{#each selectedSection.python_functions as item}
											<li class="break-words">{item}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="text-xs text-stone-500">No section selected.</div>
				{/if}
			</div>
		{/if}
	</div>
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
		animation:
			draw-check 420ms ease-out forwards,
			erase-check 320ms ease-in 1020ms forwards;
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
		transition: color 220ms ease 0ms; /* color fades after 500ms delay */
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
		transition: transform 220ms ease 0ms; /* draw after 500ms delay */
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
</style>
