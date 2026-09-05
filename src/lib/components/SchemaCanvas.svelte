<script lang="ts">
	import { onMount } from 'svelte';
	import { SchemaRenderer, type InteractionMode } from '@schemalens/schema-renderer';
	import type { SchemaDiagnostic, TableId } from '@schemalens/schema-core';

	interface Props {
		mode: InteractionMode;
		onReady: (renderer: SchemaRenderer, host: HTMLDivElement) => void;
		onTableContextMenu?: (event: MouseEvent, tableId: TableId | null) => void;
		onViewStateChanged?: () => void;
		onLayoutChanged?: () => void;
		onColumnSelected?: (target: { tableId: TableId; column: string } | null) => void;
		onOpenSource?: (target: { tableId: TableId; column?: string }) => void;
		onDiagnosticSelected?: (diagnostic: SchemaDiagnostic) => void;
		onViewportChanged?: (scale: number) => void;
		/** Ctrl/Cmd+click on a table card: toggle it in the multi-select set instead of focusing it. */
		onCardToggleSelect?: (tableId: TableId) => void;
		/** Plain click with no modifier key: caller uses this to clear any active multi-select. */
		onPlainClick?: () => void;
		/** Drag-box over blank background in select mode: report every table the box overlaps. */
		onMarqueeSelect?: (tableIds: TableId[], additive: boolean) => void;
	}

	let {
		mode,
		onReady,
		onTableContextMenu,
		onViewStateChanged,
		onLayoutChanged,
		onColumnSelected,
		onOpenSource,
		onDiagnosticSelected,
		onViewportChanged,
		onCardToggleSelect,
		onPlainClick,
		onMarqueeSelect
	}: Props = $props();

	let host: HTMLDivElement | undefined = $state();
	/** Marquee rectangle in host-local pixels, for the visual overlay only. */
	let marquee = $state<{ left: number; top: number; width: number; height: number } | null>(null);

	onMount(() => {
		if (!host) return;
		const renderer = new SchemaRenderer(host, {
			locale: 'zh-hant',
			events: {
				tableSelected: () => onViewStateChanged?.(),
				columnSelected: (target) => onColumnSelected?.(target),
				openSource: (target) => onOpenSource?.(target),
				layoutChanged: () => onLayoutChanged?.(),
				viewStateChanged: () => onViewStateChanged?.(),
				diagnosticSelected: (diagnostic) => onDiagnosticSelected?.(diagnostic),
				viewportChanged: (scale) => onViewportChanged?.(scale)
			}
		});
		onReady(renderer, host);

		const handleContextMenu = (event: MouseEvent) => {
			if (!onTableContextMenu) return;
			event.preventDefault();
			const target = event.target as HTMLElement;
			const card = target.closest<HTMLElement>('.dbs-card');
			onTableContextMenu(event, (card?.dataset.tableId as TableId | undefined) ?? null);
		};
		host.addEventListener('contextmenu', handleContextMenu);

		// Eats the click that follows a successful marquee drag, the same way the
		// vendored renderer eats the click after a card drag (see renderer.ts).
		let suppressNextClick = false;

		// Capture phase, on the host (an ancestor of the renderer's own root element):
		// runs before the renderer's own bubble-phase click handler, so stopPropagation()
		// here reliably pre-empts its focus/click logic without touching the vendored code.
		const handleClickCapture = (event: MouseEvent) => {
			if (suppressNextClick) {
				suppressNextClick = false;
				return;
			}

			const target = event.target as HTMLElement;
			if (target.closest('[data-action]')) return;

			if (event.ctrlKey || event.metaKey) {
				const card = target.closest<HTMLElement>('.dbs-card');
				if (!card || !onCardToggleSelect) return;
				event.preventDefault();
				event.stopPropagation();
				onCardToggleSelect(card.dataset.tableId as TableId);
				return;
			}

			onPlainClick?.();
		};
		host.addEventListener('click', handleClickCapture, true);

		// Drag-box select: only in "select" mode, only starting on blank background
		// (not a card — that's still card-reposition, handled entirely by the renderer).
		// "move" mode leaves pointerdown on the background alone so the renderer's own
		// pan logic can take it.
		const MARQUEE_THRESHOLD = 4;
		let marqueeActive = false;
		let marqueeAdditive = false;
		let originX = 0;
		let originY = 0;
		let hostRect: DOMRect | null = null;

		const handlePointerDown = (event: PointerEvent) => {
			if (event.button !== 0 || mode !== 'select') return;
			const target = event.target as HTMLElement;
			if (target.closest('.dbs-card') || target.closest('[data-action]')) return;

			marqueeActive = true;
			marqueeAdditive = event.shiftKey;
			hostRect = host!.getBoundingClientRect();
			originX = event.clientX;
			originY = event.clientY;
			marquee = { left: originX - hostRect.left, top: originY - hostRect.top, width: 0, height: 0 };
			host!.setPointerCapture?.(event.pointerId);
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!marqueeActive || !hostRect) return;
			const x = event.clientX;
			const y = event.clientY;
			marquee = {
				left: Math.min(originX, x) - hostRect.left,
				top: Math.min(originY, y) - hostRect.top,
				width: Math.abs(x - originX),
				height: Math.abs(y - originY)
			};
		};

		const endMarquee = (event: PointerEvent) => {
			if (!marqueeActive) return;
			marqueeActive = false;
			host?.releasePointerCapture?.(event.pointerId);
			const box = marquee;
			marquee = null;
			if (!box || !host) return;
			if (box.width < MARQUEE_THRESHOLD && box.height < MARQUEE_THRESHOLD) return;

			suppressNextClick = true;
			if (!onMarqueeSelect) return;
			const left = event.clientX < originX ? event.clientX : originX;
			const top = event.clientY < originY ? event.clientY : originY;
			const right = left + box.width;
			const bottom = top + box.height;

			const ids: TableId[] = [];
			for (const card of host.querySelectorAll<HTMLElement>('.dbs-card')) {
				const rect = card.getBoundingClientRect();
				const overlaps = rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top;
				if (overlaps && card.dataset.tableId) ids.push(card.dataset.tableId as TableId);
			}
			onMarqueeSelect(ids, marqueeAdditive);
		};

		host.addEventListener('pointerdown', handlePointerDown, true);
		host.addEventListener('pointermove', handlePointerMove);
		host.addEventListener('pointerup', endMarquee);
		host.addEventListener('pointercancel', endMarquee);

		const handleResize = () => renderer.fitView();
		window.addEventListener('resize', handleResize);

		return () => {
			host?.removeEventListener('contextmenu', handleContextMenu);
			host?.removeEventListener('click', handleClickCapture, true);
			host?.removeEventListener('pointerdown', handlePointerDown, true);
			host?.removeEventListener('pointermove', handlePointerMove);
			host?.removeEventListener('pointerup', endMarquee);
			host?.removeEventListener('pointercancel', endMarquee);
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div bind:this={host} class="relative h-full w-full">
	{#if marquee}
		<div
			class="pointer-events-none absolute z-30 border border-cyan bg-cyan/15"
			style:left="{marquee.left}px"
			style:top="{marquee.top}px"
			style:width="{marquee.width}px"
			style:height="{marquee.height}px"
		></div>
	{/if}
</div>
