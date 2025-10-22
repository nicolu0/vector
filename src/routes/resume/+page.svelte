<script lang="ts">
	import { resumeStore, type ResumeData } from '$lib/stores/resume';
	import ResumeRate from '$lib/components/ResumeRate.svelte';
	import PdfViewer from '$lib/components/PdfViewer.svelte';
	import WaitlistModal from '$lib/components/WaitlistModal.svelte';
	import { onDestroy } from 'svelte';

	// resume state
	let resume = $state<ResumeData>({ file: null, url: null, text: '', filename: null });
	const unsub = resumeStore.subscribe((v: ResumeData) => (resume = v));
	onDestroy(unsub);

	let showWaitlist = $state(false);

	// --- Resizable split (same pattern as dashboard) ---
	const HANDLE_WIDTH = 8; // interactive area (visual line can stay 1px)
	const MIN_LEFT_WIDTH = 420; // PDF viewer min width
	const MIN_RIGHT_WIDTH = 380; // text pane min width
	const MAX_LEFT_WIDTH = 900;

	let containerWidth = $state(0);
	let leftPanelWidth = $state(520); // initial left width
	let isResizing = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;
	let activePointerId: number | null = null;

	function clampLeftWidth(width: number) {
		if (containerWidth <= 0) {
			return Math.min(Math.max(width, MIN_LEFT_WIDTH), MAX_LEFT_WIDTH);
		}
		const available = Math.max(containerWidth - MIN_RIGHT_WIDTH - HANDLE_WIDTH, MIN_LEFT_WIDTH);
		const maxWidth = Math.min(MAX_LEFT_WIDTH, available);
		const minWidth = Math.min(MIN_LEFT_WIDTH, maxWidth);
		const clamped = Math.min(Math.max(width, minWidth), maxWidth);
		return Number.isFinite(clamped) ? clamped : minWidth;
	}

	function startResize(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		isResizing = true;
		activePointerId = e.pointerId;
		dragStartX = e.clientX;
		dragStartWidth = leftPanelWidth;

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', stopResize);
		window.addEventListener('pointercancel', stopResize);
		document.body.style.cursor = 'col-resize';
	}

	function onMove(e: PointerEvent) {
		if (!isResizing || e.pointerId !== activePointerId) return;
		const delta = e.clientX - dragStartX;
		leftPanelWidth = clampLeftWidth(dragStartWidth + delta);
	}

	function stopResize(e?: PointerEvent) {
		if (!isResizing) return;
		if (e && e.pointerId !== activePointerId) return;
		isResizing = false;
		activePointerId = null;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', stopResize);
		window.removeEventListener('pointercancel', stopResize);
		document.body.style.cursor = '';
	}

	onDestroy(stopResize);

	$effect(() => {
		leftPanelWidth = clampLeftWidth(leftPanelWidth);
	});
</script>

<div
	class="flex h-[calc(100svh-56px)] w-full items-stretch bg-stone-50"
	bind:clientWidth={containerWidth}
	class:select-none={isResizing}
>
	<div
		class="min-h-0 overflow-hidden lg:[width:var(--left-width)] lg:flex-none"
		style={`--left-width: ${leftPanelWidth}px`}
	>
		{#if resume.url}
			<PdfViewer
				src={resume.url}
				filename={resume.filename ?? 'Document.pdf'}
				resizing={isResizing}
			/>
		{:else}
			<div class="p-6 text-stone-400">No PDF attached.</div>
		{/if}
	</div>
	<div
		class="hidden lg:flex lg:flex-none lg:cursor-col-resize lg:items-stretch lg:justify-center"
		onpointerdown={startResize}
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize resume panels"
		style={`width:${HANDLE_WIDTH}px`}
	>
		<div class="h-full w-px self-stretch bg-stone-200" />
	</div>

	<div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
		<ResumeRate
			text={resume.text}
			waitlist={() => {
				showWaitlist = true;
			}}
		/>
	</div>
</div>

<WaitlistModal open={showWaitlist} on:close={() => (showWaitlist = false)} />
