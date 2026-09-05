<script lang="ts">
	import { onMount } from 'svelte';

	export interface ContextMenuItem {
		label: string;
		onSelect: () => void;
	}

	interface Props {
		x: number;
		y: number;
		items: ContextMenuItem[];
		onClose: () => void;
	}

	let { x, y, items, onClose }: Props = $props();
	let menuEl: HTMLDivElement | undefined = $state();

	onMount(() => {
		const handlePointerDown = (event: PointerEvent) => {
			if (menuEl && !menuEl.contains(event.target as Node)) onClose();
		};
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('pointerdown', handlePointerDown, true);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('pointerdown', handlePointerDown, true);
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div
	bind:this={menuEl}
	class="fixed z-50 min-w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 text-xs text-fg shadow-2xl shadow-black/50"
	style:left="{x}px"
	style:top="{y}px"
>
	{#each items as item (item.label)}
		<button
			class="block w-full px-3 py-1.5 text-left hover:bg-surface-2 hover:text-cyan"
			onclick={() => {
				item.onSelect();
				onClose();
			}}
		>
			{item.label}
		</button>
	{/each}
</div>
