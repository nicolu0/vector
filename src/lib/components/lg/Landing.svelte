<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	const EMAIL = '21andrewch@gmail.com';
	let copied = false;
	let hovering = false;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		try {
			await navigator.clipboard.writeText(EMAIL);
			copied = true;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 3000);
		} catch {}
	}

    let showIntro = $state(false);
    let showContact = $state(false);

    onMount(() => {
        showIntro = true;
    });

    function handleContactClick(event: MouseEvent) {
        event.preventDefault();

        showIntro = false;

        const lastDelay = 350;
        const lastDuration = 500;
        const total = lastDelay + lastDuration;

        setTimeout(() => {
            showContact = true;
        }, total);
    }
</script>

<div class="relative w-full h-full">
    {#if showIntro}
        <div
            class="flex h-full w-1/3 mx-auto flex-col items-center justify-center text-justify selection:bg-stone-600 selection:text-stone-50"
            style="font-family: 'Cormorant Garamond', serif"
        >
            <div class="flex max-w-xl flex-col">
                <div 
                    class="mb-1"
                    in:fly={{ y: 16, duration: 600, delay: 0 }}
                    out:fly={{ y: -8, duration: 500, delay: 0 }}
                >
                    <span class="text-stone-700 text-lg tracking-wide italic">vector</span>
                    <span class="text-stone-700 text-md"> (v) </span>
                    <span class="text-stone-400 text-sm" style="font-family: 'Inter', sans-serif">&nbsp;-&nbsp;</span>
                    <span class="text-stone-700 text-md tracking-wide mb-1 ">
                        to find one's direction
                    </span>
                </div>
                <p 
                    class="text-md text-stone-600 mb-3" 
                    style="font-family: 'Cormorant Garamond', serif"
                    in:fly={{ y: 16, duration: 600, delay: 70 }}
                    out:fly={{ y: -8, duration: 500, delay: 50 }}
                >
                    Vector is learning by building, turned into a daily habit. 
                    You tell us your goals and we turn them into a guided project made of daily tasks: build this feature, read this resource. 
                    Each task is tailored to your goals and skill level, so you're never guessing what to do next. 
                    Day by day, you become the student your dream colleges and internships want.
                    <!-- <button
                        onclick={() => goto('/demo')}
                        class="italic underline decoration-[1px] underline-offset-2 hover:text-stone-800 transition-colors duration-200">demo project</button
                    > -->
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
                    <span class="text-stone-700 text-lg tracking-wide mb-1 italic">you</span>
                    <span class="text-stone-700 text-md"> (n) </span>
                    <span class="text-stone-400 text-sm" style="font-family: 'Inter', sans-serif">&nbsp;-&nbsp;</span>
                    <span class="text-stone-700 text-md tracking-wide mb-1 ">
                        an ambitious student
                    </span>
                </div>

                <p 
                    class="text-md text-stone-600 mb-3" 
                    style="font-family: 'Cormorant Garamond', serif"
                    in:fly={{ y: 16, duration: 600, delay: 350 }}
                    out:fly={{ y: -8, duration: 500, delay: 250 }}
                >
                    You want to be the student with the projects everyone admires.
                    The ones that colleges, research labs, and companies look for.
                    You care less about looking "well-rounded" and more about going all-in on one thing until you're the best at it.
                    <!-- <span class="relative inline-block">
                        <button
                            class="italic underline decoration-[1px] underline-offset-2 hover:text-stone-800 transition-colors duration-200"
                            onclick={copy}
                            aria-describedby="contact-tip"
                        >
                            contact us
                        </button>

                        {#if copied}
                            <div
                                id="contact-tip"
                                class="pointer-events-none absolute top-[110%] flex flex-row items-center gap-1 rounded-md bg-stone-700 px-2 py-1 text-xs whitespace-nowrap text-stone-50 shadow-md"
                                in:fly={{ y: -2, duration: 200 }}
                                out:fade={{ duration: 120 }}
                            >
                                {#if copied}
                                    <svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none">
                                        <path
                                            d="M7 12.5 L10.25 15.75 L16.75 9.25"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            pathLength="100"
                                            class="check"
                                            class:check-animated={copied}
                                        />
                                    </svg>
                                {:else}
                                    <svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none"> </svg>
                                {/if}
                                Email copied to clipboard
                            </div>
                        {/if}
                    </span> -->
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
            class="pointer-events-auto absolute bottom-16 left-0 right-0 flex justify-center gap-12 text-md text-stone-500 selection:bg-stone-600 selection:text-stone-50" 
            style="font-family: 'Cormorant Garamond', serif"
            in:fly={{ y: 16, duration: 600, delay: 490 }}
            out:fly={{ y: -8, duration: 500, delay: 350 }}
        >
            <span>
                <a href="/demo" class="hover:text-stone-800 transition-colors duration-200">demo project.</a>
            </span>
            <span>
                <a href="#contact" class="hover:text-stone-800 transition-colors duration-200" onclick={handleContactClick}>contact us.</a>
            </span>
        </div>
    {/if}

    {#if showContact}
        <div
            class="absolute inset-0 flex items-center justify-center selection:bg-stone-600 selection:text-stone-50"
            style="font-family: 'Cormorant Garamond', serif"
        >
            <div class="flex flex-col items-center text-center gap-1 text-md text-stone-600">
                <div class="mb-8" in:fly={{ y: 12, duration: 600, delay: 0 }}>
                    <div class="text-xl italic">
                        Andrew Chang
                    </div>
                    <div>(510) 935-8199</div>
                    <div>21andrewch@gmail.com</div>
                </div>
                <div class="mb-4" in:fly={{ y: 12, duration: 600, delay: 150 }}>
                    <div class="text-xl italic">Nico Luo</div>
                    <div>(949) 656-6275</div>
                    <div>nicoluo@gmail.com</div>
                </div>
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
