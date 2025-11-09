<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="flex h-full w-full flex-col gap-4 bg-stone-50 p-6">
	<div class="flex">{data?.task?.title}</div>
	<div class="flex">{data?.task?.description}</div>
</div>
