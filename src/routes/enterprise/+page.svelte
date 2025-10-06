<script lang="ts">
	import vectorUrl from '$lib/assets/vector.svg?url';
</script>

<div class="min-h-dvh w-full bg-stone-50 text-stone-800">
	<section id="hero" class="border-b border-stone-200">
		<div
			class="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2"
		>
			<div class="space-y-3">
				<h1 class="text-4xl font-light text-stone-900 md:text-5xl">
					Project-based learning made simple.
				</h1>
				<p class="text-lg font-light text-stone-600">
					Differentiate yourself with unique projects.
				</p>
				<div class="flex gap-3 pt-2">
					<a
						href="#cta"
						class="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
						>Start free</a
					>
					<a
						href="#how"
						class="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
						>How it works</a
					>
				</div>
			</div>
			<div class="rounded-2xl border border-stone-200 bg-white p-6">
				<!-- Placeholder visual / replace with your graphic -->
				<div class="aspect-video w-full rounded-lg bg-stone-100"></div>
				<p class="mt-3 text-xs text-stone-500">
					Preview: Vector turns interests into a concrete project idea.
				</p>
			</div>
		</div>
	</section>

	<!-- Problem -->
	<section id="problem" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">The problem</h2>
			<p class="mt-2 max-w-3xl text-stone-600">
				Most applicants blend in. Generic projects, vague portfolios, and no signal of real
				initiative. You need targeted projects that map to real roles and companies.
			</p>
			<div class="mt-6 grid gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="text-2xl">🧩</div>
					<div class="mt-2 font-medium">Too many choices</div>
					<p class="text-sm text-stone-600">
						You know your interests, but not what to build first.
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="text-2xl">🕒</div>
					<div class="mt-2 font-medium">Little time</div>
					<p class="text-sm text-stone-600">
						You can’t spend weeks scoping a project that goes nowhere.
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="text-2xl">🎯</div>
					<div class="mt-2 font-medium">Low signal</div>
					<p class="text-sm text-stone-600">Projects often don’t align with the jobs you want.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- How it works -->
	<section id="how" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">How it works</h2>
			<div class="mt-6 grid gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">1️⃣</div>
					<div class="mt-2 font-medium">Pick interests</div>
					<p class="text-sm text-stone-600">
						Select from niche topics (e.g., <span class="italic">gene editing</span>,
						<span class="italic">humanoids</span>).
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">2️⃣</div>
					<div class="mt-2 font-medium">Vector scopes a project</div>
					<p class="text-sm text-stone-600">
						We align scope with real job listings to maximize relevance.
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">3️⃣</div>
					<div class="mt-2 font-medium">Ship & showcase</div>
					<p class="text-sm text-stone-600">
						Deliver a crisp readme, demo, and talking points for interviews.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section id="features" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">Why Vector</h2>
			<div class="mt-6 grid gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">🧠</div>
					<div class="mt-2 font-medium">Job-aware</div>
					<p class="text-sm text-stone-600">
						Projects derived from live roles, not generic prompts.
					</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">⚙️</div>
					<div class="mt-2 font-medium">Actionable</div>
					<p class="text-sm text-stone-600">Clear milestones, datasets, and code scaffolds.</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-5">
					<div class="text-2xl">📣</div>
					<div class="mt-2 font-medium">Portfolio-ready</div>
					<p class="text-sm text-stone-600">
						Readable writeups and demo angles that recruiters understand.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Showcase -->
	<section id="showcase" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">Example projects</h2>
			<div class="mt-6 grid gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="aspect-video w-full rounded-lg bg-stone-100"></div>
					<div class="mt-2 font-medium">Pose Estimation Coach</div>
					<p class="text-sm text-stone-600">Realtime form feedback using a lightweight model.</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="aspect-video w-full rounded-lg bg-stone-100"></div>
					<div class="mt-2 font-medium">Fraud Graph Explorer</div>
					<p class="text-sm text-stone-600">Graph ETL + anomaly scoring over transactions.</p>
				</div>
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<div class="aspect-video w-full rounded-lg bg-stone-100"></div>
					<div class="mt-2 font-medium">AR Try-On</div>
					<p class="text-sm text-stone-600">Simple virtual try-on with device-native tracking.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Testimonials -->
	<section id="testimonials" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">What users say</h2>
			<div class="mt-6 grid gap-4 md:grid-cols-3">
				<figure class="rounded-xl border border-stone-200 bg-white p-5">
					<blockquote class="text-sm text-stone-700">
						“Best use of a weekend. I finally have a project I’m proud to talk about.”
					</blockquote>
					<figcaption class="mt-2 text-xs text-stone-500">— CS student</figcaption>
				</figure>
				<figure class="rounded-xl border border-stone-200 bg-white p-5">
					<blockquote class="text-sm text-stone-700">
						“The prompts mapped exactly to roles I’m applying to.”
					</blockquote>
					<figcaption class="mt-2 text-xs text-stone-500">— SWE intern</figcaption>
				</figure>
				<figure class="rounded-xl border border-stone-200 bg-white p-5">
					<blockquote class="text-sm text-stone-700">
						“I shipped a demo and landed two interviews.”
					</blockquote>
					<figcaption class="mt-2 text-xs text-stone-500">— Bootcamp grad</figcaption>
				</figure>
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="border-b border-stone-200">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<h2 class="text-2xl font-semibold tracking-tight text-stone-900">FAQ</h2>
			<div class="mt-6 space-y-3">
				<details
					class="group rounded-xl border border-stone-200 bg-white p-4 open:border-stone-300"
				>
					<summary class="flex cursor-pointer list-none items-center justify-between">
						<span class="font-medium">How does Vector pick projects?</span>
						<span class="text-stone-400 transition group-open:rotate-180">⌄</span>
					</summary>
					<p class="mt-2 text-sm text-stone-600">
						We align your interests with skills pulled from job listings and output a scoped plan.
					</p>
				</details>
				<details
					class="group rounded-xl border border-stone-200 bg-white p-4 open:border-stone-300"
				>
					<summary class="flex cursor-pointer list-none items-center justify-between">
						<span class="font-medium">Do I need prior experience?</span>
						<span class="text-stone-400 transition group-open:rotate-180">⌄</span>
					</summary>
					<p class="mt-2 text-sm text-stone-600">
						No. We calibrate difficulty and provide resources to get moving.
					</p>
				</details>
				<details
					class="group rounded-xl border border-stone-200 bg-white p-4 open:border-stone-300"
				>
					<summary class="flex cursor-pointer list-none items-center justify-between">
						<span class="font-medium">Can I customize the scope?</span>
						<span class="text-stone-400 transition group-open:rotate-180">⌄</span>
					</summary>
					<p class="mt-2 text-sm text-stone-600">
						Yes—swap datasets, libraries, or milestones and we’ll adjust.
					</p>
				</details>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section id="cta">
		<div class="mx-auto w-full max-w-5xl px-6 py-14">
			<div class="rounded-2xl border border-stone-200 bg-white p-8">
				<div class="grid gap-6 md:grid-cols-2">
					<div>
						<h3 class="text-2xl font-semibold tracking-tight text-stone-900">
							Ready to build something hireable?
						</h3>
						<p class="mt-2 text-stone-600">
							Tell us your interests. We’ll generate a project you can ship this week.
						</p>
					</div>
					<form class="flex flex-col gap-3 md:flex-row">
						<input
							type="text"
							placeholder="e.g., humanoids, gene editing, AR try-on"
							class="h-10 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none md:flex-1"
						/>
						<button
							type="button"
							class="h-10 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-black"
						>
							Generate a project
						</button>
					</form>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-stone-200">
		<div
			class="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-sm text-stone-500"
		>
			<div class="flex items-center gap-2">
				<img src={vectorUrl} alt="Vector" class="h-4 w-4" />
				<span class="font-mono tracking-tight text-stone-600">vector</span>
			</div>
			<div class="flex gap-4">
				<a href="#" class="hover:text-stone-700">Privacy</a>
				<a href="#" class="hover:text-stone-700">Terms</a>
				<a href="#" class="hover:text-stone-700">Contact</a>
			</div>
		</div>
	</footer>
</div>
