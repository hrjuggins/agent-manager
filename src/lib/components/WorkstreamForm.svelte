<script lang="ts">
	import { onMount } from 'svelte';
	import type { Workstream, WorkstreamCreate, RepoSettings } from '$lib/types';

	let {
		workstream,
		onsubmit
	}: { workstream?: Workstream; onsubmit: (data: WorkstreamCreate) => void } = $props();

	let name = $state(workstream?.name ?? '');
	let status: 'active' | 'done' = $state(workstream?.status ?? 'active');
	let repoPath = $state(workstream?.repoPath ?? '');
	let branch = $state(workstream?.branch ?? '');
	let baseBranch = $state(workstream?.baseBranch ?? '');

	// Configured repos from settings
	let configuredRepos = $state<RepoSettings[]>([]);
	let selectedRepoId = $state('');

	onMount(async () => {
		const res = await fetch('/api/repos');
		if (res.ok) {
			configuredRepos = await res.json();
			// If editing and repoPath matches a configured repo, select it
			if (repoPath) {
				const match = configuredRepos.find((r) => r.path === repoPath);
				if (match) selectedRepoId = match.id;
			}
		}
	});

	function handleRepoSelect() {
		const repo = configuredRepos.find((r) => r.id === selectedRepoId);
		repoPath = repo?.path ?? '';
	}

	let notes = $state(workstream?.notes ?? '');

	// Linear ticket fields
	let linearId = $state(workstream?.linearTicket?.id ?? '');
	let linearUrl = $state(workstream?.linearTicket?.url ?? '');
	let linearTitle = $state(workstream?.linearTicket?.title ?? '');
	let linearStatus = $state(workstream?.linearTicket?.status ?? '');
	let linearFetching = $state(false);
	let linearError = $state('');

	// PR fields
	let prUrl = $state(workstream?.pullRequest?.url ?? '');
	let prTitle = $state(workstream?.pullRequest?.title ?? '');
	let prStatus = $state(workstream?.pullRequest?.status ?? '');

	async function fetchLinearTicket() {
		const input = linearUrl || linearId;
		if (!input) return;

		linearFetching = true;
		linearError = '';
		try {
			const body: Record<string, string> = {};
			if (linearUrl) body.url = linearUrl;
			else body.identifier = linearId;

			const res = await fetch('/api/linear/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const err = await res.json();
				linearError = err.message || 'Failed to fetch ticket';
				return;
			}

			const data = await res.json();
			linearId = data.identifier;
			linearTitle = data.title;
			linearStatus = data.status;
			if (data.url) linearUrl = data.url;

			// Auto-populate workstream name if empty
			if (!name && data.title) {
				name = data.title;
			}

			// Auto-populate branch from Linear's suggested branch name
			if (!branch && data.branchName) {
				branch = data.branchName;
			}

			// Auto-populate PR from Linear attachments
			if (!prUrl && data.pullRequests?.length > 0) {
				const pr = data.pullRequests[0];
				prUrl = pr.url;
				prTitle = pr.title;
				prStatus = pr.status;
			}
		} catch {
			linearError = 'Network error fetching ticket';
		} finally {
			linearFetching = false;
		}
	}

	function handleLinearUrlBlur() {
		if (linearUrl && linearUrl.includes('linear.app')) {
			fetchLinearTicket();
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		const data: WorkstreamCreate = {
			name,
			status,
			repoPath: repoPath || undefined,
			branch: branch || undefined,
			baseBranch: baseBranch || undefined,

			notes: notes || undefined,
			devServices: workstream?.devServices ?? [],
			linearTicket:
				linearId || linearUrl
					? { id: linearId, url: linearUrl, title: linearTitle, status: linearStatus }
					: undefined,
			pullRequest: prUrl || prTitle ? { url: prUrl, title: prTitle, status: prStatus } : undefined
		};
		onsubmit(data);
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Linear Ticket — first so it can populate name -->
	<fieldset class="space-y-3 rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
		<legend class="px-2 text-sm font-bold text-ink/60">Linear Ticket (optional)</legend>
		<div>
			<label for="linearUrl" class="block text-xs font-bold text-ink/60">Ticket URL</label>
			<div class="mt-1 flex gap-2">
				<input
					id="linearUrl"
					type="text"
					bind:value={linearUrl}
					onblur={handleLinearUrlBlur}
					placeholder="https://linear.app/team/issue/PRJ-123/..."
					class="flex-1 rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
				<button
					type="button"
					onclick={fetchLinearTicket}
					disabled={linearFetching || (!linearUrl && !linearId)}
					class="rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink transition hover:bg-brutal-yellow disabled:opacity-40"
				>
					{linearFetching ? 'Fetching...' : 'Fetch'}
				</button>
			</div>
			{#if linearError}
				<p class="mt-1 text-xs font-bold text-brutal-red">{linearError}</p>
			{/if}
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label for="linearId" class="block text-xs font-bold text-ink/60">ID</label>
				<input
					id="linearId"
					type="text"
					bind:value={linearId}
					placeholder="PRJ-123"
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearTitle" class="block text-xs font-bold text-ink/60">Title</label>
				<input
					id="linearTitle"
					type="text"
					bind:value={linearTitle}
					placeholder="Auto-populated from ticket"
					readonly
					class="mt-1 w-full rounded-sm border-2 border-ink/30 bg-cream px-3 py-2 text-sm text-ink/60 placeholder:text-ink/30 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearStatus" class="block text-xs font-bold text-ink/60">Status</label>
				<input
					id="linearStatus"
					type="text"
					bind:value={linearStatus}
					placeholder="Auto-populated from ticket"
					readonly
					class="mt-1 w-full rounded-sm border-2 border-ink/30 bg-cream px-3 py-2 text-sm text-ink/60 placeholder:text-ink/30 focus:outline-none"
				/>
			</div>
		</div>
	</fieldset>

	<!-- Name -->
	<div>
		<label for="name" class="block text-sm font-bold text-ink">Name *</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			required
			placeholder="e.g. Add user onboarding flow (auto-filled from Linear ticket)"
			class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
		/>
	</div>

	<!-- Repo & Branch -->
	<div class="grid gap-4 sm:grid-cols-3">
		<div>
			<label for="repoSelect" class="block text-sm font-bold text-ink">Repository</label>
			{#if configuredRepos.length > 0}
				<select
					id="repoSelect"
					bind:value={selectedRepoId}
					onchange={handleRepoSelect}
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				>
					<option value="">Select a repo...</option>
					{#each configuredRepos as repo (repo.id)}
						<option value={repo.id}>{repo.name}</option>
					{/each}
				</select>
				{#if repoPath}
					<p class="mt-1 text-xs font-medium text-ink/40">{repoPath}</p>
				{/if}
			{:else}
				<input
					id="repoSelect"
					type="text"
					bind:value={repoPath}
					placeholder="/path/to/repo (configure repos in Settings)"
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
			{/if}
		</div>
		<div>
			<label for="branch" class="block text-sm font-bold text-ink">Branch</label>
			<input
				id="branch"
				type="text"
				bind:value={branch}
				placeholder="feature/my-feature"
				class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
			/>
		</div>
		<div>
			<label for="baseBranch" class="block text-sm font-bold text-ink">Base Branch</label>
			<input
				id="baseBranch"
				type="text"
				bind:value={baseBranch}
				placeholder="main (optional)"
				class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
			/>
			<p class="mt-1 text-xs font-medium text-ink/40">Branch off this instead of HEAD</p>
		</div>
	</div>

	<!-- Pull Request -->
	<fieldset class="space-y-3 rounded-sm border-2 border-ink bg-white p-4 shadow-brutal-sm">
		<legend class="px-2 text-sm font-bold text-ink/60">Pull Request (optional)</legend>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label for="prUrl" class="block text-xs font-bold text-ink/60">URL</label>
				<input
					id="prUrl"
					type="text"
					bind:value={prUrl}
					placeholder="https://github.com/..."
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
			</div>
			<div>
				<label for="prTitle" class="block text-xs font-bold text-ink/60">Title</label>
				<input
					id="prTitle"
					type="text"
					bind:value={prTitle}
					placeholder="PR title"
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
			</div>
			<div>
				<label for="prStatus" class="block text-xs font-bold text-ink/60">Status</label>
				<input
					id="prStatus"
					type="text"
					bind:value={prStatus}
					placeholder="Open"
					class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
				/>
			</div>
		</div>
	</fieldset>

	<!-- Notes -->
	<div>
		<label for="notes" class="block text-sm font-bold text-ink">Notes</label>
		<textarea
			id="notes"
			bind:value={notes}
			rows={3}
			placeholder="Any context or notes about this workstream..."
			class="mt-1 w-full rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brutal-blue focus:ring-2 focus:ring-brutal-blue/30 focus:outline-none"
		></textarea>
	</div>

	<!-- Submit -->
	<div class="flex justify-end gap-3">
		<a
			href="/"
			class="rounded-sm border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink shadow-brutal-sm transition hover:-translate-y-0.5 hover:shadow-brutal"
		>
			Cancel
		</a>
		<button
			type="submit"
			class="rounded-sm border-2 border-ink bg-brutal-blue px-4 py-2 text-sm font-bold text-white shadow-brutal-sm transition hover:-translate-y-0.5 hover:shadow-brutal"
		>
			{workstream ? 'Save Changes' : 'Create Workstream'}
		</button>
	</div>
</form>
