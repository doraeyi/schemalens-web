<script lang="ts">
	import { groupNames, type Schema } from '@schemalens/schema-core';
	import { search, type SearchHit } from '@schemalens/schema-graph';
	import { stringsFor, type DetailLevel } from '@schemalens/schema-renderer';
	import { RotateCcw, Search as SearchIcon, SlidersHorizontal, X } from '@lucide/svelte';
	import { currentLocale, pick as pickLocale } from '$lib/i18n/current';

	// 沿用 VS Code 插件的字串，兩邊操作邏輯與用詞一致。
	const t = $derived(stringsFor(currentLocale()));
	const m = $derived(
		pickLocale({
			'zh-hant': {
				compact: '分區總覽',
				compactHint: '依群組分區、只顯示表名，點表看詳情',
				viewSettings: '檢視設定',
				noMatch: (q: string) => `沒有符合「${q}」的表或欄位`,
				view: '檢視',
				display: '顯示',
				comments: '欄位備註',
				focusHint: '點任一張表的標題，就能調整關聯深度與方向',
				selected: (n: number) => `已選取 ${n} 張表`
			},
			en: {
				compact: 'Zones',
				compactHint: 'Grouped into zones with table names only; click a table for details',
				viewSettings: 'View settings',
				noMatch: (q: string) => `No table or column matches "${q}"`,
				view: 'View',
				display: 'Display',
				comments: 'Column comments',
				focusHint: 'Click any table title to adjust relation depth and direction',
				selected: (n: number) => `${n} table${n === 1 ? '' : 's'} selected`
			}
		})
	);

	/** 「顯示」：分區總覽（原本的精簡模式）跟三種欄位密度併成同一組——之前是兩組各管一半，意思重疊。 */
	export type DisplayMode = 'compact' | DetailLevel;

	interface Props {
		schema: Schema | null;
		display: DisplayMode;
		expandComments: boolean;
		groupFilter: string | null;
		columnFocusLabel: string | null;
		selectedCount: number;
		layoutDirty: boolean;
		metricsText: string;
		/** 聚焦中時，深度／方向等設定在畫布上的 FocusBar；這裡只在沒聚焦時給一行提示。 */
		hasFocus: boolean;
		onDisplay: (mode: DisplayMode) => void;
		onComments: (expanded: boolean) => void;
		onGroupFilter: (group: string | null) => void;
		onClearColumnFocus: () => void;
		onClearSelection: () => void;
		onResetLayout: () => void;
		onPickHit: (hit: SearchHit) => void;
		onSearchResults: (hits: SearchHit[]) => void;
	}

	let {
		schema,
		display,
		expandComments,
		groupFilter,
		columnFocusLabel,
		selectedCount,
		layoutDirty,
		metricsText,
		hasFocus,
		onDisplay,
		onComments,
		onGroupFilter,
		onClearColumnFocus,
		onClearSelection,
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
	/** 手機寬度：設定收進「檢視」面板，工具列只留搜尋。 */
	let optionsOpen = $state(false);

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
		resultsOpen = true;
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
		optionsOpen = false;
		onPickHit(hit);
	}

	function onGroupSelectChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		onGroupFilter(value === '' ? null : value);
	}

	const displayOptions: Array<{ label: string; value: DisplayMode; hint: string }> = $derived([
		{ label: m.compact, value: 'compact', hint: m.compactHint },
		{ label: t.viewOverview, value: 'overview', hint: t.viewOverviewHint },
		{ label: t.viewKeys, value: 'keys', hint: t.viewKeysHint },
		{ label: t.viewFull, value: 'full', hint: t.viewFullHint }
	]);
</script>

<div
	class="sl-toolbar relative flex items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2 text-xs text-fg max-md:pl-14"
	role="toolbar"
	aria-label={m.viewSettings}
>
	<div class="relative min-w-0 max-md:flex-1">
		<div class="flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1 max-md:min-h-10">
			<SearchIcon size={13} class="flex-none text-muted" />
			<input
				bind:this={searchInput}
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				type="search"
				placeholder={t.searchPlaceholder}
				aria-label={t.searchPlaceholder}
				class="w-full min-w-0 bg-transparent text-xs text-fg placeholder:text-muted focus:outline-none md:w-56"
			/>
			<kbd class="hidden flex-none rounded border border-border px-1 font-mono text-[10px] text-muted md:inline">Ctrl F</kbd>
		</div>
		{#if resultsOpen}
			<div
				class="absolute top-full left-0 z-30 mt-1 max-h-80 w-85 max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl border border-border bg-surface shadow-xl shadow-black/40"
			>
				{#each hits as hit, i (hit.kind + hit.tableId + ('column' in hit ? hit.column : ''))}
					<button
						class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-surface-2 {i === cursor ? 'bg-surface-2' : ''}"
						onmousedown={(e) => {
							e.preventDefault();
							pick(hit);
						}}
					>
						<span class="w-11 flex-none text-[11px] font-bold text-muted"
							>{hit.kind === 'table' ? t.resultTable : t.resultColumn}</span
						>
						<span class="font-mono">{hit.label}</span>
						<span class="ml-auto text-[11px] text-muted">{hit.kind === 'column' ? hit.tableId : hit.matchedOn}</span>
					</button>
				{/each}
				{#if hits.length === 0}
					<div class="px-3 py-2 text-muted">{m.noMatch(query)}</div>
				{/if}
			</div>
		{/if}
	</div>

	<button
		class="sl-chip md:hidden"
		aria-expanded={optionsOpen}
		aria-controls="sl-toolbar-options"
		onclick={() => (optionsOpen = !optionsOpen)}
	>
		<SlidersHorizontal size={13} /> {m.view}
	</button>

	<div
		id="sl-toolbar-options"
		class="sl-toolbar-options {optionsOpen ? 'is-open' : ''} flex min-w-0 flex-1 items-center gap-x-3 gap-y-2"
	>
		<div class="flex flex-none flex-wrap items-center gap-1" role="group" aria-label={m.display}>
			<span class="mr-0.5 text-muted">{m.display}</span>
			{#each displayOptions as option (option.value)}
				<button
					class="sl-chip"
					aria-pressed={display === option.value}
					title={option.hint}
					onclick={() => onDisplay(option.value)}
				>
					{option.label}
				</button>
			{/each}
		</div>

		{#if groups.length > 0}
			<div class="flex flex-none items-center gap-1.5">
				<span class="text-muted">{t.groupLabel}</span>
				<select
					aria-label={t.groupLabel}
					class="max-w-40 rounded-full border border-border bg-bg/60 px-2.5 py-1 text-xs text-fg"
					value={groupFilter ?? ''}
					onchange={onGroupSelectChange}
				>
					<option value="">{t.allGroups}</option>
					{#each groups as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="flex flex-none items-center gap-1" role="group" aria-label={m.comments}>
			<span class="mr-0.5 text-muted">{m.comments}</span>
			<button class="sl-chip" aria-pressed={!expandComments} title={t.commentsTruncateHint} onclick={() => onComments(false)}>
				{t.commentsTruncate}
			</button>
			<button class="sl-chip" aria-pressed={expandComments} title={t.commentsExpandHint} onclick={() => onComments(true)}>
				{t.commentsExpand}
			</button>
		</div>

		<div class="flex flex-none items-center gap-1.5">
			<!-- 「縮放到全圖」在底部列的縮放百分比上（按一下就是），這裡不重複放一顆。 -->
			{#if layoutDirty}
				<button class="sl-button sl-button-secondary sl-button-sm" onclick={onResetLayout}>
					<RotateCcw size={12} />{t.resetLayout}
				</button>
			{/if}
		</div>

		{#if !hasFocus}
			<span class="hidden flex-none text-muted xl:inline">{m.focusHint}</span>
		{/if}
	</div>

	{#if selectedCount > 0}
		<button class="sl-chip flex-none border-violet text-violet" onclick={onClearSelection}>
			{m.selected(selectedCount)} <X size={11} />
		</button>
	{/if}

	{#if columnFocusLabel}
		<button class="sl-chip flex-none" aria-pressed="true" onclick={onClearColumnFocus}>
			{t.columnFocus}: {columnFocusLabel} <X size={11} />
		</button>
	{/if}

	<div class="flex-none text-muted tabular-nums max-md:hidden">{metricsText}</div>
</div>

<style>
	/* 桌面：一行排開，放不下才換行（但不會再因為聚焦而換行，聚焦設定在畫布上）。
	   手機：設定收起來，按「檢視」才在工具列下方展開成一張面板。 */
	@media (max-width: 767px) {
		.sl-toolbar-options {
			display: none;
		}
		.sl-toolbar-options.is-open {
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			z-index: 35;
			display: flex;
			flex-wrap: wrap;
			border-bottom: 1px solid var(--sl-border);
			background: var(--sl-surface);
			padding: 12px;
			box-shadow: 0 18px 30px -20px rgb(0 0 0 / 0.5);
		}
	}
	@media (min-width: 768px) {
		.sl-toolbar {
			flex-wrap: wrap;
		}
		.sl-toolbar-options {
			flex-wrap: wrap;
		}
	}
</style>
