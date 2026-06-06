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

	// PR fields
	let prUrl = $state(workstream?.pullRequest?.url ?? '');
	let prTitle = $state(workstream?.pullRequest?.title ?? '');
	let prStatus = $state(workstream?.pullRequest?.status ?? '');

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
	<!-- Name -->
	<div>
		<label for="name" class="block text-sm font-medium text-zinc-300">Name *</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			required
			placeholder="e.g. Add user onboarding flow"
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

	<!-- Linear Ticket -->
	<fieldset class="space-y-3 rounded-lg border border-zinc-800 p-4">
		<legend class="px-2 text-sm font-medium text-zinc-400">Linear Ticket (optional)</legend>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="linearId" class="block text-xs text-zinc-400">Ticket ID</label>
				<input
					id="linearId"
					type="text"
					bind:value={linearId}
					placeholder="PRJ-123"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearUrl" class="block text-xs text-zinc-400">URL</label>
				<input
					id="linearUrl"
					type="text"
					bind:value={linearUrl}
					placeholder="https://linear.app/..."
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearTitle" class="block text-xs text-zinc-400">Title</label>
				<input
					id="linearTitle"
					type="text"
					bind:value={linearTitle}
					placeholder="Ticket title"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="linearStatus" class="block text-xs text-zinc-400">Status</label>
				<input
					id="linearStatus"
					type="text"
					bind:value={linearStatus}
					placeholder="In Progress"
					class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
		</div>
	</fieldset>

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
