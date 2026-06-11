<script lang="ts">
	interface AnimalConfig {
		name: string;
		sprite: string;
		frameWidth: number;
		frameHeight: number;
		frames: number;
		sheetWidth: number;
	}

	const ANIMALS: AnimalConfig[] = [
		{
			name: 'bear',
			sprite: '/sprites/Bear_Walk.png',
			frameWidth: 64,
			frameHeight: 33,
			frames: 8,
			sheetWidth: 512
		},
		{
			name: 'fox',
			sprite: '/sprites/Fox_Walk.png',
			frameWidth: 64,
			frameHeight: 36,
			frames: 8,
			sheetWidth: 512
		},
		{
			name: 'wolf',
			sprite: '/sprites/Wolf_Walk.png',
			frameWidth: 64,
			frameHeight: 40,
			frames: 8,
			sheetWidth: 512
		},
		{
			name: 'deer',
			sprite: '/sprites/Deer_Walk.png',
			frameWidth: 72,
			frameHeight: 52,
			frames: 8,
			sheetWidth: 576
		},
		{
			name: 'boar',
			sprite: '/sprites/Boar_Walk.png',
			frameWidth: 64,
			frameHeight: 40,
			frames: 8,
			sheetWidth: 512
		},
		{
			name: 'rabbit',
			sprite: '/sprites/Rabbit_Hop.png',
			frameWidth: 32,
			frameHeight: 26,
			frames: 10,
			sheetWidth: 320
		}
	];

	const SCALE = 3;

	interface Props {
		workstreamIds: string[];
	}

	let { workstreamIds }: Props = $props();

	function hashString(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash);
	}

	function getAnimalForWorkstream(id: string, index: number): AnimalConfig {
		const hash = hashString(id);
		const offset = (hash + index) % ANIMALS.length;
		return ANIMALS[offset];
	}

	function getWalkDuration(id: string): number {
		return 18 + (hashString(id + 'speed') % 14);
	}

	function getAnimDelay(id: string): number {
		return -(hashString(id + 'delay') % 25);
	}

	function getBottomOffset(id: string): number {
		return 4 + (hashString(id + 'y') % 12);
	}
</script>

{#if workstreamIds.length > 0}
	<div class="woodland-sprites">
		{#each workstreamIds as id, index (id)}
			{@const animal = getAnimalForWorkstream(id, index)}
			{@const displayW = animal.frameWidth * SCALE}
			{@const displayH = animal.frameHeight * SCALE}
			{@const walkDuration = getWalkDuration(id)}
			{@const delay = getAnimDelay(id)}
			{@const bottom = getBottomOffset(id)}
			<div
				class="sprite-walker"
				style="
					animation: walk-across {walkDuration}s linear {delay}s infinite;
					bottom: {bottom}px;
				"
			>
				<div
					class="sprite sprite-{animal.name}"
					style="
						width: {displayW}px;
						height: {displayH}px;
						background-image: url('{animal.sprite}');
						background-size: {animal.sheetWidth * SCALE}px {displayH}px;
					"
				></div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.woodland-sprites {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 160px;
		pointer-events: none;
		z-index: 50;
		overflow: hidden;
	}

	.sprite-walker {
		position: absolute;
	}

	.sprite {
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		image-rendering: crisp-edges;
	}

	@keyframes walk-across {
		from {
			transform: translateX(-200px);
		}
		to {
			transform: translateX(100vw);
		}
	}

	@keyframes bear-walk {
		to {
			background-position: calc(-512px * 3) 0;
		}
	}

	@keyframes fox-walk {
		to {
			background-position: calc(-512px * 3) 0;
		}
	}

	@keyframes wolf-walk {
		to {
			background-position: calc(-512px * 3) 0;
		}
	}

	@keyframes deer-walk {
		to {
			background-position: calc(-576px * 3) 0;
		}
	}

	@keyframes boar-walk {
		to {
			background-position: calc(-512px * 3) 0;
		}
	}

	@keyframes rabbit-walk {
		to {
			background-position: calc(-320px * 3) 0;
		}
	}

	.sprite-bear {
		animation: bear-walk 0.8s steps(8) infinite;
	}

	.sprite-fox {
		animation: fox-walk 0.7s steps(8) infinite;
	}

	.sprite-wolf {
		animation: wolf-walk 0.75s steps(8) infinite;
	}

	.sprite-deer {
		animation: deer-walk 0.85s steps(8) infinite;
	}

	.sprite-boar {
		animation: boar-walk 0.8s steps(8) infinite;
	}

	.sprite-rabbit {
		animation: rabbit-walk 0.6s steps(10) infinite;
	}
</style>
