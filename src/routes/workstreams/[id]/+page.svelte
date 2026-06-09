<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import WorkstreamForm from '$lib/components/WorkstreamForm.svelte';
	import type { WorkstreamUpdate } from '$lib/types';

	let { data } = $props();
	let editing = $state(false);
	let confirmingDelete = $state(false);
	let terminalLoading = $state(false);

	// Auto-sync Linear ticket on mount
	onMount(() => {
		refreshLinearTicket();
	});

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
		await fetch(`/api/workstreams/${data.workstream.id}`, { method: 'DELETE' });
		goto('/');
	}

	async function openTerminal() {
		terminalLoading = true;
		try {
			const res = await fetch(`/api/workstreams/${data.workstream.id}/environment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'open-terminal' })
			});
			const result = await res.json();
			if (!result.success) {
				alert(result.message || 'Failed to open terminal');
			}
		} finally {
			terminalLoading = false;
		}
	}

	async function teardown() {
		const res = await fetch(`/api/workstreams/${data.workstream.id}/environment`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'teardown' })
		});
		const result = await res.json();
		if (!result.success) {
			alert(result.message || 'Teardown failed');
		}
		invalidateAll();
	}

	let linearRefreshing = $state(false);

	async function refreshLinearTicket() {
		const ticket = data.workstream.linearTicket;
		if (!ticket?.url && !ticket?.id) return;

		linearRefreshing = true;
		try {
			const body: Record<string, string> = {};
			if (ticket.url) body.url = ticket.url;
			else body.identifier = ticket.id;

			const res = await fetch('/api/linear/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				const issueData = await res.json();
				const patch: Record<string, unknown> = {
					linearTicket: {
						id: issueData.identifier,
						url: issueData.url,
						title: issueData.title,
						status: issueData.status
					}
				};
				// Auto-link first PR from Linear attachments
				if (issueData.pullRequests?.length > 0) {
					const pr = issueData.pullRequests[0];
					patch.pullRequest = {
						url: pr.url,
						title: pr.title,
						status: pr.status
					};
				}
				await fetch(`/api/workstreams/${data.workstream.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(patch)
				});
				invalidateAll();
			}
		} finally {
			linearRefreshing = false;
		}
	}

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
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-3">
				<span
					class="inline-block h-3 w-3 rounded-full {data.workstream.status === 'active'
						? 'bg-green-500'
						: 'bg-gray-400'}"
				></span>
				<h1 class="text-2xl font-bold text-gray-900">{data.workstream.name}</h1>
			</div>
			<p class="mt-1 text-sm text-gray-500">
				Created {new Date(data.workstream.createdAt).toLocaleDateString()}
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={toggleStatus}
				class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
			>
				Mark as {data.workstream.status === 'active' ? 'Done' : 'Active'}
			</button>
			<button
				onclick={() => (editing = !editing)}
				class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
			>
				{editing ? 'Cancel' : 'Edit'}
			</button>
			{#if confirmingDelete}
				<button
					onclick={handleDelete}
					class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white transition hover:bg-red-500"
				>
					Confirm Delete
				</button>
				<button
					onclick={() => (confirmingDelete = false)}
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
				>
					Cancel
				</button>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
				>
					Delete
				</button>
			{/if}
		</div>
	</div>

	{#if editing}
		<WorkstreamForm workstream={data.workstream} onsubmit={handleUpdate} />
	{:else}
		<!-- Quick Launch -->
		<section class="space-y-3">
			<h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">Quick Launch</h2>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => launch('ide')}
					disabled={!data.workstream.ideWorkspace && !data.workstream.repoPath}
					class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
					onclick={openTerminal}
					disabled={!data.workstream.repoPath || terminalLoading}
					class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					{terminalLoading ? 'Opening...' : 'Open Terminal'}
				</button>
				<button
					onclick={() => launch('browser')}
					disabled={!data.workstream.browserUrl}
					class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
					class="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
			</div>
		</section>

		<!-- Worktree -->
		{#if data.workstream.worktreePath || data.workstream.repoPath}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">Workspace</h2>
					{#if data.workstream.worktreePath}
						<button
							onclick={teardown}
							class="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50"
						>
							Teardown Worktree
						</button>
					{/if}
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.repoPath}
						<div class="rounded-lg border border-gray-200 bg-white p-4">
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								Repository
							</h3>
							<p class="mt-1 truncate font-mono text-sm text-gray-700">
								{data.workstream.repoPath}
							</p>
						</div>
					{/if}
					{#if data.workstream.branch}
						<div class="rounded-lg border border-gray-200 bg-white p-4">
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Branch</h3>
							<p class="mt-1 font-mono text-sm text-gray-700">{data.workstream.branch}</p>
						</div>
					{/if}
					{#if data.workstream.worktreePath}
						<div class="rounded-lg border border-gray-200 bg-white p-4 sm:col-span-2">
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Worktree</h3>
							<p class="mt-1 truncate font-mono text-xs text-gray-500">
								{data.workstream.worktreePath}
							</p>
						</div>
					{/if}
				</div>

				<!-- Error from worktree creation -->
				{#if data.workstream.environment?.state === 'error' && data.workstream.environment?.setupLog}
					<div
						class="rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-700"
					>
						{data.workstream.environment.setupLog}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Links -->
		{#if data.workstream.browserUrl || data.workstream.aiChatUrl}
			<section class="space-y-3">
				<h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">Links</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.browserUrl}
						<div class="rounded-lg border border-gray-200 bg-white p-4">
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								Browser URL
							</h3>
							<a
								href={data.workstream.browserUrl}
								target="_blank"
								rel="noopener"
								class="mt-1 block truncate text-sm text-indigo-600 hover:text-indigo-500 hover:underline"
							>
								{data.workstream.browserUrl}
							</a>
						</div>
					{/if}
					{#if data.workstream.aiChatUrl}
						<div class="rounded-lg border border-gray-200 bg-white p-4">
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">AI Chat</h3>
							<a
								href={data.workstream.aiChatUrl}
								target="_blank"
								rel="noopener"
								class="mt-1 block truncate text-sm text-indigo-600 hover:text-indigo-500 hover:underline"
							>
								{data.workstream.aiChatUrl}
							</a>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- External Info -->
		{#if data.workstream.linearTicket || data.workstream.pullRequest}
			<section class="space-y-3">
				<h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">External</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.linearTicket}
						<div
							class="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
						>
							<div class="flex items-start justify-between">
								<button onclick={() => launch('linear')} class="text-left">
									<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
										Linear Ticket
									</h3>
									<p class="mt-1 text-sm font-medium text-gray-900">
										{data.workstream.linearTicket.title}
									</p>
									<div class="mt-1 flex items-center gap-2 text-xs">
										<span class="font-mono text-gray-400">{data.workstream.linearTicket.id}</span>
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium {statusColor(
												data.workstream.linearTicket.status
											)}"
										>
											{data.workstream.linearTicket.status}
										</span>
									</div>
								</button>
								<button
									onclick={refreshLinearTicket}
									disabled={linearRefreshing}
									class="rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
									title="Refresh from Linear"
								>
									{linearRefreshing ? '...' : '↻'}
								</button>
							</div>
						</div>
					{/if}
					{#if data.workstream.pullRequest}
						<button
							onclick={() => launch('pull-request')}
							class="rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
						>
							<h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								Pull Request
							</h3>
							<p class="mt-1 text-sm font-medium text-gray-900">
								{data.workstream.pullRequest.title}
							</p>
							<span
								class="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
							>
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
				<h2 class="text-sm font-semibold tracking-wide text-gray-500 uppercase">Notes</h2>
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<p class="text-sm whitespace-pre-wrap text-gray-700">{data.workstream.notes}</p>
				</div>
			</section>
		{/if}
	{/if}
</div>
