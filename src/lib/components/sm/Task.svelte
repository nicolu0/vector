<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let {
		id,
		title,
		checked = false,
		loading = false,
		completing = false,
		active = false,
		onToggle,
		onSelect = null,
		tutorial = false
	} = $props<{
		id: string;
		title: string;
		checked?: boolean;
		loading?: boolean;
		completing?: boolean;
		active?: boolean;
		onToggle: (id: string) => void;
		onSelect?: (() => void) | null;
		tutorial?: boolean;
	}>();

	async function toggle() {
		if (loading || completing) return;

		const willCheck = !checked;
		onToggle(id);

		if (tutorial && willCheck) {
			if (!browser) return;
			try {
				const {
					data: { user },
					error
				} = await supabase.auth.getUser();
				if (error) console.error('Failed to fetch user for tutorial completion', error.message);
				if (!user) {
					await goto('/', { invalidateAll: true });
					return;
				}

				const { error: updateErr } = await supabase
					.from('users')
					.update({ tutorial: false })
					.eq('user_id', user.id);

				if (updateErr) {
					console.error('Failed to update tutorial flag', updateErr.message);
				}

				await goto('/', { invalidateAll: true });
			} catch (err) {
				console.error('Error completing tutorial task', err);
			}
		}
	}

	function openTask() {
		onSelect?.();
		if (tutorial) {
			goto('/task/tutorial');
			return;
		}
		goto(`/task/${id}`);
	}
</script>

<li class="group pl-4">
	<div
		class={`flex w-full items-center gap-1 rounded-md transition ${
			active ? 'bg-stone-300' : 'hover:bg-stone-200'
		}`}
	>
		<button
			type="button"
			class="relative ml-2 grid h-3 w-3 place-items-center rounded-full focus:outline-none
			       {checked ? 'bg-stone-900' : ''}"
			role="checkbox"
			aria-checked={checked}
			aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
			onclick={toggle}
		>
			{#if checked}
				<svg viewBox="0 0 24 24" class="h-3 w-3 text-stone-50" fill="none">
					<path
						d="M7 12.5 L10.25 15.75 L16.75 9.25"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<span
					class="pointer-events-none absolute inset-0 rounded-full border border-[1px] border-stone-400 transition duration-200 ease-out"
				/>
			{/if}
		</button>

		<button
			type="button"
			onclick={openTask}
			class="flex min-w-0 flex-1 items-center justify-between rounded-md py-1"
			aria-current={active ? 'page' : undefined}
			aria-label={`Open task ${title}`}
		>
			<span
				class="min-w-0 truncate text-sm tracking-tight {checked
					? 'text-stone-400 line-through'
					: 'text-stone-800'}"
			>
				{title}
			</span>
		</button>
	</div>
</li>
