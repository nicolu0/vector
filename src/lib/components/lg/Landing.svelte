<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';

	let showIntro = $state(false);
	let showContact = $state(false);

	onMount(() => {
		showIntro = true;
        showContact = false;
	});

    onDestroy(() => {
        clearAllTimers();
    });
    
    let isTransitioning = $state(false);
    let contactTimer: ReturnType<typeof setTimeout> | null = null;
    let introTimer: ReturnType<typeof setTimeout> | null = null;
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;

    function clearAllTimers() {
        if (contactTimer) {
            clearTimeout(contactTimer);
            contactTimer = null;
        }
        if (introTimer) {
            clearTimeout(introTimer);
            introTimer = null;
        }
        if (unlockTimer) {
            clearTimeout(unlockTimer);
            unlockTimer = null;
        }
    }

	function handleContactClick(event: MouseEvent) {
		event.preventDefault();

        if (isTransitioning || showContact) return;

        isTransitioning = true;
        clearAllTimers();

		showIntro = false;

		const introOutDelay = 350;
		const introOutDuration = 500;
		const introOutTotal = introOutDelay + introOutDuration;

		contactTimer = setTimeout(() => {
			showContact = true;
            
            const contactInDelay = 300;
            const contactInDuration = 600;
            const contactInTotal = contactInDelay + contactInDuration;

            unlockTimer = setTimeout(() => {
                isTransitioning = false;
                unlockTimer = null;
            }, contactInTotal + 10);
		}, introOutTotal);
	}

    function handleBackToHomeClick(event: MouseEvent) {
        event.preventDefault();

        if (isTransitioning || showIntro) return;

        isTransitioning = true;
        clearAllTimers();

        showContact = false;

        const contactOutDelay = 140;
        const contactOutDuration = 500;
        const contactOutTotal = contactOutDelay + contactOutDuration;

        introTimer = setTimeout(() => {
            showIntro = true;
            
            const introInDelay = 490;
            const introInDuration = 600;
            const introInTotal = introInDelay + introInDuration;

            unlockTimer = setTimeout(() => {
                isTransitioning = false;
                unlockTimer = null;
            }, introInTotal + 10);
        }, contactOutTotal);
    }
</script>

<div class="relative h-full w-full">
	{#if showIntro}
		<div
			class="mx-auto flex h-full w-1/3 flex-col items-center justify-center text-justify selection:bg-stone-600 selection:text-stone-50"
			style="font-family: 'Cormorant Garamond', serif"
		>
			<div class="flex max-w-xl flex-col">
				<div
					class="mb-1"
					in:fly={{ y: 16, duration: 600, delay: 0 }}
					out:fly={{ y: -8, duration: 500, delay: 0 }}
				>
					<span class="text-lg tracking-wide text-stone-700 italic">vector</span>
					<span class="text-md text-stone-700"> (v) </span>
					<span class="text-sm text-stone-400" style="font-family: 'Inter', sans-serif"
						>&nbsp;-&nbsp;</span
					>
					<span class="text-md mb-1 tracking-wide text-stone-700"> to find one's direction </span>
				</div>
				<p
					class="text-md mb-3 text-stone-600"
					style="font-family: 'Cormorant Garamond', serif"
					in:fly={{ y: 16, duration: 600, delay: 70 }}
					out:fly={{ y: -8, duration: 500, delay: 50 }}
				>
					Vector is learning by building, turned into a daily habit. 
                    Every task is directed not by a teacher or course, but by you: your own goals and skill level.
                    You'll never waste time guessing what to do next or searching for resources. 
                    Unleash your potential.
				</p>

				<p
					class="text-md text-stone-600"
					style="font-family: 'Cormorant Garamond', serif"
					in:fly={{ y: 16, duration: 600, delay: 140 }}
					out:fly={{ y: -8, duration: 500, delay: 100 }}
				>
					Build, learn,
					<span class="italic">Vector.</span>
				</p>
				<div
					class="my-8 flex w-full items-center justify-center gap-4"
					in:fly={{ y: 16, duration: 600, delay: 210 }}
					out:fly={{ y: -8, duration: 500, delay: 150 }}
				>
					<span class="h-px w-1/6 rounded-full bg-stone-200"></span>

					<img
						src="/mastery.svg"
						alt="mastery"
						class="pointer-events-none h-4 w-4 object-contain select-none"
					/>

					<span class="h-px w-1/6 rounded-full bg-stone-200"></span>
				</div>

				<div
					class="mb-1"
					in:fly={{ y: 16, duration: 600, delay: 280 }}
					out:fly={{ y: -8, duration: 500, delay: 200 }}
				>
					<span class="mb-1 text-lg tracking-wide text-stone-700 italic">you</span>
					<span class="text-md text-stone-700"> (n) </span>
					<span class="text-sm text-stone-400" style="font-family: 'Inter', sans-serif"
						>&nbsp;-&nbsp;</span
					>
					<span class="text-md mb-1 tracking-wide text-stone-700"> an ambitious student </span>
				</div>

				<p
					class="text-md mb-3 text-stone-600"
					style="font-family: 'Cormorant Garamond', serif"
					in:fly={{ y: 16, duration: 600, delay: 350 }}
					out:fly={{ y: -8, duration: 500, delay: 250 }}
				>
					You strive to be the student with the projects that colleges, research labs, and companies seek out.
                    You're ready to move faster and dive deeper than your classes ever allow.
                    Your schedule is full and the next step isn't always clear, but you know there's more in you.
				</p>

				<p
					class="text-md text-stone-600"
					style="font-family: 'Cormorant Garamond', serif"
					in:fly={{ y: 16, duration: 600, delay: 420 }}
					out:fly={{ y: -8, duration: 500, delay: 300 }}
				>
					If this sounds like you, contact us.
				</p>
			</div>
		</div>

		<div
			class="text-md pointer-events-auto absolute right-0 bottom-16 left-0 flex justify-center gap-12 text-stone-500 selection:bg-stone-600 selection:text-stone-50"
			style="font-family: 'Cormorant Garamond', serif"
			in:fly={{ y: 16, duration: 600, delay: 490 }}
			out:fly={{ y: -8, duration: 500, delay: 350 }}
		>
			<span>
				<a href="/demo" class="transition-colors duration-200 hover:text-stone-800">demo project.</a
				>
			</span>
			<span>
				<button
                    type="button"
					class="transition-colors duration-200 hover:text-stone-800"
					onclick={handleContactClick}
                >
                    contact us.
                </button>
			</span>
		</div>
	{/if}

    {#if showContact}
        <div
            class="absolute inset-0 flex items-center justify-center selection:bg-stone-600 selection:text-stone-50"
            style="font-family: 'Cormorant Garamond', serif"
        >
            <div class="flex flex-col items-center text-center gap-1 text-md text-stone-600">
                <div 
                    class="mb-8" 
                    in:fly={{ y: 12, duration: 600, delay: 0 }}
                    out:fly={{ y: -8, duration: 500, delay: 0 }}
                >
                    <div class="text-xl italic">
                        Andrew Chang
                    </div>
                    <div>(510) 935-8199</div>
                    <div>21andrewch@gmail.com</div>
                </div>
                <div 
                    class="mb-4" 
                    in:fly={{ y: 12, duration: 600, delay: 150 }}
                    out:fly={{ y: -8, duration: 500, delay: 70 }}
                >
                    <div class="text-xl italic">Nico Luo</div>
                    <div>(949) 656-6275</div>
                    <div>nicoluo@gmail.com</div>
                </div>
            </div>

            <div 
                class="pointer-events-auto absolute bottom-16 left-0 right-0 flex justify-center gap-12 text-md text-stone-500 selection:bg-stone-600 selection:text-stone-50" 
                style="font-family: 'Cormorant Garamond', serif"
                in:fly={{ y: 12, duration: 600, delay: 300 }}
                out:fly={{ y: -8, duration: 500, delay: 140 }}
            >
                <span>
                    <button
                        type="button"
                        class="hover:text-stone-800 transition-colors duration-200"
                        onclick={handleBackToHomeClick}
                    >
                        back to home.
                    </button>
                </span>
            </div>
        </div>
    {/if}
</div>

<style>
	.check {
		/* Static checkmark: fully drawn */
		stroke-dasharray: none;
		stroke-dashoffset: 0;
	}

	.check-animated {
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
		animation: draw-check 200ms 100ms ease-out forwards;
	}

	@keyframes draw-check {
		from {
			stroke-dashoffset: 100;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
