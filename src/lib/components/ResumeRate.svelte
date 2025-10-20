<script lang="ts">
	type ProjectRating = 'No change' | 'Small tweaks' | 'Needs Improvement';

	const { text } = $props<{
		text: string;
	}>();

	type ProjectItem = {
		title: string;
		stack: string | null;
		bullets: string[];
		rating: { label: ProjectRating }; // ← score removed
		notes: string[];
	};

	function ratingBadgeClasses(r: ProjectRating) {
		switch (r) {
			case 'No change':
				return 'border-emerald-400 bg-emerald-50 text-emerald-700';
			case 'Small tweaks':
				return 'border-sky-400 bg-sky-50 text-sky-800';
			case 'Needs Improvement':
				return 'border-rose-400 bg-rose-50 text-rose-800';
		}
	}

	const PROJECTS: ProjectItem[] = [
		{
			title: '3 Arm Autonomous Mobile Manipulator',
			stack: 'Python, ROS, OpenCV, MoveIt, Gmapping, Linux, RViz, Gazebo',
			bullets: [
				'Developed software for a 3-arm mobile manipulator to autonomously navigate to a fridge, detect and grab a drink, and return.',
				'Used Gmapping + ROS Navigation Stack to map the room and navigate from doorway to fridge.',
				'Employed MoveIt Commander to simulate arm trajectory validity and choose an optimal pose to open a fridge door in a 1 m × 1 m area.',
				'Improved door-opening success rate from 0% → 40% over 100 simulation runs after algorithm updates.',
				'Used OpenCV for object detection and Pick-and-Place sequence (scan, pre-grasp, grasp).',
				'Computed drink location via focal-length equations + depth sensing; transformed world point into gripper frame.'
			],
			rating: { label: 'No change' },
			notes: [
				'Add repo/demo link (video/GIF).',
				'Quantify navigation accuracy (e.g., success % per room layout).'
			]
		},
		{
			title: 'Robot Artist (UR5)',
			stack: 'ROS, Python, OpenCV, Linux, Universal Robots UR5',
			bullets: [
				'Taught a UR5 robot arm to draw from a reference image using a Sharpie.',
				'Manually implemented forward and inverse kinematics for UR5 based on link dimensions.',
				'Built a stroke state machine (pre-draw height, drawing height, home position).',
				'Created an image-processing pipeline to extract/trace contours with adjustable keypoints and contour count.',
				'Completed full images within ~15 minutes at three detail levels; prepared for pointillism mode with higher detail.',
				'Experimented with higher arm speeds (5,000+ points per image).'
			],
			rating: { label: 'Small tweaks' },
			notes: [
				'Call out error rate/precision (e.g., end-effector pixel-to-mm mapping error).',
				'Mention safety/limits (joint/velocity constraints) to show robustness.'
			]
		},
		{
			title: 'Race Line Generation Algorithm',
			stack: 'ROS, Python, OpenCV, Linux, RViz, Gazebo',
			bullets: [
				'Generated an optimal path based on upcoming turn radius, vehicle pose, and velocity; sent control signals to a simulated vehicle.',
				'Implemented lateral control via Pure Pursuit using a constant look-ahead point.',
				'Added three speed thresholds that adapt to road curvature for smoother speed transitions.',
				'Captured velocity/acceleration/position across 100 simulation runs to analyze path and acceleration spikes.',
				'Reduced lateral g-force ~50% (≈1.0G → 0.5G) for improved passenger comfort.'
			],
			rating: { label: 'Needs Improvement' },
			notes: [
				'Add baseline comparison (e.g., PID or Stanley) to anchor the 50% improvement.',
				'Include real-time latency numbers and loop frequency.'
			]
		}
	];
</script>

<div class="min-h-[calc(100svh-56px)] w-full bg-stone-50">
	<div class="mx-auto max-w-5xl">
		<div class="mb-5 flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight text-stone-900">Resume Review</h1>
			<div
				class="inline-flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-200 px-2 py-1"
			>
				<span class="text-xs font-medium text-emerald-700">Strong</span>
			</div>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between">
				<div class="text-md font-semibold tracking-tight text-stone-900">Projects</div>
				<div class="text-xs text-stone-500">
					{PROJECTS.length} item{PROJECTS.length === 1 ? '' : 's'}
				</div>
			</div>

			<div class="space-y-4">
				{#each PROJECTS as p}
					<div class="rounded-lg border border-stone-200 bg-white p-4">
						<!-- header row: title + stack + rating (no score) -->
						<div class="mb-1 flex flex-wrap items-center gap-2">
							<h3 class="min-w-0 truncate text-sm font-semibold tracking-tight text-stone-900">
								{p.title}
							</h3>

							<span
								class={'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] ' +
									ratingBadgeClasses(p.rating.label)}
							>
								<span class="font-medium">{p.rating.label}</span>
							</span>

							{#if p.stack}
								<span
									class="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] text-stone-700"
								>
									{p.stack}
								</span>
							{/if}
						</div>

						{#if p.bullets.length > 0}
							<ul class="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-stone-700">
								{#each p.bullets as b}
									<li>{b}</li>
								{/each}
							</ul>
						{:else}
							<div class="text-xs text-stone-500">No details provided.</div>
						{/if}

						{#if p.notes.length > 0}
							<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
								<div
									class="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-amber-800"
								>
									<svg
										viewBox="0 0 24 24"
										class="h-3.5 w-3.5"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M11 7h2v6h-2zm0 8h2v2h-2z" /><path d="M1 21h22L12 2 1 21z" />
									</svg>
									Notes to improve
								</div>
								<ul class="list-disc space-y-1 pl-5 text-[11px] leading-5 text-amber-900">
									{#each p.notes as n}
										<li>{n}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
