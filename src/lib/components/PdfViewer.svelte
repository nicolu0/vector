<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';

	const {
		src,
		filename = 'Document.pdf',
		resizing = false
	} = $props<{
		src: string;
		filename?: string;
		resizing?: boolean; // from parent split pane
	}>();

	// DOM
	let containerEl: HTMLDivElement;
	let toolbarEl: HTMLDivElement;
	let scrollEl: HTMLDivElement; // 👈 scroll container (for scroll mode)
	let singleCanvasEl: HTMLCanvasElement; // existing single-page canvas (paged mode)
	let ctx: CanvasRenderingContext2D | null = null;

	// PDF
	let pdf: any = null;
	let getDocument: any;

	// Viewer state
	let pageCount = $state(0);
	let page = $state(1);
	type FitMode = 'fit' | 'width' | 'custom';
	let fit = $state<FitMode>('width'); // 👈 default to fit width for scroll mode
	let scale = $state(1);
	let baseScale = $state(1);

	// Mode: 'scroll' | 'paged'
	type ViewMode = 'scroll' | 'paged';
	let mode = $state<ViewMode>('scroll'); // 👈 default requested

	// Renders/tasks
	let renderTask: any = null;
	let ro: ResizeObserver;

	async function ensurePdf() {
		const mod: any = await import('pdfjs-dist');
		const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;
		(mod.GlobalWorkerOptions ?? mod.default?.GlobalWorkerOptions).workerSrc = workerUrl;
		getDocument = mod.getDocument ?? mod.default?.getDocument;
	}

	function dpr() {
		return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
	}
	function clampScale(s: number) {
		if (!Number.isFinite(s) || s <= 0) return 1;
		return Math.min(Math.max(s, 0.25), 5);
	}

	async function openPdf(url: string) {
		await ensurePdf();
		pdf = await getDocument({ url }).promise;
		pageCount = pdf.numPages;
		page = 1;
		await tick();
		await computeBaseScale();
		if (mode === 'paged') await renderPaged();
		else await ensureScrollSlotsAndMeasure();
	}

	function viewportBoxForWidth(pageW: number, pageH: number, targetCSSWidth: number) {
		const scaleCSS = targetCSSWidth / pageW;
		return { cssW: targetCSSWidth, cssH: pageH * scaleCSS, scaleCSS };
	}

	async function computeBaseScale() {
		if (!pdf || !containerEl) return;
		const first = await pdf.getPage(1);
		const vp1 = first.getViewport({ scale: 1 });

		const paddings = 16; // p-4 surface
		const cw = Math.max(containerEl.clientWidth - paddings * 2, 1);

		const toolbarH = Math.max(toolbarEl?.offsetHeight ?? 0, 0);
		const ch = Math.max(containerEl.clientHeight - toolbarH - paddings * 2, 1);

		const sFit = Math.min(cw / vp1.width, ch / vp1.height);
		const sWidth = cw / vp1.width;

		baseScale = clampScale(fit === 'width' ? sWidth : sFit);
		if (fit !== 'custom') scale = baseScale;
	}

	/* =========================
     PAGED (single-canvas) path
     ========================= */
	async function renderPaged() {
		if (!pdf || !singleCanvasEl) return;

		// cancel inflight
		if (renderTask) {
			try {
				renderTask.cancel();
			} catch {}
			try {
				await renderTask.promise;
			} catch {}
			renderTask = null;
		}

		const p = await pdf.getPage(page);
		const targetScale = clampScale(scale) * dpr();
		const viewport = p.getViewport({ scale: targetScale });

		singleCanvasEl.width = Math.floor(viewport.width);
		singleCanvasEl.height = Math.floor(viewport.height);

		const cssDpr = dpr();
		singleCanvasEl.style.width = `${Math.floor(viewport.width / cssDpr)}px`;
		singleCanvasEl.style.height = `${Math.floor(viewport.height / cssDpr)}px`;

		ctx = ctx || singleCanvasEl.getContext('2d');
		renderTask = p.render({ canvasContext: ctx!, viewport });
		try {
			await renderTask.promise;
		} finally {
			renderTask = null;
		}
	}

	/* =========================
     SCROLL (continuous) path
     - one canvas per page
     - lazy render with IO
     ========================= */
	// one ref per page
	let pageCanvases: HTMLCanvasElement[] = [];
	let pageTasks: (any | null)[] = [];
	let io: IntersectionObserver | null = null;

	function ensureScrollSlots(count: number) {
		// Svelte will create the elements; we just ensure arrays are sized
		pageTasks = Array.from({ length: count }, () => null);
	}

	async function ensureScrollSlotsAndMeasure() {
		ensureScrollSlots(pageCount);
		await tick(); // canvases bound
		measureAndLayoutScrollPages();
		// kick initial paint for any visible pages
		attachIO();
	}

	function detachIO() {
		io?.disconnect();
		io = null;
	}

	function attachIO() {
		detachIO();
		if (!scrollEl) return;

		io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					const idx = Number((e.target as HTMLElement).dataset.index);
					if (!Number.isFinite(idx)) continue;
					if (e.isIntersecting) {
						void renderScrollPage(idx + 1); // pages are 1-based
					} else {
						// optional: cancel off-screen renders
						cancelScrollPage(idx + 1);
					}
				}
			},
			{
				root: scrollEl,
				rootMargin: '600px 0px', // pre-render ahead
				threshold: 0.01
			}
		);

		pageCanvases.forEach((el, i) => {
			if (el) {
				el.dataset.index = String(i);
				io!.observe(el);
			}
		});
	}

	function cancelScrollPage(pn: number) {
		const i = pn - 1;
		const task = pageTasks[i];
		if (task) {
			try {
				task.cancel();
			} catch {}
			pageTasks[i] = null;
		}
	}

	function cssTargetWidth() {
		// fit width to container (minus paddings); if custom, honor scale
		const paddings = 16; // p-4
		const cw = Math.max(containerEl.clientWidth - paddings * 2, 1);
		if (fit === 'custom') return cw * (scale / baseScale);
		// fit/width both use baseScale computed against container width
		return cw;
	}

	function measureAndLayoutScrollPages() {
		const targetW = cssTargetWidth();
		pageCanvases.forEach(async (canvas, i) => {
			if (!canvas) return;
			const pageObj = await pdf.getPage(i + 1);
			const vp = pageObj.getViewport({ scale: 1 });
			const { cssW, cssH } = viewportBoxForWidth(vp.width, vp.height, targetW);
			// we only size the CSS box here to avoid clearing the bitmap
			canvas.style.width = `${Math.round(cssW)}px`;
			canvas.style.height = `${Math.round(cssH)}px`;
		});
	}

	async function renderScrollPage(pn: number) {
		const i = pn - 1;
		const canvas = pageCanvases[i];
		if (!canvas || !pdf) return;

		// if a render is in flight for this page, skip
		if (pageTasks[i]) return;

		const p = await pdf.getPage(pn);

		// compute viewport using css target width
		const vp1 = p.getViewport({ scale: 1 });
		const targetCssW = cssTargetWidth();
		const cssScale = targetCssW / vp1.width;

		const targetScale = clampScale(cssScale) * dpr();
		const viewport = p.getViewport({ scale: targetScale });

		// sizing canvas (this clears bitmap; OK because we’re about to paint)
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);

		// CSS size matches earlier measure
		const cssDpr = dpr();
		canvas.style.width = `${Math.floor(viewport.width / cssDpr)}px`;
		canvas.style.height = `${Math.floor(viewport.height / cssDpr)}px`;

		const c2d = canvas.getContext('2d');
		const task = p.render({ canvasContext: c2d!, viewport });
		pageTasks[i] = task;
		try {
			await task.promise;
		} finally {
			pageTasks[i] = null;
		}
	}

	// Zoom / fit controls (shared)
	function setFit(newFit: FitMode) {
		fit = newFit;
		// recompute baseScale and re-render/layout
		computeBaseScale().then(() => {
			if (mode === 'paged') renderPaged();
			else {
				measureAndLayoutScrollPages();
				// nudge IO to paint at new sizes
				detachIO();
				attachIO();
			}
		});
	}
	function zoom(delta: number) {
		fit = 'custom';
		scale = clampScale(scale * delta);
		if (mode === 'paged') renderPaged();
		else {
			measureAndLayoutScrollPages();
			detachIO();
			attachIO();
		}
	}
	function setZoomPercent(pct: number) {
		fit = 'custom';
		scale = clampScale(pct / 100);
		if (mode === 'paged') renderPaged();
		else {
			measureAndLayoutScrollPages();
			detachIO();
			attachIO();
		}
	}

	// Lifecycle
	onMount(async () => {
		await openPdf(src);
		ro = new ResizeObserver(() => {
			if (resizing) return; // skip during split-drag
			computeBaseScale().then(() => {
				if (mode === 'paged') renderPaged();
				else {
					measureAndLayoutScrollPages();
					detachIO();
					attachIO();
				}
			});
		});
		ro.observe(containerEl);
	});

	onDestroy(() => {
		ro?.disconnect();
		detachIO();
		if (renderTask) {
			try {
				renderTask.cancel();
			} catch {}
		}
		pdf?.destroy?.();
	});

	// If user stops resizing, refresh once
	$effect(() => {
		if (!resizing) {
			computeBaseScale().then(() => {
				if (mode === 'paged') renderPaged();
				else {
					measureAndLayoutScrollPages();
					detachIO();
					attachIO();
				}
			});
		}
	});
</script>

<div bind:this={containerEl} class="h-full">
	<div bind:this={scrollEl} class="h-full overflow-scroll py-4" style="scroll-behavior: smooth;">
		{#each Array(pageCount) as _, i}
			<div class="mb-4 grid place-items-center">
				<canvas
					bind:this={pageCanvases[i]}
					class="rounded-lg shadow ring-1 ring-stone-200"
					data-index={i}
				/>
			</div>
		{/each}
	</div>
</div>
