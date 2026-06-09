<script lang="ts">
	import { onMount } from 'svelte';
	import type { RepoSettings } from '$lib/types';

	// --- IDE ---
	let ideCommand = $state('');
	let ideSaving = $state(false);
	let ideMessage = $state('');

	// --- Linear ---
	let linearApiKey = $state('');
	let hasLinearKey = $state(false);
	let linearSaving = $state(false);
	let linearMessage = $state('');

	// --- Repos ---
	let repos = $state<RepoSettings[]>([]);
	let editingRepo = $state<RepoSettings | null>(null);
	let showAddRepo = $state(false);

	// Add/edit form state
	let repoName = $state('');
	let repoPath = $state('');
	let repoSetupScript = $state('');
	let repoSaving = $state(false);
	let repoMessage = $state('');

	onMount(async () => {
		const [settingsRes, reposRes] = await Promise.all([
			fetch('/api/settings'),
			fetch('/api/repos')
		]);
		if (settingsRes.ok) {
			const data = await settingsRes.json();
			hasLinearKey = data.hasLinearKey;
			ideCommand = data.ideCommand ?? '';
		}
		if (reposRes.ok) {
			repos = await reposRes.json();
		}
	});

	// --- IDE handlers ---
	async function saveIdeCommand() {
		ideSaving = true;
		ideMessage = '';
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ideCommand })
			});
			if (res.ok) {
				ideMessage = 'Saved';
			} else {
				ideMessage = 'Failed to save';
			}
		} finally {
			ideSaving = false;
		}
	}

	// --- Linear handlers ---
	async function saveLinearKey() {
		if (!linearApiKey) return;
		linearSaving = true;
		linearMessage = '';
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ linearApiKey })
			});
			if (res.ok) {
				const data = await res.json();
				hasLinearKey = data.hasLinearKey;
				linearApiKey = '';
				linearMessage = 'Key saved';
			} else {
				linearMessage = 'Failed to save';
			}
		} finally {
			linearSaving = false;
		}
	}

	async function clearLinearKey() {
		linearSaving = true;
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clearKey: true })
			});
			if (res.ok) {
				hasLinearKey = false;
				linearApiKey = '';
				linearMessage = 'Key removed';
			}
		} finally {
			linearSaving = false;
		}
	}

	// --- Repo handlers ---
	function startAddRepo() {
		editingRepo = null;
		repoName = '';
		repoPath = '';
		repoSetupScript = '';
		repoMessage = '';
		showAddRepo = true;
	}

	function startEditRepo(repo: RepoSettings) {
		editingRepo = repo;
		repoName = repo.name;
		repoPath = repo.path;
		repoSetupScript = repo.setupScript ?? '';
		repoMessage = '';
		showAddRepo = true;
	}

	function cancelRepoForm() {
		showAddRepo = false;
		editingRepo = null;
		repoMessage = '';
	}

	async function saveRepo() {
		if (!repoName || !repoPath) {
			repoMessage = 'Name and path are required';
			return;
		}
		repoSaving = true;
		repoMessage = '';
		try {
			const body = {
				name: repoName,
				path: repoPath,
				setupScript: repoSetupScript || undefined
			};

			let res: Response;
			if (editingRepo) {
				res = await fetch(`/api/repos/${editingRepo.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			} else {
				res = await fetch('/api/repos', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			}

			if (res.ok) {
				const saved = (await res.json()) as RepoSettings;
				if (editingRepo) {
					repos = repos.map((r) => (r.id === saved.id ? saved : r));
				} else {
					repos = [...repos, saved];
				}
				showAddRepo = false;
				editingRepo = null;
			} else {
				repoMessage = 'Failed to save';
			}
		} finally {
			repoSaving = false;
		}
	}

	async function deleteRepoById(id: string) {
		const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
		if (res.ok) {
			repos = repos.filter((r) => r.id !== id);
		}
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Settings</h1>
		<p class="mt-1 text-sm text-gray-500">Configure integrations and repositories</p>
	</div>

	<!-- IDE -->
	<section class="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
		<div>
			<h2 class="text-lg font-semibold text-gray-900">IDE</h2>
			<p class="mt-1 text-sm text-gray-500">
				The command used to open workstream directories. For example: <code
					class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">cursor</code
				>,
				<code class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">code</code>,
				<code class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">webstorm</code>, or
				<code class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700"
					>open -a "App Name"</code
				>.
			</p>
		</div>

		<div>
			<label for="ideCommand" class="block text-sm font-medium text-gray-700">IDE Command</label>
			<div class="mt-1 flex gap-2">
				<input
					id="ideCommand"
					type="text"
					bind:value={ideCommand}
					placeholder="cursor"
					class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={saveIdeCommand}
				disabled={ideSaving}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
			>
				{ideSaving ? 'Saving...' : 'Save'}
			</button>
			{#if ideMessage}
				<span class="text-sm text-gray-500">{ideMessage}</span>
			{/if}
		</div>
	</section>

	<!-- Linear Integration -->
	<section class="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
		<div>
			<h2 class="text-lg font-semibold text-gray-900">Linear Integration</h2>
			<p class="mt-1 text-sm text-gray-500">
				Add your Linear API key to auto-fetch ticket details. Get a key from
				<a
					href="https://linear.app/settings/api"
					target="_blank"
					class="text-indigo-600 hover:text-indigo-500">linear.app/settings/api</a
				>.
			</p>
		</div>

		<div>
			<label for="linearApiKey" class="block text-sm font-medium text-gray-700">API Key</label>
			<div class="mt-1 flex gap-2">
				<input
					id="linearApiKey"
					type="text"
					bind:value={linearApiKey}
					placeholder={hasLinearKey ? 'Key configured — enter new key to replace' : 'lin_api_...'}
					class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
				{#if hasLinearKey}
					<button
						onclick={clearLinearKey}
						class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
					>
						Clear
					</button>
				{/if}
			</div>
			{#if hasLinearKey}
				<p class="mt-1 text-xs text-green-600">Key configured</p>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={saveLinearKey}
				disabled={linearSaving}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
			>
				{linearSaving ? 'Saving...' : 'Save'}
			</button>
			{#if linearMessage}
				<span class="text-sm text-gray-500">{linearMessage}</span>
			{/if}
		</div>
	</section>

	<!-- Repositories -->
	<section class="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-gray-900">Repositories</h2>
				<p class="mt-1 text-sm text-gray-500">
					Configure repos with setup scripts that run when creating a new workstream.
				</p>
			</div>
			{#if !showAddRepo}
				<button
					onclick={startAddRepo}
					class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
				>
					Add Repo
				</button>
			{/if}
		</div>

		<!-- Repo list -->
		{#if repos.length > 0 && !showAddRepo}
			<div class="space-y-3">
				{#each repos as repo (repo.id)}
					<div class="rounded-md border border-gray-200 p-4">
						<div class="flex items-start justify-between">
							<div>
								<h3 class="font-medium text-gray-900">{repo.name}</h3>
								<p class="mt-0.5 text-sm text-gray-500">{repo.path}</p>
								{#if repo.setupScript}
									<p class="mt-1 text-xs text-gray-400">
										Script: {repo.setupScript.split('\n').filter((l) => l.trim()).length} line{repo.setupScript
											.split('\n')
											.filter((l) => l.trim()).length === 1
											? ''
											: 's'}
									</p>
								{/if}
							</div>
							<div class="flex gap-2">
								<button
									onclick={() => startEditRepo(repo)}
									class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
								>
									Edit
								</button>
								<button
									onclick={() => deleteRepoById(repo.id)}
									class="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50"
								>
									Remove
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if repos.length === 0 && !showAddRepo}
			<p class="text-sm text-gray-400">No repositories configured yet.</p>
		{/if}

		<!-- Add/Edit repo form -->
		{#if showAddRepo}
			<div class="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
				<h3 class="font-medium text-gray-900">{editingRepo ? 'Edit' : 'Add'} Repository</h3>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="repoName" class="block text-sm font-medium text-gray-700">Name</label>
						<input
							id="repoName"
							type="text"
							bind:value={repoName}
							placeholder="e.g. c3-repo"
							class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="repoPath" class="block text-sm font-medium text-gray-700">Path</label>
						<input
							id="repoPath"
							type="text"
							bind:value={repoPath}
							placeholder="/Users/you/code/c3-repo"
							class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="setupScript" class="block text-sm font-medium text-gray-700"
						>Setup Script</label
					>
					<p class="mt-0.5 text-xs text-gray-400">
						One command per line. The entire script runs when a workstream is created.
						Include dependency installs, dev servers, and port assignments directly in the
						script.
					</p>
					<textarea
						id="setupScript"
						bind:value={repoSetupScript}
						rows={4}
						placeholder="npm install\nnpm run dev -- --port 4001"
						class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
					></textarea>
				</div>

				{#if repoMessage}
					<p class="text-sm text-red-500">{repoMessage}</p>
				{/if}

				<div class="flex gap-2">
					<button
						onclick={saveRepo}
						disabled={repoSaving}
						class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
					>
						{repoSaving ? 'Saving...' : editingRepo ? 'Update' : 'Add'}
					</button>
					<button
						onclick={cancelRepoForm}
						class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	</section>
</div>
