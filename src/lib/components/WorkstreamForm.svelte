<script lang="ts">
	import type { Workstream, WorkstreamCreate } from '$lib/types';

	let {
		workstream,
		onsubmit
	}: { workstream?: Workstream; onsubmit: (data: WorkstreamCreate) => void } = $props();

	let name = $state(workstream?.name ?? '');
	let status: 'active' | 'done' = $state(workstream?.status ?? 'active');
	let repoPath = $state(workstream?.repoPath ?? '');
	let branch = $state(workstream?.branch ?? '');
	let ideWorkspace = $state(workstream?.ideWorkspace ?? '');
	let aiChatUrl = $state(workstream?.aiChatUrl ?? '');
	let browserUrl = $state(workstream?.browserUrl ?? '');
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
			ideWorkspace: ideWorkspace || undefined,
			aiChatUrl: aiChatUrl || undefined,
			browserUrl: browserUrl || undefined,
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
	<fieldset class="space-y-3 rounded-lg border border-zinc-800 p-4">
		<legend class="px-2 text-sm font-medium text-zinc-400">Linear Ticket (optional)</legend>
		<div>
			<label for="linearUrl" class="block text-xs text-zinc-400">Ticket URL</label>
			<div class="mt-1 flex gap-2">
				<input
					id="linearUrl"
					type="text"
					bind:value={linearUrl}
					onblur={handleLinearUrlBlur}
					placeholder="https://linear.app/team/issue/PRJ-123/..."
					class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
				<button
					type="button"
					onclick={fetchLinearTicket}
					disabled={linearFetching || (!linearUrl && !linearId)}
					class="rounded-md border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800 disabled:opacity-40"
				>
					{linearFetching ? 'Fetching...' : 'Fetch'}
				</button>
			</div>
			{#if linearError}
				<p class="mt-1 text-xs text-red-400">{linearError}</p>
			{/if}
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label for="linearId" class="block text-xs text-zinc-400">ID</label>
				<input
					id="linearId"
					type="text"
					bind:value={linearId}
					placeholder="PRJ-123"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearTitle" class="block text-xs text-zinc-400">Title</label>
				<input
					id="linearTitle"
					type="text"
					bind:value={linearTitle}
					placeholder="Auto-populated from ticket"
					readonly
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearStatus" class="block text-xs text-zinc-400">Status</label>
				<input
					id="linearStatus"
					type="text"
					bind:value={linearStatus}
					placeholder="Auto-populated from ticket"
					readonly
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
				/>
			</div>
		</div>
	</fieldset>

	<!-- Name -->
	<div>
		<label for="name" class="block text-sm font-medium text-zinc-300">Name *</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			required
			placeholder="e.g. Add user onboarding flow (auto-filled from Linear ticket)"
			class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
		/>
	</div>

	<!-- Repo & Branch -->
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="repoPath" class="block text-sm font-medium text-zinc-300">Repository Path</label>
			<input
				id="repoPath"
				type="text"
				bind:value={repoPath}
				placeholder="/path/to/repo"
				class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>
		<div>
			<label for="branch" class="block text-sm font-medium text-zinc-300">Branch</label>
			<input
				id="branch"
				type="text"
				bind:value={branch}
				placeholder="feature/my-feature"
				class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>
	</div>

	<!-- IDE & AI Chat -->
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="ideWorkspace" class="block text-sm font-medium text-zinc-300">IDE Workspace</label
			>
			<input
				id="ideWorkspace"
				type="text"
				bind:value={ideWorkspace}
				placeholder="/path/to/workspace or folder"
				class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>
		<div>
			<label for="aiChatUrl" class="block text-sm font-medium text-zinc-300">AI Chat URL</label>
			<input
				id="aiChatUrl"
				type="text"
				bind:value={aiChatUrl}
				placeholder="https://chat.openai.com/..."
				class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
			/>
		</div>
	</div>

	<!-- Browser URL -->
	<div>
		<label for="browserUrl" class="block text-sm font-medium text-zinc-300"
			>Localhost Browser URL</label
		>
		<input
			id="browserUrl"
			type="text"
			bind:value={browserUrl}
			placeholder="http://localhost:3000"
			class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
		/>
	</div>

	<!-- Pull Request -->
	<fieldset class="space-y-3 rounded-lg border border-zinc-800 p-4">
		<legend class="px-2 text-sm font-medium text-zinc-400">Pull Request (optional)</legend>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label for="prUrl" class="block text-xs text-zinc-400">URL</label>
				<input
					id="prUrl"
					type="text"
					bind:value={prUrl}
					placeholder="https://github.com/..."
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="prTitle" class="block text-xs text-zinc-400">Title</label>
				<input
					id="prTitle"
					type="text"
					bind:value={prTitle}
					placeholder="PR title"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="prStatus" class="block text-xs text-zinc-400">Status</label>
				<input
					id="prStatus"
					type="text"
					bind:value={prStatus}
					placeholder="Open"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
		</div>
	</fieldset>

	<!-- Notes -->
	<div>
		<label for="notes" class="block text-sm font-medium text-zinc-300">Notes</label>
		<textarea
			id="notes"
			bind:value={notes}
			rows={3}
			placeholder="Any context or notes about this workstream..."
			class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
		></textarea>
	</div>

	<!-- Submit -->
	<div class="flex justify-end gap-3">
		<a
			href="/"
			class="rounded-md border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
		>
			Cancel
		</a>
		<button
			type="submit"
			class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
		>
			{workstream ? 'Save Changes' : 'Create Workstream'}
		</button>
	</div>
</form>
