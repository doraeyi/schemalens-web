<script lang="ts">
	import { groupNames, type Schema } from '@schemalens/schema-core';
	import { search, type SearchHit, type TraversalDirection } from '@schemalens/schema-graph';
	import { stringsFor, type DetailLevel, type UnrelatedMode } from '@schemalens/schema-renderer';
	import { Maximize2, RotateCcw, Search as SearchIcon, X } from '@lucide/svelte';

	// 沿用 VS Code 插件的中文字串，兩邊操作邏輯與用詞一致。
	const t = stringsFor('zh-hant');

	interface ActiveState {
		detailLevel: DetailLevel;
		depth: number | null;
		direction: TraversalDirection;
		unrelated: UnrelatedMode;
		expandComments: boolean;
		groupFilter: string | null;
	}

	interface Props {
		schema: Schema | null;
		active: ActiveState;
		columnFocusLabel: string | null;
		selectedCount: number;
		layoutDirty: boolean;
		metricsText: string;
		onDetailLevel: (level: DetailLevel) => void;
		onDepth: (depth: number | null) => void;
		onDirection: (direction: TraversalDirection) => void;
		onUnrelated: (mode: UnrelatedMode) => void;
		onComments: (expanded: boolean) => void;
		onGroupFilter: (group: string | null) => void;
		onClearColumnFocus: () => void;
		onClearSelection: () => void;
		onResetFocus: () => void;
		onFitView: () => void;
		onResetLayout: () => void;
		onPickHit: (hit: SearchHit) => void;
		onSearchResults: (hits: SearchHit[]) => void;
	}

	let {
		schema,
		active,
		columnFocusLabel,
		selectedCount,
		layoutDirty,
		metricsText,
		onDetailLevel,
		onDepth,
		onDirection,
		onUnrelated,
		onComments,
		onGroupFilter,
		onClearColumnFocus,
		onClearSelection,
		onResetFocus,
		onFitView,
		onResetLayout,
		onPickHit,
		onSearchResults
	}: Props = $props();

	let query = $state('');
	let hits = $state<SearchHit[]>([]);
	let cursor = $state(-1);
	let resultsOpen = $state(false);
	let searchInput: HTMLInputElement | undefined = $state();
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	const groups = $derived(schema ? groupNames(schema) : []);

	export function focusSearch(): void {
		searchInput?.focus();
		searchInput?.select();
	}

	function runSearch(value: string): void {
		if (!schema || !value.trim()) {
			hits = [];
			cursor = -1;
			resultsOpen = false;
			onSearchResults([]);
			return;
		}
		hits = search(schema, value, 60);
		cursor = hits.length ? 0 : -1;
		resultsOpen = hits.length > 0;
		onSearchResults(hits);
	}

	function handleInput(): void {
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(() => runSearch(query), 80);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (hits.length === 0) return;
			cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
		} else if (event.key === 'Enter') {
			const hit = hits[cursor >= 0 ? cursor : 0];
			if (hit) pick(hit);
		} else if (event.key === 'Escape') {
			resultsOpen = false;
		}
	}

	function pick(hit: SearchHit): void {
		resultsOpen = false;
		onPickHit(hit);
	}

	function onGroupSelectChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		onGroupFilter(value === '' ? null : value);
	}
</script>

<div
	class="flex flex-wrap items-center gap-2.5 border-b border-border bg-surface/80 px-3 py-2 text-xs text-fg backdrop-blur-md"
>
	<div class="relative">
		<div class="flex items-center gap-1.5 rounded-md border border-border bg-bg/60 px-2 py-1">
			<SearchIcon size={13} class="text-muted" />
			<input
				bind:this={searchInput}
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				type="search"
				placeholder={t.searchPlaceholder}
				class="w-56 bg-transparent text-xs text-fg placeholder:text-muted focus:outline-none"
			/>
		</div>
		{#if resultsOpen}
			<div
				class="absolute top-full left-0 z-20 mt-1 max-h-80 w-85 overflow-auto rounded-lg border border-border bg-surface shadow-xl shadow-black/40"
			>
				{#each hits as hit, i (hit.kind + hit.tableId + ('column' in hit ? hit.column : ''))}
					<button
						class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-surface-2 {i ===
						cursor
							? 'bg-surface-2'
							: ''}"
						onmousedown={(e) => {
							e.preventDefault();
							pick(hit);
						}}
					>
						<span class="w-11 flex-none text-[9px] font-bold text-muted"
							>{hit.kind === 'table' ? t.resultTable : t.resultColumn}</span
						>
						<span class="font-mono">{hit.label}</span>
						<span class="ml-auto text-[10px] text-muted"
							>{hit.kind === 'column' ? hit.tableId : hit.matchedOn}</span
						>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{@render buttonGroup(t.viewGroup, [
		{ label: t.viewOverview, value: 'overview' },
		{ label: t.viewKeys, value: 'keys' },
		{ label: t.viewFull, value: 'full' }
	], active.detailLevel, onDetailLevel)}

	{@render buttonGroup(t.depthGroup, [
		{ label: t.depthAll, value: null },
		{ label: t.depthLevels(1), value: 1 },
		{ label: t.depthLevels(2), value: 2 }
	], active.depth, onDepth)}

	{@render buttonGroup(t.directionGroup, [
		{ label: t.directionAll, value: 'all' },
		{ label: t.directionUpstream, value: 'upstream' },
		{ label: t.directionDownstream, value: 'downstream' }
	], active.direction, onDirection)}

	{@render buttonGroup(t.unrelatedGroup, [
		{ label: t.unrelatedDim, value: 'dim' },
		{ label: t.unrelatedHide, value: 'hide' }
	], active.unrelated, onUnrelated)}

	{#if groups.length > 0}
		<div class="flex items-center gap-1.5">
			<span class="text-muted">{t.groupLabel}</span>
			<select
				class="max-w-40 rounded-md border border-border bg-bg/60 px-1.5 py-1 text-xs text-fg"
				value={active.groupFilter ?? ''}
				onchange={onGroupSelectChange}
			>
				<option value="">{t.allGroups}</option>
				{#each groups as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{@render buttonGroup(t.commentsGroup, [
		{ label: t.commentsTruncate, value: false },
		{ label: t.commentsExpand, value: true }
	], active.expandComments, onComments)}

	<div class="flex items-center gap-1.5">
		<button class="sl-btn" onclick={onResetFocus}>{t.resetFocus}</button>
		<button class="sl-btn" onclick={onFitView}><Maximize2 size={12} class="mr-1 inline" />{t.fitView}</button>
		{#if layoutDirty}
			<button class="sl-btn" onclick={onResetLayout}
				><RotateCcw size={12} class="mr-1 inline" />{t.resetLayout}</button
			>
		{/if}
	</div>

	{#if selectedCount > 0}
		<button
			class="ml-auto flex items-center gap-1 rounded-md border border-violet px-2 py-1 text-violet"
			onclick={onClearSelection}
		>
			已選取 {selectedCount} 張表 <X size={11} />
		</button>
	{/if}

	{#if columnFocusLabel}
		<button
			class="{selectedCount > 0 ? '' : 'ml-auto'} flex items-center gap-1 rounded-md border border-cyan px-2 py-1 text-cyan"
			onclick={onClearColumnFocus}
		>
			{t.columnFocus}: {columnFocusLabel} <X size={11} />
		</button>
	{/if}

	<div class="{columnFocusLabel || selectedCount > 0 ? '' : 'ml-auto'} text-muted">{metricsText}</div>
</div>

{#snippet buttonGroup(
	label: string,
	options: Array<{ label: string; value: string | number | boolean | null }>,
	activeValue: string | number | boolean | null,
	onPick: (value: any) => void
)}
	<div class="flex items-center gap-1">
		<span class="text-muted">{label}</span>
		{#each options as option (String(option.value))}
			<button
				class="sl-btn {option.value === activeValue ? 'sl-btn-active' : ''}"
				onclick={() => onPick(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
{/snippet}

<style>
	:global(.sl-btn) {
		padding: 3px 8px;
		border-radius: 6px;
		border: 1px solid var(--sl-border);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		white-space: nowrap;
	}
	:global(.sl-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 12%, transparent);
		border-color: var(--sl-cyan);
	}
	:global(.sl-btn-active) {
		background: var(--sl-cyan);
		color: var(--sl-bg);
		border-color: transparent;
	}
</style>
