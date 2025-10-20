<script lang="ts">
	export let size = 160; // px
	export let duration = 900; // ms total
	export let stroke = '#0b0b0b'; // circle/check color
	export let fill = '#ffffff'; // inner fill (behind the stroke)

	const ringMs = Math.min(320, duration * 0.35);
	const checkDelay = Math.min(260, duration * 0.28);
	const checkMs = Math.min(420, duration * 0.47);
</script>

<div
	class="relative grid place-items-center"
	style={`width:${size}px;height:${size}px`}
	aria-hidden="true"
>
	<!-- burst circle -->
	<svg
		viewBox="0 0 120 120"
		class="absolute inset-0"
		style="filter: drop-shadow(0 6px 18px rgba(0,0,0,.08));"
	>
		<!-- soft filled circle -->
		<circle cx="60" cy="60" r="48" {fill} />
		<!-- outline ring that 'draws' -->
		<circle
			cx="60"
			cy="60"
			r="48"
			fill="none"
			{stroke}
			stroke-width="6"
			pathLength="300"
			class="ring"
			style={`animation: draw ${ringMs}ms ease-out forwards`}
		/>
	</svg>

	<!-- check mark (drawn after a short delay) -->
	<svg viewBox="0 0 120 120" class="absolute inset-0">
		<path
			d="M36 62 L55 80 L86 43"
			fill="none"
			{stroke}
			stroke-width="8"
			stroke-linecap="round"
			stroke-linejoin="round"
			pathLength="100"
			class="check"
			style={`animation: draw ${checkMs}ms ${checkDelay}ms ease-out forwards`}
		/>
	</svg>
</div>

<style>
	.ring,
	.check {
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ring,
		.check {
			animation: none !important;
			stroke-dashoffset: 0;
		}
	}
</style>
