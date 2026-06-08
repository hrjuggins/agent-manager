<script lang="ts">
	import type { Workstream } from '$lib/types';

	let { workstream }: { workstream: Workstream } = $props();

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
	class="group block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
>
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-2 w-2 rounded-full {workstream.status === 'active'
						? 'bg-green-500'
						: 'bg-zinc-500'}"
				></span>
				<h3 class="truncate font-medium">{workstream.name}</h3>
			</div>
			<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
				{#if workstream.branch}
					<span class="font-mono">{workstream.branch}</span>
				{/if}
				{#if workstream.repoPath}
					<span class="truncate">{workstream.repoPath.split('/').slice(-1)[0]}</span>
				{/if}
				{#if workstream.linearTicket}
					<span class="text-indigo-400">{workstream.linearTicket.id}</span>
				{/if}
				{#if workstream.assignedPort}
					<span class="text-indigo-400">:{workstream.assignedPort}</span>
				{/if}
			</div>
		</div>
		<div class="flex shrink-0 gap-1">
			{#if workstream.ideWorkspace || workstream.repoPath}
				<button
					onclick={(e) => {
						e.preventDefault();
						launch('ide');
					}}
					class="rounded bg-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
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
					class="rounded bg-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
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
					class="rounded bg-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
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
