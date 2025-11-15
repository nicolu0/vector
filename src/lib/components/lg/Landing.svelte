<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<section
	class="flex h-full w-full flex-col items-center justify-center selection:bg-stone-600 selection:text-stone-50"
	style="font-family: 'Cormorant Garamond', serif"
>
	<div class="flex max-w-xl flex-col">
		<h2 class="line mb-1 text-xl tracking-wide text-stone-700 italic">
			vector (v) <span style="font-family: 'Inter'">-</span> to find one's direction
		</h2>
		<p class="text-xl text-stone-600" style="font-family: 'Cormorant Garamond', serif">
			We help you build stand-out projects with daily tasks tailored to your goals, interests, and
			skill. generates daily tasks and resources to help you build in-demand projects. Vector
			generates
			<button
				onclick={() => goto('/demo')}
				class="italic underline decoration-[1px] underline-offset-2">demo project</button
			>
			daily tasks and resources to help you build in-demand projects.
		</p>
		<div class="line my-8 flex w-full items-center justify-center gap-4">
			<span class="h-px w-1/5 rounded-full bg-stone-200"></span>

			<img
				src="/mastery.svg"
				alt="mastery"
				class="pointer-events-none h-4 w-4 object-contain select-none"
			/>

			<span class="h-px w-1/5 rounded-full bg-stone-200"></span>
		</div>
		<h2 class="line mb-1 text-xl tracking-wide text-stone-700 italic">
			you (n) <span style="font-family: 'Inter'">-</span> an ambitious student
		</h2>
		<p class="text-xl text-stone-600" style="font-family: 'Cormorant Garamond', serif">
			Vector is looking to work with students interested in tech. If this is you,
			<button class="italic underline decoration-[1px] underline-offset-2">contact us</button>
			in-demand projects.
		</p>
	</div>
</section>
