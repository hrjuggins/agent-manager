<script lang="ts">
	import type { Workstream } from '$lib/types';
	import WorkstreamCard from '$lib/components/WorkstreamCard.svelte';

	let { data } = $props();

	const STATUS_COLUMNS = [
		{ key: 'Backlog', label: 'Backlog', color: 'bg-gray-400' },
		{ key: 'Todo', label: 'Todo', color: 'bg-blue-500' },
		{ key: 'In Progress', label: 'In Progress', color: 'bg-amber-500' },
		{ key: 'In Review', label: 'In Review', color: 'bg-purple-500' },
		{ key: 'Done', label: 'Done', color: 'bg-green-500' },
		{ key: 'Cancelled', label: 'Cancelled', color: 'bg-red-400' }
	];

	function getLinearStatus(w: Workstream): string {
		return w.linearTicket?.status ?? (w.status === 'done' ? 'Done' : 'In Progress');
	}

	function groupWorkstreams(workstreams: Workstream[]): Record<string, Workstream[]> {
		const groups: Record<string, Workstream[]> = {};
		for (const col of STATUS_COLUMNS) {
			groups[col.key] = [];
		}
		for (const w of workstreams) {
			const status = getLinearStatus(w);
			const col = STATUS_COLUMNS.find(
				(c) => c.key.toLowerCase() === status.toLowerCase()
			);
			const key = col ? col.key : 'In Progress';
			groups[key].push(w);
		}
		return groups;
	}

	let grouped = $derived(groupWorkstreams(data.workstreams));

	let activeCount = $derived(data.workstreams.filter((w: Workstream) => w.status === 'active').length);
	let totalCount = $derived(data.workstreams.length);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Workstreams</h1>
			<p class="text-sm text-gray-500">
				{activeCount} active of {totalCount} total
			</p>
		</div>
	</div>

	{#if totalCount === 0}
		<div class="rounded-lg border border-gray-200 bg-white py-16 text-center">
			<p class="text-gray-500">No workstreams yet</p>
			<a
				href="/workstreams/new"
				class="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-500"
			>
				Create your first workstream
			</a>
		</div>
	{:else}
		<div class="flex gap-4 overflow-x-auto pb-4">
			{#each STATUS_COLUMNS as col (col.key)}
				{@const items = grouped[col.key] ?? []}
				{#if items.length > 0}
					<div class="flex w-72 shrink-0 flex-col">
						<div class="mb-3 flex items-center gap-2">
							<span class="inline-block h-2.5 w-2.5 rounded-full {col.color}"></span>
							<h2 class="text-sm font-semibold text-gray-700">{col.label}</h2>
							<span
								class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600"
								>{items.length}</span
							>
						</div>
						<div class="flex flex-col gap-3">
							{#each items as workstream (workstream.id)}
								<WorkstreamCard {workstream} />
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
