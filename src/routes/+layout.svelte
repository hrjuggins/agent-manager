<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Workstream Hub</title>
</svelte:head>

<div class="min-h-screen bg-cream text-ink">
	<header class="border-b-3 border-ink bg-white px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<a href="/" class="text-xl font-black tracking-tight text-ink">Workstream Hub</a>
			<div class="flex items-center gap-3">
				<a
					href="/settings"
					class="rounded-sm border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
				>
					Settings
				</a>
				<a
					href="/workstreams/new"
					class="rounded-sm border-2 border-ink bg-brutal-blue px-3 py-1.5 text-sm font-bold text-white shadow-brutal-sm transition hover:translate-y-0.5 hover:shadow-none"
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
