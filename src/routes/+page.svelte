<script lang="ts">
	import type { Workstream } from '$lib/types';
	import WorkstreamCard from '$lib/components/WorkstreamCard.svelte';

	let { data } = $props();

	const STATUS_COLUMNS = [
		{ key: 'Backlog', label: 'Backlog', color: 'bg-gray-500' },
		{ key: 'Todo', label: 'Todo', color: 'bg-brutal-red' },
		{ key: 'Active', label: 'Active', color: 'bg-brutal-yellow' },
		{ key: 'In Progress', label: 'In Progress', color: 'bg-brutal-yellow' },
		{ key: 'Ready for Review', label: 'Ready for Review', color: 'bg-brutal-green' },
		{ key: 'In Review', label: 'In Review', color: 'bg-brutal-green' },
		{ key: 'Done', label: 'Done', color: 'bg-brutal-purple' },
		{ key: 'Cancelled', label: 'Cancelled', color: 'bg-brutal-red' }
	];

	function getLinearStatus(w: Workstream): string {
		return w.linearTicket?.status ?? (w.status === 'done' ? 'Done' : 'Active');
	}

	function groupWorkstreams(workstreams: Workstream[]): Record<string, Workstream[]> {
		const groups: Record<string, Workstream[]> = {};
		for (const col of STATUS_COLUMNS) {
			groups[col.key] = [];
		}
		for (const w of workstreams) {
			const status = getLinearStatus(w);
			const col = STATUS_COLUMNS.find((c) => c.key.toLowerCase() === status.toLowerCase());
			const key = col ? col.key : 'In Progress';
			groups[key].push(w);
		}
		return groups;
	}

	let grouped = $derived(groupWorkstreams(data.workstreams));

	let activeCount = $derived(
		data.workstreams.filter((w: Workstream) => w.status === 'active').length
	);
	let totalCount = $derived(data.workstreams.length);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-ink">Workstreams</h1>
			<p class="text-sm font-medium text-ink/60">
				{activeCount} active of {totalCount} total
			</p>
		</div>
	</div>

	{#if totalCount === 0}
		<div class="rounded-sm border-2 border-ink bg-white py-16 text-center shadow-brutal">
			<p class="font-bold text-ink/60">No workstreams yet</p>
			<a
				href="/workstreams/new"
				class="mt-2 inline-block text-sm font-bold text-brutal-blue hover:underline"
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
							<span class="inline-block h-3 w-3 rounded-full border-2 border-ink {col.color}"
							></span>
							<h2 class="text-sm font-black text-ink">{col.label}</h2>
							<span
								class="rounded-sm border-2 border-ink bg-brutal-yellow px-2 py-0.5 text-xs font-bold text-ink"
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
