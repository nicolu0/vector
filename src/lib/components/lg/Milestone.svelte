<script lang="ts">
	type Milestone = {
		id: string;
		title: string;
		description?: string | null;
		ordinal?: number | null;
		skills?: string[] | null;
	};

	const DEFAULT_RESOURCES = [
		{
			label: 'PyTorch Tensors',
			url: 'https://docs.pytorch.org/docs/stable/tensors.html'
		},
		{
			label: 'PyTorch - torch.stack',
			url: 'https://docs.pytorch.org/docs/stable/generated/torch.stack.html'
		},
		{
			label: 'scikit-learn - train_test_split',
			url: 'https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html?utm_source=chatgpt.com'
		},
        {
			label: 'PyTorch Tensor Docsasf',
			url: 'https://arxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Tensor 331Docsasf',
			url: 'https://arxiv.21521org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Ten12421sor Docsasf',
			url: 'https://ar21421421xiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch T124ensor Docsasf',
			url: 'https1232131://arxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorc12412421h Tensor Docsasf',
			url: 'htt124124214ps://arxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Tensor124214215125 Docsasf',
			url: 'https://a12421x124iv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTor12421ch Tenso1252115ocsasf',
			url: 'https://arx12215iv.org/25215pdf/1721506asfsa.03762'
		},
        {
			label: 'PyTo21412412412412rch Tensor Docsasf',
			url: 'htt22424242ps://arxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Tensor Docsas11111sssdds',
			url: 'https://arxiv.oasa3q3rtrg/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTo41421412421rch Tensor Docsasf',
			url: 'https:/1412arxi5356v.o7747rg/pdf/1706asfsa.03762'
		},
        {
			label: 'P1223yTorch Ten5657465645dsor Docsasf',
			url: 'https://arxiv.org/pdfdfsfddght45/1706asfsa.03762'
		},
        {
			label: 'PyTor1242141242156754ufdsfdsch Tensor Docsasf',
			url: 'https://ffafad3q4256ytearxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTor124526436tsdch Tensor Docsasf',
			url: 'https://asdfjy6745rxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTor1524365rgsgffgfch Tensor Docsasf',
			url: 'https://arxivgfgfgfgfgfxcvbcvv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Tet5y46udhrtnsor Docsasf',
			url: 'https://arxiczxczxczxcv787org/pdf806asfsa.03762'
		},
        {
			label: 'PyTorch Tens3256ertkgor Docsasf',
			url: 'https://arxiv.or32565fgfgcccccccbg/pdf/1706asfsa.03762'
		},
        {
			label: 'PyT53252342432423orch Tensor Docsasf',
			url: 'https:/1io43tigjksdkjf/arxiv.org/pdf/1706asfsa.03762'
		},
        {
			label: 'PyTorch Te20594060395049nsor Docsasf',
			url: 'https://arxiv.org/fdsklklkllklklasdfsafsafaspdf/1706asfsa.03762'
		}
	];

	let { milestone = null, resources = DEFAULT_RESOURCES } = $props<{
		milestone: Milestone | null;
		resources?: typeof DEFAULT_RESOURCES;
	}>();
</script>

{#if milestone}
	<div class="flex h-full w-full flex-col gap-4 bg-stone-50">
		<div>
			<div class="mb-2 text-[32px] font-semibold text-stone-900">
				Milestone {milestone.ordinal ?? '—'}: {milestone.title}
			</div>

			{#if milestone.skills && milestone.skills.length > 0}
				<ul class="flex flex-wrap gap-2">
					{#each milestone.skills as skill (skill)}
						<li>
							<span
								class="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900"
							>
								{skill}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div
			class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
		>
			<div class="mb-2 font-semibold text-stone-900">Description</div>
			{milestone.description}
		</div>

		<div
			class="rounded-xl border border-stone-200 bg-white p-4 text-[14px] leading-relaxed text-stone-800"
		>
			<div class="mb-2 font-semibold text-stone-900">Resources</div>
			<ul class="list-disc space-y-1 pl-5">
				{#each resources as r (r.url)}
					<li>
						<a
							href={r.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
							aria-label={`Open resource: ${r.label}`}
						>
							<span class="truncate">{r.label}</span>
							<svg
								class="h-4 w-4 shrink-0 -translate-x-1 opacity-70 transition-transform duration-150 group-hover:-translate-x-0.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="M7 17l10-10" />
								<path d="M8 7h9v9" />
							</svg>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{:else}
	<div class="flex h-full w-full items-center justify-center bg-stone-50 text-stone-500">
		No milestone selected.
	</div>
{/if}
