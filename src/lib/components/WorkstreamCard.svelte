<script lang="ts">
	import type { Workstream } from '$lib/types';

	let { workstream }: { workstream: Workstream } = $props();

	function statusColor(status: string): string {
		const s = status.toLowerCase();
		if (s === 'done') return 'bg-green-100 text-green-700';
		if (s === 'in progress') return 'bg-amber-100 text-amber-700';
		if (s === 'in review') return 'bg-purple-100 text-purple-700';
		if (s === 'todo') return 'bg-blue-100 text-blue-700';
		if (s === 'backlog') return 'bg-gray-100 text-gray-600';
		if (s === 'cancelled') return 'bg-red-100 text-red-600';
		return 'bg-gray-100 text-gray-600';
	}

	function envStateColor(state: string): string {
		if (state === 'running') return 'bg-green-500';
		if (state === 'starting') return 'bg-amber-400';
		if (state === 'error') return 'bg-red-500';
		return 'bg-gray-300';
	}

	async function launch(action: string) {
		await fetch(`/api/workstreams/${workstream.id}/launch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		});
	}
</script>

<a
	href="/workstreams/{workstream.id}"
	class="group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<h3 class="truncate text-sm font-medium text-gray-900">{workstream.name}</h3>
			<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
				{#if workstream.linearTicket}
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusColor(
							workstream.linearTicket.status
						)}"
					>
						{workstream.linearTicket.status}
					</span>
					<span class="font-mono text-xs text-gray-400">{workstream.linearTicket.id}</span>
				{/if}
				{#if workstream.environment?.state}
					<span class="flex items-center gap-1 text-xs text-gray-500">
						<span
							class="inline-block h-1.5 w-1.5 rounded-full {envStateColor(
								workstream.environment.state
							)}"
						></span>
						{workstream.environment.state}
					</span>
				{/if}
			</div>
			{#if workstream.branch}
				<p class="mt-1 truncate font-mono text-xs text-gray-400">{workstream.branch}</p>
			{/if}
		</div>
		<div class="flex shrink-0 gap-1">
			{#if workstream.ideWorkspace || workstream.repoPath}
				<button
					onclick={(e) => {
						e.preventDefault();
						launch('ide');
					}}
					class="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
					title="Open in IDE"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
						/>
					</svg>
				</button>
			{/if}
			{#if workstream.browserUrl}
				<button
					onclick={(e) => {
						e.preventDefault();
						launch('browser');
					}}
					class="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
					title="Open browser"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
						/>
					</svg>
				</button>
			{/if}
			{#if workstream.aiChatUrl}
				<button
					onclick={(e) => {
						e.preventDefault();
						launch('ai-chat');
					}}
					class="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
					title="Open AI chat"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</a>
