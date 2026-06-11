<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import WorkstreamForm from '$lib/components/WorkstreamForm.svelte';
	import type { WorkstreamUpdate } from '$lib/types';

	let { data } = $props();
	let editing = $state(false);
	let confirmingDelete = $state(false);
	let terminalLoading = $state(false);
	let servicesLoading = $state(false);
	let serviceLoading = $state<string | null>(null);
	let serviceStatuses = $state<Record<string, { running: boolean; port: number | null }>>({});
	let statusPollTimer: ReturnType<typeof setInterval> | null = null;

	async function pollServiceStatuses() {
		if (!data.workstream.worktreePath || data.devServices.length === 0) return;
		// Only poll if services have been explicitly started
		if (data.workstream.environment?.state !== 'running') return;
		try {
			const res = await fetch(`/api/workstreams/${data.workstream.id}/environment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'service-status' })
			});
			const result = await res.json();
			if (result.statuses) {
				const map: Record<string, { running: boolean; port: number | null }> = {};
				for (const s of result.statuses) {
					map[s.name] = { running: s.running, port: s.port };
				}
				serviceStatuses = map;
			}
		} catch {
			// Silently fail — poll will retry
		}
	}

	// Auto-sync Linear ticket + start polling on mount
	onMount(() => {
		refreshLinearTicket();
		pollServiceStatuses();
		statusPollTimer = setInterval(pollServiceStatuses, 5000);
	});

	onDestroy(() => {
		if (statusPollTimer) clearInterval(statusPollTimer);
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
		await teardown();
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

	const allRunning = $derived(
		data.devServices.length > 0 && data.devServices.every((s) => serviceStatuses[s.name]?.running)
	);
	const anyRunning = $derived(data.devServices.some((s) => serviceStatuses[s.name]?.running));

	async function startAllServicesFn() {
		if (allRunning) return;
		servicesLoading = true;
		try {
			const res = await fetch(`/api/workstreams/${data.workstream.id}/environment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start-services' })
			});
			const result = await res.json();
			if (!result.success) {
				alert(result.message || 'Failed to start services');
			}
			invalidateAll();
			// Re-poll immediately to pick up new status
			setTimeout(pollServiceStatuses, 2000);
		} finally {
			servicesLoading = false;
		}
	}

	async function startService(name: string) {
		if (serviceStatuses[name]?.running) return;
		serviceLoading = name;
		try {
			const res = await fetch(`/api/workstreams/${data.workstream.id}/environment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start-service', serviceName: name })
			});
			const result = await res.json();
			if (!result.success) {
				alert(result.message || `Failed to start ${name}`);
			}
			// Re-poll immediately to pick up new status
			setTimeout(pollServiceStatuses, 2000);
		} finally {
			serviceLoading = null;
		}
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
		if (s === 'done') return 'border-brutal-green bg-brutal-green/20 text-ink';
		if (s === 'in progress') return 'border-brutal-yellow bg-brutal-yellow/30 text-ink';
		if (s === 'in review') return 'border-brutal-purple bg-brutal-purple/20 text-ink';
		if (s === 'todo') return 'border-brutal-blue bg-brutal-blue/20 text-ink';
		if (s === 'backlog') return 'border-ink/30 bg-ink/10 text-ink/70';
		if (s === 'cancelled') return 'border-brutal-red bg-brutal-red/20 text-ink';
		return 'border-ink/30 bg-ink/10 text-ink/70';
	}

	// Dot color matching the kanban column the workstream belongs to
	function workstreamDotColor(): string {
		const linearStatus = data.workstream.linearTicket?.status?.toLowerCase();
		if (linearStatus) {
			if (linearStatus === 'done') return 'bg-brutal-purple';
			if (linearStatus === 'in progress') return 'bg-brutal-yellow';
			if (linearStatus === 'ready for review' || linearStatus === 'in review')
				return 'bg-brutal-green';
			if (linearStatus === 'todo') return 'bg-brutal-red';
			if (linearStatus === 'backlog') return 'bg-gray-500';
			if (linearStatus === 'cancelled') return 'bg-brutal-red';
		}
		// Fallback to workstream active/done status
		return data.workstream.status === 'done' ? 'bg-brutal-purple' : 'bg-brutal-yellow';
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<div class="flex items-center gap-3">
				<span
					class="inline-block h-3.5 w-3.5 rounded-full border-2 border-ink {workstreamDotColor()}"
				></span>
				<h1 class="text-2xl font-black text-ink">{data.workstream.name}</h1>
			</div>
			<p class="mt-1 text-sm font-medium text-ink/60">
				Created {new Date(data.workstream.createdAt).toLocaleDateString()}
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={toggleStatus}
				class="rounded-sm border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
			>
				Mark as {data.workstream.status === 'active' ? 'Done' : 'Active'}
			</button>
			<button
				onclick={() => (editing = !editing)}
				class="rounded-sm border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
			>
				{editing ? 'Cancel' : 'Edit'}
			</button>
			{#if confirmingDelete}
				<button
					onclick={handleDelete}
					class="rounded-sm border-2 border-ink bg-brutal-red px-3 py-1.5 text-sm font-bold text-white shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
				>
					Confirm Delete
				</button>
				<button
					onclick={() => (confirmingDelete = false)}
					class="rounded-sm border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
				>
					Cancel
				</button>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="rounded-sm border-2 border-brutal-red bg-white px-3 py-1.5 text-sm font-bold text-brutal-red shadow-brutal-sm transition hover:translate-y-0.5 hover:bg-brutal-red/10 hover:shadow-none"
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
			<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">Quick Launch</h2>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => launch('ide')}
					disabled={!data.workstream.ideWorkspace && !data.workstream.repoPath}
					class="flex items-center gap-2 rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:bg-brutal-yellow hover:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
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
					class="flex items-center gap-2 rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:bg-brutal-green hover:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
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
					onclick={() => launch('ai-chat')}
					disabled={!data.workstream.aiChatUrl}
					class="flex items-center gap-2 rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:bg-brutal-pink hover:text-white hover:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
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
					onclick={() => launch('github-desktop')}
					disabled={!data.workstream.worktreePath && !data.workstream.repoPath}
					class="flex items-center gap-2 rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:bg-brutal-purple hover:text-white hover:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"
						/>
					</svg>
					GitHub Desktop
				</button>
			</div>
		</section>

		<!-- Worktree -->
		{#if data.workstream.worktreePath || data.workstream.repoPath}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">Workspace</h2>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.repoPath}
						<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">Repository</h3>
							<p class="mt-1 truncate font-mono text-sm font-medium text-ink">
								{data.workstream.repoPath}
							</p>
						</div>
					{/if}
					{#if data.workstream.branch}
						<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">Branch</h3>
							<p class="mt-1 font-mono text-sm font-medium text-ink">{data.workstream.branch}</p>
						</div>
					{/if}
					{#if data.workstream.worktreePath}
						<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm sm:col-span-2">
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">Worktree</h3>
							<p class="mt-1 truncate font-mono text-xs font-medium text-ink/60">
								{data.workstream.worktreePath}
							</p>
						</div>
					{/if}
				</div>

				<!-- Error from worktree creation -->
				{#if data.workstream.environment?.state === 'error' && data.workstream.environment?.setupLog}
					<div
						class="rounded-sm border-2 border-brutal-red bg-brutal-red/10 p-3 font-mono text-xs font-bold text-brutal-red"
					>
						{data.workstream.environment.setupLog}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Dev Services -->
		{#if data.devServices.length > 0 && data.workstream.worktreePath}
			<section class="space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">Dev Services</h2>
						{#if allRunning}
							<span
								class="inline-flex items-center gap-1 rounded-sm border-2 border-brutal-green bg-brutal-green/20 px-2 py-0.5 text-xs font-bold text-ink"
							>
								<span class="h-2 w-2 rounded-full border border-ink bg-brutal-green"></span>
								All running
							</span>
						{:else if anyRunning}
							<span
								class="inline-flex items-center gap-1 rounded-sm border-2 border-brutal-yellow bg-brutal-yellow/20 px-2 py-0.5 text-xs font-bold text-ink"
							>
								<span class="h-2 w-2 rounded-full border border-ink bg-brutal-yellow"></span>
								Partially running
							</span>
						{/if}
					</div>
					<button
						onclick={startAllServicesFn}
						disabled={servicesLoading || allRunning}
						class="rounded-sm border-2 border-ink px-3 py-1.5 text-xs font-bold text-white shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none disabled:opacity-50 {allRunning
							? 'cursor-not-allowed bg-ink/30'
							: 'bg-brutal-blue'}"
					>
						{#if servicesLoading}
							Starting...
						{:else if allRunning}
							All Running
						{:else}
							Start All
						{/if}
					</button>
				</div>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.devServices as svc (svc.name)}
						{@const status = serviceStatuses[svc.name]}
						{@const running = status?.running ?? false}
						{@const actualPort = status?.port}
						<div
							class="rounded-sm border-2 bg-white p-3 {running
								? 'border-brutal-green'
								: 'border-ink'}"
						>
							<div class="flex items-center justify-between">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-ink {running
												? 'bg-brutal-green'
												: 'bg-ink/20'}"
										></span>
										<h3 class="text-sm font-bold text-ink">{svc.name}</h3>
									</div>
									<p
										class="mt-0.5 truncate pl-4 font-mono text-xs font-medium text-ink/40"
										title={svc.command}
									>
										{svc.command}
									</p>
									{#if actualPort}
										<a
											href="http://localhost:{actualPort}"
											target="_blank"
											rel="noopener"
											class="mt-1 block pl-4 text-xs font-bold text-brutal-blue hover:underline"
										>
											http://localhost:{actualPort}
										</a>
									{:else if svc.portBase !== undefined && data.workstream.environment?.envDetails?.[svc.name]}
										<a
											href={data.workstream.environment.envDetails[svc.name]}
											target="_blank"
											rel="noopener"
											class="mt-1 block pl-4 text-xs font-bold text-brutal-blue hover:underline"
										>
											{data.workstream.environment.envDetails[svc.name]}
										</a>
									{:else if svc.portBase !== undefined}
										<p class="mt-1 pl-4 text-xs font-medium text-ink/40">
											Port: {svc.portBase} (base)
										</p>
									{/if}
								</div>
								<button
									onclick={() => startService(svc.name)}
									disabled={serviceLoading === svc.name || running}
									class="flex-shrink-0 rounded-sm border-2 px-2 py-1 text-xs font-bold transition disabled:opacity-50 {running
										? 'cursor-not-allowed border-brutal-green text-brutal-green'
										: 'border-ink text-ink hover:bg-brutal-yellow'}"
								>
									{#if serviceLoading === svc.name}
										...
									{:else if running}
										Running
									{:else}
										Start
									{/if}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Links -->
		{#if data.workstream.browserUrl || data.workstream.aiChatUrl}
			<section class="space-y-3">
				<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">Links</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.browserUrl}
						<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">Browser URL</h3>
							<a
								href={data.workstream.browserUrl}
								target="_blank"
								rel="noopener"
								class="mt-1 block truncate text-sm font-bold text-brutal-blue hover:underline"
							>
								{data.workstream.browserUrl}
							</a>
						</div>
					{/if}
					{#if data.workstream.aiChatUrl}
						<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">AI Chat</h3>
							<a
								href={data.workstream.aiChatUrl}
								target="_blank"
								rel="noopener"
								class="mt-1 block truncate text-sm font-bold text-brutal-blue hover:underline"
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
				<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">External</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if data.workstream.linearTicket}
						<div
							class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
						>
							<div class="flex items-start justify-between">
								<button onclick={() => launch('linear')} class="text-left">
									<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">
										Linear Ticket
									</h3>
									<p class="mt-1 text-sm font-bold text-ink">
										{data.workstream.linearTicket.title}
									</p>
									<div class="mt-1 flex items-center gap-2 text-xs">
										<span class="font-mono font-bold text-ink/40"
											>{data.workstream.linearTicket.id}</span
										>
										<span
											class="rounded-sm border px-2 py-0.5 text-xs font-bold {statusColor(
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
									class="rounded-sm border-2 border-ink px-2 py-1 text-xs font-bold text-ink transition hover:bg-brutal-yellow disabled:opacity-50"
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
							class="rounded-sm border-2 border-ink bg-white p-4 text-left shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
						>
							<h3 class="text-xs font-black tracking-wide text-ink/60 uppercase">Pull Request</h3>
							<p class="mt-1 text-sm font-bold text-ink">
								{data.workstream.pullRequest.title}
							</p>
							<span
								class="mt-1 inline-block rounded-sm border border-brutal-purple bg-brutal-purple/20 px-2 py-0.5 text-xs font-bold text-ink"
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
				<h2 class="text-sm font-black tracking-wide text-ink/60 uppercase">Notes</h2>
				<div class="rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
					<p class="text-sm font-medium whitespace-pre-wrap text-ink">{data.workstream.notes}</p>
				</div>
			</section>
		{/if}
	{/if}
</div>
