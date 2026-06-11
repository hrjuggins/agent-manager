<script lang="ts">
	import { goto } from '$app/navigation';
	import WorkstreamForm from '$lib/components/WorkstreamForm.svelte';
	import type { WorkstreamCreate } from '$lib/types';

	async function handleSubmit(data: WorkstreamCreate) {
		const res = await fetch('/api/workstreams', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		if (res.ok) {
			const workstream = await res.json();
			goto(`/workstreams/${workstream.id}`);
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-black text-ink">New Workstream</h1>
		<p class="text-sm font-medium text-ink/60">Create a new workspace for a piece of work</p>
	</div>
	<WorkstreamForm onsubmit={handleSubmit} />
</div>
