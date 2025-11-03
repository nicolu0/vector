<script lang="ts">
	import { browser } from '$app/environment';
	import TaskView from '$lib/components/lg/TaskView.svelte';
	import Chat from '$lib/components/lg/Chat.svelte';

	const selectedTask = $derived(
		activeTaskId ? (all.find((t) => t.id === activeTaskId) ?? null) : null
	);

	let rightMin = $state(300);
	let leftMin = $state(300);
	let startRight = $state(200);

	let splitEl: HTMLDivElement | null = null;
	let sized = $state(false);
	let rightWidth = $derived(startRight);

	const total = () => splitEl?.getBoundingClientRect().width ?? 0;
	const clampRight = (w: number) => {
		const t = total();
		if (!t) return w;
		const maxRight = Math.max(rightMin, t - leftMin - 1);
		return Math.min(maxRight, Math.max(rightMin, w));
	};

	// pointer-driven resize
	let dragging = $state(false);
	let startX = 0,
		startW = 0;
	function apply(dx: number) {
		rightWidth = clampRight(startW - dx);
	}

	function onDown(e: PointerEvent) {
		if (!sized || e.button !== 0) return;
		e.preventDefault();
		dragging = true;
		startX = e.clientX;
		startW = rightWidth;
		document.body.classList.add('select-none', 'cursor-col-resize');
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, { once: true });
		window.addEventListener('pointercancel', onUp, { once: true });
	}
	function onMove(e: PointerEvent) {
		if (dragging) apply(e.clientX - startX);
	}
	function onUp() {
		dragging = false;
		document.body.classList.remove('select-none', 'cursor-col-resize');
		window.removeEventListener('pointermove', onMove);
		rightWidth = clampRight(rightWidth);
	}

	if (browser) {
		let ro: ResizeObserver | null = null;
		$effect(() => {
			if (!splitEl) return;

			if (!sized) {
				const w = total();
				if (w > 0) {
					rightWidth = clampRight(w / 2);
					sized = true;
				}
			}

			ro?.disconnect();
			ro = new ResizeObserver(() => {
				if (!sized) return;
				rightWidth = clampRight(rightWidth);
			});
			ro.observe(splitEl);
			return () => ro?.disconnect();
		});
	}

	function reset() {
		const w = total();
		if (w) rightWidth = clampRight(w / 2);
	}
</script>

<div class="flex h-full w-full bg-stone-50">
	<div class="flex w-full flex-col">
		<div bind:this={splitEl} class="flex min-w-0 flex-1 overflow-hidden">
			<div class={sized ? 'min-w-0 flex-1' : 'min-w-0 flex-[1_1_0%]'}>
				<div class="p-4">Speech + Debate Analyzer</div>
				<TaskView task={selectedTask ?? undefined} />
			</div>

			<div
				role="separator"
				aria-orientation="vertical"
				title="Drag to resize • Double-click to reset"
				class="relative h-full"
				on:pointerdown={onDown}
				on:dblclick={reset}
			>
				<div class="h-full w-px bg-stone-200"></div>
				<div class="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize"></div>
			</div>

			<div
				class={sized ? 'min-w-0 shrink-0 overflow-auto' : 'min-w-0 flex-[1_1_0%] overflow-auto'}
				style={sized ? `width:${rightWidth}px; min-width:${rightMin}px` : ''}
			>
				<Chat />
			</div>
		</div>
	</div>
</div>
