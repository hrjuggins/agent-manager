<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Workstream Hub</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 text-gray-900">
	<header class="border-b border-gray-200 bg-white px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<a href="/" class="text-lg font-semibold tracking-tight text-gray-900">Workstream Hub</a>
			<div class="flex items-center gap-3">
				<a
					href="/settings"
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
				>
					Settings
				</a>
				<a
					href="/workstreams/new"
					class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
				>
					New Workstream
				</a>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-7xl px-6 py-8">
		{@render children()}
	</main>
</div>
