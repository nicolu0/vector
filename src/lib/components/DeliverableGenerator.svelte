<script lang="ts">
	type Deliverable = { title: string; description: string; outcome: string };

	interface Props {
		endGoal: string;
		currentSkillLevel: string;
	}
	let { endGoal, currentSkillLevel }: Props = $props();

	let deliverable = $state<Deliverable>();
	let loading = $state(false);
	let errorMessage = $state('');

	// Live, per-field streaming state
	let liveTitle = $state('');
	let liveDesc = $state('');
	let liveOut = $state('');
	let titleOpen = $state(false);
	let descOpen = $state(false);
	let outOpen = $state(false);

	let _buf = ''; // NDJSON line buffer
	let _abort: AbortController | null = null;

	function openSection(k: 'title' | 'description' | 'outcome') {
		if (k === 'title') titleOpen = true;
		if (k === 'description') descOpen = true;
		if (k === 'outcome') outOpen = true;
	}
	function setKV(k: 'title' | 'description' | 'outcome', v: string) {
		if (k === 'title') liveTitle = v;
		else if (k === 'description') liveDesc = v;
		else if (k === 'outcome') liveOut = v;
	}

	async function generateTask() {
		const previousDeliverable = deliverable;

		if (!endGoal.trim()) {
			errorMessage = 'Please describe the end goal before generating a task.';
			return;
		}

		// cancel any in-flight stream
		if (_abort) {
			_abort.abort();
			_abort = null;
		}

		loading = true;
		errorMessage = '';
		deliverable = undefined;

		// reset live sections
		liveTitle = liveDesc = liveOut = '';
		titleOpen = descOpen = outOpen = false;
		_buf = '';

		try {
			const payload: Record<string, unknown> = { endGoal, currentSkillLevel };
			if (previousDeliverable) payload.previousDeliverable = previousDeliverable;

			_abort = new AbortController();
			const res = await fetch('/api/generate-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: _abort.signal
			});

			if (!res.ok || !res.body) {
				const txt = await res.text().catch(() => '');
				throw new Error(txt || 'Task generation failed');
			}

			const reader = res.body.getReader();
			const dec = new TextDecoder();

			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;

				_buf += dec.decode(value, { stream: true });

				let nl;
				while ((nl = _buf.indexOf('\n')) !== -1) {
					const line = _buf.slice(0, nl);
					_buf = _buf.slice(nl + 1);
					if (!line) continue;

					let msg: any;
					try {
						msg = JSON.parse(line);
					} catch {
						continue;
					}

					switch (msg.t) {
						case 'section': {
							// { t:'section', k:'title'|'description'|'outcome', phase:'start'|'end' }
							if (msg.phase === 'start') openSection(msg.k);
							break;
						}
						case 'kv': {
							// { t:'kv', k:'title'|'description'|'outcome', v:'...' }
							if (msg.k === 'title' || msg.k === 'description' || msg.k === 'outcome') {
								openSection(msg.k);
								setKV(msg.k, String(msg.v ?? ''));
							}
							break;
						}
						case 'warn': {
							console.warn('warn:', msg.v);
							break;
						}
						case 'error': {
							errorMessage = typeof msg.v === 'string' ? msg.v : JSON.stringify(msg.v);
							break;
						}
						case 'final': {
							// validated server object
							const v = msg.v as Deliverable;
							if (v?.title && v?.description && v?.outcome) {
								deliverable = v;
							}
							break;
						}
						case 'done': {
							// stream finished
							break;
						}
						// 'delta' (raw text) is optional; ignored here
					}
				}
			}
		} catch (err) {
			if ((err as any)?.name === 'AbortError') {
				errorMessage = 'Generation cancelled.';
			} else {
				console.error(err);
				errorMessage =
					err instanceof Error ? err.message : 'Unexpected error while generating the task.';
			}
		} finally {
			loading = false;
			_abort = null;
		}
	}
</script>

<div class="flex w-full flex-col gap-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
	<div class="space-y-2">
		<h1 class="text-xl font-semibold text-stone-900">Tasks</h1>
	</div>
	{#if errorMessage}
		<p class="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
			{errorMessage}
		</p>
	{/if}
	{#if loading}
		{#if titleOpen}
			<div class="text-lg font-semibold text-stone-900">{liveTitle}</div>
		{/if}
		{#if descOpen}
			<div class="text-sm text-stone-700">{liveDesc}</div>
		{/if}
		{#if outOpen}
			<div class="text-sm font-medium text-stone-800">{liveOut}</div>
		{/if}
	{:else if !deliverable}
		<div
			class="flex min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-center text-sm text-stone-500"
		>
			No deliverable generated yet.
		</div>
	{:else}
		<div class="text-lg font-semibold text-stone-900">{deliverable.title}</div>
		<div class="text-sm text-stone-700">{deliverable.description}</div>
		<div class="text-sm font-medium text-stone-800">{deliverable.outcome}</div>
	{/if}
	<button
		class="w-fit rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:outline-none"
		type="button"
		onclick={generateTask}
		disabled={loading}
	>
		{#if loading}
			Generating…
		{:else}
			Generate New Deliverable
		{/if}
	</button>
</div>
