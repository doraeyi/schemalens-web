<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_VIEW_STATE,
		stringsFor,
		type DetailLevel,
		type InteractionMode,
		type SchemaRenderer,
		type UnrelatedMode
	} from '@schemalens/schema-renderer';

	const t = stringsFor('zh-hant');
	import type { Schema, SchemaDiagnostic, TableId } from '@schemalens/schema-core';
	import type { SearchHit, TraversalDirection } from '@schemalens/schema-graph';
	import { loadSchemaFromText } from '$lib/schema/documentSchema';
	import { BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME } from '$lib/examples/blog';
	import {
		clearDraft,
		fromSerializable,
		loadDraft,
		saveDraft,
		toSerializable
	} from '$lib/persistence/localDraft';
	import {
		copyDiagramAsPng,
		copyDiagramAsSvg,
		copySchemaAsText,
		copyTableAsText,
		copyTablesAsText,
		downloadFile
	} from '$lib/export/exportImage';
	import { getTheme, initTheme, toggleTheme } from '$lib/stores/theme.svelte';
	import type { ViewMode } from '$lib/stores/viewMode';
	import { syncCompactOverlay, clearCompactOverlay } from '$lib/canvas/compactOverlay';
	import { createCompactLayoutEngine } from '$lib/canvas/compactLayout';
	import { layeredLayout } from '@schemalens/schema-layout';
	import { toJson, toDsl } from '@schemalens/schema-serializer';
	import SchemaCanvas from '$lib/components/SchemaCanvas.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import CompactSidebar from '$lib/components/CompactSidebar.svelte';
	import TableInspector from '$lib/components/TableInspector.svelte';
	import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';
	import DiagnosticsPanel from '$lib/components/DiagnosticsPanel.svelte';
	import ImportDialog from '$lib/components/ImportDialog.svelte';

	let renderer: SchemaRenderer | null = null;
	let canvasHost: HTMLDivElement | null = null;
	let toolbarRef: Toolbar | undefined = $state();
	let compactSidebarRef: CompactSidebar | undefined = $state();

	let schema = $state<Schema | null>(null);
	let diagnostics = $state<SchemaDiagnostic[]>([]);
	let currentSource = $state('');
	let currentFileName = $state(BLOG_EXAMPLE_FILENAME);

	let active = $state({
		detailLevel: DEFAULT_VIEW_STATE.detailLevel,
		depth: DEFAULT_VIEW_STATE.focus.depth,
		direction: DEFAULT_VIEW_STATE.focus.direction,
		unrelated: DEFAULT_VIEW_STATE.unrelated,
		expandComments: DEFAULT_VIEW_STATE.expandComments,
		groupFilter: DEFAULT_VIEW_STATE.groupFilter
	});
	let columnFocusLabel = $state<string | null>(null);
	let selectedTables = $state<Set<TableId>>(new Set());
	let layoutDirty = $state(false);
	let metricsText = $state('');
	let theme = $state(getTheme());
	let interactionMode = $state<InteractionMode>('select');
	let scalePercent = $state(100);
	let viewMode = $state<ViewMode>('full');
	let hiddenGroups = $state<Set<string>>(new Set());
	let focusedTableId = $state<TableId | null>(null);
	let previousDetailLevel: DetailLevel | null = null;
	const compactLayoutEngine = createCompactLayoutEngine(() => schema);

	let contextMenu = $state<{ x: number; y: number; tableId: TableId | null } | null>(null);
	let showImportDialog = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string): void {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2500);
	}

	function syncToolbarState(): void {
		if (!renderer) return;
		const state = renderer.getViewState();
		active = {
			detailLevel: state.detailLevel,
			depth: state.focus.depth,
			direction: state.focus.direction,
			unrelated: state.unrelated,
			expandComments: state.expandComments,
			groupFilter: state.groupFilter
		};
		focusedTableId = state.focus.tableId;
		syncSelectionHighlight();
		syncCompactState();
		scheduleDraftSave();
	}

	/** Compact mode's zone boxes + column counts live entirely in the app layer — see compactOverlay.ts. */
	function syncCompactState(): void {
		if (!canvasHost) return;
		if (viewMode === 'compact' && schema) syncCompactOverlay(canvasHost, schema, hiddenGroups);
		else clearCompactOverlay(canvasHost);
	}

	function toggleGroupVisibility(name: string): void {
		const next = new Set(hiddenGroups);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		hiddenGroups = next;
		syncCompactState();
	}

	function handleViewModeChange(mode: ViewMode): void {
		if (mode === viewMode) return;
		viewMode = mode;
		if (mode === 'compact') {
			previousDetailLevel = active.detailLevel;
			renderer?.setViewState({ detailLevel: 'compact' });
			renderer?.setLayoutEngine(compactLayoutEngine);
			// 精簡模式的分區版面本來就是由上往下排好的，點表格/關聯不用再自動 pan 過去。
			renderer?.setAutoCenterOnFocus(false);
		} else {
			renderer?.setLayoutEngine(layeredLayout);
			renderer?.setAutoCenterOnFocus(true);
			if (previousDetailLevel) renderer?.setViewState({ detailLevel: previousDetailLevel });
			previousDetailLevel = null;
		}
		syncToolbarState();
	}

	/**
	 * The vendored renderer has no multi-select concept of its own, so the
	 * highlight is applied directly to its rendered .dbs-card DOM nodes from
	 * here. Re-run after anything that can rebuild those nodes (detail level,
	 * collapse, new schema) — cheap even for large schemas.
	 */
	function syncSelectionHighlight(): void {
		if (!canvasHost) return;
		for (const card of canvasHost.querySelectorAll<HTMLElement>('.dbs-card')) {
			const id = card.dataset.tableId;
			card.classList.toggle('sl-multi-selected', !!id && selectedTables.has(id));
		}
	}

	function toggleTableSelection(tableId: TableId): void {
		const next = new Set(selectedTables);
		if (next.has(tableId)) next.delete(tableId);
		else next.add(tableId);
		selectedTables = next;
		syncSelectionHighlight();
	}

	function clearSelection(): void {
		if (selectedTables.size === 0) return;
		selectedTables = new Set();
		syncSelectionHighlight();
	}

	function scheduleDraftSave(): void {
		clearTimeout(draftSaveTimer);
		draftSaveTimer = setTimeout(() => {
			if (!renderer || !currentSource) return;
			saveDraft({
				fileName: currentFileName,
				source: currentSource,
				viewState: toSerializable(renderer.getViewState())
			});
		}, 400);
	}

	function loadSchema(source: string, fileName: string, viewState = DEFAULT_VIEW_STATE): void {
		const result = loadSchemaFromText(source, fileName);
		schema = result.schema;
		diagnostics = result.diagnostics;
		currentSource = source;
		currentFileName = fileName;
		selectedTables = new Set();

		if (!renderer) return;
		const start = performance.now();
		renderer.setViewState(viewState);
		renderer.setSchema(result.schema);
		const elapsed = Math.round(performance.now() - start);
		renderer.setDiagnostics(result.diagnostics);
		metricsText = t.metrics(result.schema.tables.length, result.schema.relations.length, elapsed);
		syncToolbarState();
		saveDraft({ fileName, source, viewState: toSerializable(renderer.getViewState()) });
	}

	function handleReady(instance: SchemaRenderer, host: HTMLDivElement): void {
		renderer = instance;
		canvasHost = host;
		renderer.setInteractionMode(interactionMode);
		scalePercent = Math.round(renderer.getScale() * 100);

		const draft = loadDraft();
		if (draft) {
			loadSchema(draft.source, draft.fileName, draft.viewState ? fromSerializable(draft.viewState) : undefined);
		} else {
			loadSchema(BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME);
		}
	}

	function resetFocus(): void {
		if (!renderer) return;
		renderer.setViewState({
			focus: { ...renderer.getViewState().focus, tableId: null },
			columnFocus: null,
			highlightedColumn: null,
			searchMatches: new Set()
		});
		columnFocusLabel = null;
		syncToolbarState();
	}

	function handleColumnSelected(target: { tableId: TableId; column: string } | null): void {
		columnFocusLabel = target ? `${target.tableId}.${target.column}` : null;
	}

	function handleContextMenu(event: MouseEvent, tableId: TableId | null): void {
		contextMenu = { x: event.clientX, y: event.clientY, tableId };
	}

	/**
	 * Right-clicking a table that's part of the active multi-select operates on
	 * the whole selection; otherwise it falls back to the single right-clicked
	 * table, or the whole schema when the background (no table) was clicked.
	 */
	function contextMenuItems(): ContextMenuItem[] {
		if (!contextMenu) return [];
		const { tableId } = contextMenu;
		const useSelection = selectedTables.size > 0 && (!tableId || selectedTables.has(tableId));
		const effectiveIds: TableId[] = useSelection
			? [...selectedTables]
			: tableId
				? [tableId]
				: [];
		const isMulti = effectiveIds.length > 1;

		const items: ContextMenuItem[] = [
			{
				label: isMulti ? `以 PNG 格式儲存選取的 ${effectiveIds.length} 張表到剪貼簿` : '以 PNG 格式儲存到剪貼簿',
				onSelect: async () => {
					if (!canvasHost || !schema) return;
					try {
						const selection = isMulti ? { schema, tableIds: new Set(effectiveIds) } : undefined;
						await copyDiagramAsPng(canvasHost, selection);
						showToast('已複製 PNG 圖片到剪貼簿');
					} catch {
						showToast('複製失敗 — 剪貼簿存取被瀏覽器擋下');
					}
				}
			},
			{
				label: isMulti ? `以 SVG 格式複製選取的 ${effectiveIds.length} 張表到剪貼簿` : '以 SVG 格式複製到剪貼簿',
				onSelect: async () => {
					if (!canvasHost || !schema) return;
					try {
						const selection = isMulti ? { schema, tableIds: new Set(effectiveIds) } : undefined;
						const result = await copyDiagramAsSvg(canvasHost, selection);
						showToast(
							result === 'image'
								? '已複製 SVG 圖片到剪貼簿'
								: '此瀏覽器不支援直接複製 SVG 圖片，已改為複製 SVG 原始碼文字'
						);
					} catch {
						showToast('複製失敗 — 剪貼簿存取被瀏覽器擋下');
					}
				}
			},
			{
				label: isMulti ? `以文字格式複製選取的 ${effectiveIds.length} 張表` : '以文字格式複製至剪貼簿',
				onSelect: async () => {
					if (!schema) return;
					try {
						if (effectiveIds.length > 1) await copyTablesAsText(schema, effectiveIds);
						else if (effectiveIds.length === 1) await copyTableAsText(schema, effectiveIds[0]);
						else await copySchemaAsText(schema);
						showToast('已複製 DSL 文字到剪貼簿');
					} catch {
						showToast('複製失敗 — 剪貼簿存取被瀏覽器擋下');
					}
				}
			}
		];
		return items;
	}

	function handleImport(source: string, fileName: string): void {
		showImportDialog = false;
		loadSchema(source, fileName);
	}

	function handleExportJson(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.(dbschema|schema\.md)$/i, '') + '.schema.json', toJson(schema), 'application/json');
	}

	function handleExportDsl(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.schema\.(json|md)$/i, '') + '.dbschema', toDsl(schema), 'text/plain');
	}

	function handleToggleTheme(): void {
		toggleTheme();
		theme = getTheme();
	}

	function handleModeChange(mode: InteractionMode): void {
		interactionMode = mode;
		renderer?.setInteractionMode(mode);
	}

	function handlePickHit(hit: SearchHit): void {
		if (!renderer) return;
		if (hit.kind === 'column') renderer.revealColumn(hit.tableId, hit.column);
		else renderer.focusTable(hit.tableId);
		syncToolbarState();
	}

	function handleSearchResults(hits: SearchHit[]): void {
		renderer?.setSearchMatches([...new Set(hits.map((hit) => hit.tableId))]);
	}

	function handleFocusTable(tableId: TableId): void {
		renderer?.focusTable(tableId);
		syncToolbarState();
	}

	onMount(() => {
		initTheme();
		theme = getTheme();

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (contextMenu) {
					contextMenu = null;
					return;
				}
				if (selectedTables.size > 0) {
					clearSelection();
					return;
				}
				resetFocus();
			} else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
				event.preventDefault();
				if (viewMode === 'compact') compactSidebarRef?.focusSearch();
				else toolbarRef?.focusSearch();
			}
		};
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<svelte:head>
	<title>SchemaLens — 工作區</title>
</svelte:head>

<div class="flex h-screen bg-bg text-fg">
	{#if viewMode === 'compact'}
		<CompactSidebar
			bind:this={compactSidebarRef}
			{schema}
			{hiddenGroups}
			onToggleGroup={toggleGroupVisibility}
			onPickHit={handlePickHit}
			onSearchResults={handleSearchResults}
		/>
	{/if}

	<div class="flex flex-1 flex-col">
		{#if viewMode === 'full'}
			<Toolbar
				bind:this={toolbarRef}
				{schema}
				{active}
				{columnFocusLabel}
				selectedCount={selectedTables.size}
				{layoutDirty}
				{metricsText}
				onDetailLevel={(level: DetailLevel) => {
					renderer?.setViewState({ detailLevel: level });
					syncToolbarState();
				}}
				onDepth={(depth: 1 | 2 | null) => {
					if (!renderer) return;
					renderer.setViewState({ focus: { ...renderer.getViewState().focus, depth } });
					syncToolbarState();
				}}
				onDirection={(direction: TraversalDirection) => {
					if (!renderer) return;
					renderer.setViewState({ focus: { ...renderer.getViewState().focus, direction } });
					syncToolbarState();
				}}
				onUnrelated={(mode: UnrelatedMode) => {
					renderer?.setViewState({ unrelated: mode });
					syncToolbarState();
				}}
				onComments={(expanded: boolean) => {
					renderer?.setViewState({ expandComments: expanded });
					syncToolbarState();
				}}
				onGroupFilter={(group: string | null) => {
					renderer?.setViewState({ groupFilter: group });
					syncToolbarState();
				}}
				onClearColumnFocus={() => {
					renderer?.clearColumnFocus();
					columnFocusLabel = null;
				}}
				onClearSelection={clearSelection}
				onResetFocus={resetFocus}
				onFitView={() => renderer?.fitView()}
				onResetLayout={() => {
					renderer?.resetLayout();
					layoutDirty = false;
				}}
				onPickHit={handlePickHit}
				onSearchResults={handleSearchResults}
			/>
		{/if}

		<div class="relative flex-1">
			<SchemaCanvas
				mode={interactionMode}
				onReady={handleReady}
				onTableContextMenu={handleContextMenu}
				onViewStateChanged={syncToolbarState}
				onLayoutChanged={() => {
					layoutDirty = true;
					scheduleDraftSave();
				}}
				onColumnSelected={handleColumnSelected}
				onDiagnosticSelected={() => {}}
				onViewportChanged={(scale) => (scalePercent = Math.round(scale * 100))}
				onCardToggleSelect={toggleTableSelection}
				onPlainClick={clearSelection}
				onMarqueeSelect={(ids, additive) => {
					selectedTables = additive ? new Set([...selectedTables, ...ids]) : new Set(ids);
					syncSelectionHighlight();
				}}
			/>

			<DiagnosticsPanel {diagnostics} onDismiss={() => (diagnostics = [])} />

			<BottomBar
				{scalePercent}
				mode={interactionMode}
				{theme}
				{viewMode}
				onZoomIn={() => renderer?.zoomBy(1.2)}
				onZoomOut={() => renderer?.zoomBy(1 / 1.2)}
				onZoomReset={() => renderer?.fitView()}
				onModeChange={handleModeChange}
				onViewModeChange={handleViewModeChange}
				onImportClick={() => (showImportDialog = true)}
				onExportJson={handleExportJson}
				onExportDsl={handleExportDsl}
				onToggleTheme={handleToggleTheme}
			/>

			{#if toast}
				<div
					class="absolute top-3 right-3 z-30 rounded-lg border border-cyan bg-surface px-3 py-2 text-xs text-fg shadow-lg"
				>
					{toast}
				</div>
			{/if}
		</div>
	</div>

	{#if viewMode === 'compact' && focusedTableId && schema}
		<TableInspector {schema} tableId={focusedTableId} onClose={resetFocus} onFocusTable={handleFocusTable} />
	{/if}
</div>

{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={contextMenuItems()}
		onClose={() => (contextMenu = null)}
	/>
{/if}

{#if showImportDialog}
	<ImportDialog onClose={() => (showImportDialog = false)} onImport={handleImport} />
{/if}
