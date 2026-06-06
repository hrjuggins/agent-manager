<script lang="ts">
	import type { Workstream } from '$lib/types';
	import WorkstreamCard from '$lib/components/WorkstreamCard.svelte';

	let { data } = $props();

	let filter: 'all' | 'active' | 'done' = $state('all');

	let filtered = $derived(
		data.workstreams.filter((w: Workstream) => {
			if (filter === 'all') return true;
			return w.status === filter;
		})
	);

	let active = $derived(data.workstreams.filter((w: Workstream) => w.status === 'active'));
	let done = $derived(data.workstreams.filter((w: Workstream) => w.status === 'done'));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Workstreams</h1>
			<p class="text-sm text-zinc-400">
				{active.length} active · {done.length} done
			</p>
		</div>
		<div class="flex gap-1 rounded-lg bg-zinc-900 p-1">
			<button
				class="rounded-md px-3 py-1 text-sm transition {filter === 'all'
					? 'bg-zinc-700 text-white'
					: 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (filter = 'all')}
			>
				All
			</button>
			<button
				class="rounded-md px-3 py-1 text-sm transition {filter === 'active'
					? 'bg-zinc-700 text-white'
					: 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (filter = 'active')}
			>
				Active
			</button>
			<button
				class="rounded-md px-3 py-1 text-sm transition {filter === 'done'
					? 'bg-zinc-700 text-white'
					: 'text-zinc-400 hover:text-zinc-200'}"
				onclick={() => (filter = 'done')}
			>
				Done
			</button>
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 py-16 text-center">
			<p class="text-zinc-400">No workstreams yet</p>
			<a
				href="/workstreams/new"
				class="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300"
			>
				Create your first workstream
			</a>
		</div>
	{:else}
		<div class="grid gap-3">
			{#each filtered as workstream (workstream.id)}
				<WorkstreamCard {workstream} />
			{/each}
		</div>
	{/if}
</div>
