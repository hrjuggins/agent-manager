<script lang="ts">
	import { onMount } from 'svelte';

	let linearApiKey = $state('');
	let hasLinearKey = $state(false);
	let saving = $state(false);
	let message = $state('');

	onMount(async () => {
		const res = await fetch('/api/settings');
		if (res.ok) {
			const data = await res.json();
			linearApiKey = data.linearApiKey;
			hasLinearKey = data.hasLinearKey;
		}
	});

	async function saveSettings() {
		saving = true;
		message = '';
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ linearApiKey })
			});
			if (res.ok) {
				const data = await res.json();
				hasLinearKey = data.hasLinearKey;
				message = 'Settings saved';
				// Re-fetch to get masked key
				const refresh = await fetch('/api/settings');
				if (refresh.ok) {
					const refreshData = await refresh.json();
					linearApiKey = refreshData.linearApiKey;
				}
			} else {
				message = 'Failed to save';
			}
		} finally {
			saving = false;
		}
	}

	function clearKey() {
		linearApiKey = '';
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold">Settings</h1>
		<p class="mt-1 text-sm text-zinc-400">Configure integrations and preferences</p>
	</div>

	<section class="space-y-4 rounded-lg border border-zinc-800 p-6">
		<div>
			<h2 class="text-lg font-semibold">Linear Integration</h2>
			<p class="mt-1 text-sm text-zinc-400">
				Add your Linear API key to auto-fetch ticket details when creating workstreams. Get a key
				from
				<a
					href="https://linear.app/settings/api"
					target="_blank"
					class="text-indigo-400 hover:text-indigo-300">linear.app/settings/api</a
				>.
			</p>
		</div>

		<div>
			<label for="linearApiKey" class="block text-sm font-medium text-zinc-300">API Key</label>
			<div class="mt-1 flex gap-2">
				<input
					id="linearApiKey"
					type="text"
					bind:value={linearApiKey}
					placeholder="lin_api_..."
					class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
				{#if hasLinearKey}
					<button
						onclick={clearKey}
						class="rounded-md border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
					>
						Clear
					</button>
				{/if}
			</div>
			{#if hasLinearKey}
				<p class="mt-1 text-xs text-green-400">Key configured</p>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={saveSettings}
				disabled={saving}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save'}
			</button>
			{#if message}
				<span class="text-sm text-zinc-400">{message}</span>
			{/if}
		</div>
	</section>
</div>
