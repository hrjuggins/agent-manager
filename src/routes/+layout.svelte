<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Workstream Hub</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 px-6 py-4">
		<div class="mx-auto flex max-w-5xl items-center justify-between">
			<a href="/" class="text-lg font-semibold tracking-tight">Workstream Hub</a>
			<div class="flex items-center gap-3">
				<a
					href="/settings"
					class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm transition hover:bg-zinc-800"
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
	<main class="mx-auto max-w-5xl px-6 py-8">
		{@render children()}
	</main>
</div>
