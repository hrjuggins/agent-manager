<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import WorkstreamForm from '$lib/components/WorkstreamForm.svelte';
	import type { WorkstreamUpdate } from '$lib/types';

	let { data } = $props();
	let editing = $state(false);

	async function launch(action: string) {
		const res = await fetch(`/api/workstreams/${data.workstream.id}/launch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		});
		const result = await res.json();
		if (!result.success) {
			alert(result.message);
		}
	}

	async function toggleStatus() {
		const newStatus = data.workstream.status === 'active' ? 'done' : 'active';
		await fetch(`/api/workstreams/${data.workstream.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: newStatus })
		});
		invalidateAll();
	}

	async function handleUpdate(updateData: WorkstreamUpdate) {
		await fetch(`/api/workstreams/${data.workstream.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updateData)
		});
		editing = false;
		invalidateAll();
	}

	async function handleDelete() {
		if (!confirm('Delete this workstream?')) return;
		await fetch(`/api/workstreams/${data.workstream.id}`, { method: 'DELETE' });
		goto('/');
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-3">
				<span
					class="inline-block h-3 w-3 rounded-full {data.workstream.status === 'active'
						? 'bg-green-500'
						: 'bg-zinc-500'}"
				></span>
				<h1 class="text-2xl font-bold">{data.workstream.name}</h1>
			</div>
			<p class="mt-1 text-sm text-zinc-400">
				Created {new Date(data.workstream.createdAt).toLocaleDateString()}
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={toggleStatus}
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm transition hover:bg-zinc-800"
			>
				Mark as {data.workstream.status === 'active' ? 'Done' : 'Active'}
			</button>
			<button
				onclick={() => (editing = !editing)}
				class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm transition hover:bg-zinc-800"
			>
				{editing ? 'Cancel' : 'Edit'}
			</button>
			<button
				onclick={handleDelete}
				class="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950"
			>
				Delete
			</button>
		</div>
	</div>

	{#if editing}
		<WorkstreamForm workstream={data.workstream} onsubmit={handleUpdate} />
	{:else}
		<!-- Launch Actions -->
		<section class="space-y-3">
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Quick Launch</h2>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => launch('ide')}
					disabled={!data.workstream.ideWorkspace && !data.workstream.repoPath}
					class="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
						/>
					</svg>
					Open IDE
				</button>
				<button
					onclick={() => launch('browser')}
					disabled={!data.workstream.browserUrl}
					class="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
						/>
					</svg>
					Open Browser
				</button>
				<button
					onclick={() => launch('ai-chat')}
					disabled={!data.workstream.aiChatUrl}
					class="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
						/>
					</svg>
					AI Chat
				</button>
				<button
					onclick={() => launch('checkout')}
					disabled={!data.workstream.branch || !data.workstream.repoPath}
					class="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 10V3L4 14h7v7l9-11h-7z"
						/>
					</svg>
					Checkout Branch
				</button>
			</div>
		</section>

		<!-- Details -->
		<section class="grid gap-4 sm:grid-cols-2">
			{#if data.workstream.repoPath}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Repository</h3>
					<p class="mt-1 truncate font-mono text-sm">{data.workstream.repoPath}</p>
				</div>
			{/if}
			{#if data.workstream.branch}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Branch</h3>
					<p class="mt-1 font-mono text-sm">{data.workstream.branch}</p>
				</div>
			{/if}
			{#if data.workstream.browserUrl}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Browser URL</h3>
					<p class="mt-1 truncate text-sm text-indigo-400">{data.workstream.browserUrl}</p>
				</div>
			{/if}
			{#if data.workstream.aiChatUrl}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">AI Chat</h3>
					<p class="mt-1 truncate text-sm text-indigo-400">{data.workstream.aiChatUrl}</p>
				</div>
			{/if}
		</section>

		<!-- External Info -->
		{#if data.workstream.linearTicket || data.workstream.pullRequest}
			<section class="space-y-3">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">External</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.linearTicket}
						<button
							onclick={() => launch('linear')}
							class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-zinc-700"
						>
							<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
								Linear Ticket
							</h3>
							<p class="mt-1 text-sm font-medium">{data.workstream.linearTicket.title}</p>
							<div class="mt-1 flex items-center gap-2 text-xs text-zinc-400">
								<span class="font-mono">{data.workstream.linearTicket.id}</span>
								<span class="rounded bg-zinc-800 px-1.5 py-0.5">
									{data.workstream.linearTicket.status}
								</span>
							</div>
						</button>
					{/if}
					{#if data.workstream.pullRequest}
						<button
							onclick={() => launch('pull-request')}
							class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-zinc-700"
						>
							<h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
								Pull Request
							</h3>
							<p class="mt-1 text-sm font-medium">{data.workstream.pullRequest.title}</p>
							<span class="mt-1 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
								{data.workstream.pullRequest.status}
							</span>
						</button>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Notes -->
		{#if data.workstream.notes}
			<section class="space-y-2">
				<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Notes</h2>
				<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<p class="text-sm whitespace-pre-wrap text-zinc-300">{data.workstream.notes}</p>
				</div>
			</section>
		{/if}
	{/if}
</div>
