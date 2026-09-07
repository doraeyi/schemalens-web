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
	import { validateSchema, type Column, type Schema, type SchemaDiagnostic, type TableId } from '@schemalens/schema-core';
	import type { SearchHit, TraversalDirection } from '@schemalens/schema-graph';
	import { loadSchemaFromText, loadSchemaFromSql, type LoadedSchema } from '$lib/schema/documentSchema';
	import type { SqlDialectId } from '$lib/import/sql/types';
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
	import { syncCompactOverlay, clearCompactOverlay, applyGroupVisibility } from '$lib/canvas/compactOverlay';
	import { createCompactLayoutEngine } from '$lib/canvas/compactLayout';
	import { layeredLayout } from '@schemalens/schema-layout';
	import { toJson, toDsl } from '@schemalens/schema-serializer';
	import * as mutate from '$lib/schema/mutations';
	import SchemaCanvas from '$lib/components/SchemaCanvas.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';
	import DiagnosticsPanel from '$lib/components/DiagnosticsPanel.svelte';
	import ImportDialog from '$lib/components/ImportDialog.svelte';
	import type { PageSummary } from '$lib/components/AppSidebar.svelte';
	import type { Session } from '@auth/sveltekit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// 不依賴 PageData 一定有 session 欄位——沒有 +layout.server.ts 提供登入狀態時
	// （例如這個部署還沒接上 GitHub OAuth／MySQL）安全地退回訪客模式，不讓型別檢查卡住。
	const session = $derived(((data as { session?: Session | null }).session ?? null));

	let renderer: SchemaRenderer | null = null;
	let canvasHost: HTMLDivElement | null = null;
	let toolbarRef: Toolbar | undefined = $state();
	let appSidebarRef: AppSidebar | undefined = $state();

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
	let pages = $state<PageSummary[]>([]);
	let activePageId = $state<string | null>(null);
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

	/**
	 * Compact mode's zone boxes + connectors live entirely in the app layer —
	 * see compactOverlay.ts. Group visibility (主題區域 tab) applies in both
	 * modes, so full mode re-applies it after clearing the compact-only DOM.
	 */
	function syncCompactState(): void {
		if (!canvasHost) return;
		if (viewMode === 'compact' && schema) {
			syncCompactOverlay(canvasHost, schema, hiddenGroups);
		} else {
			clearCompactOverlay(canvasHost);
			applyGroupVisibility(canvasHost, hiddenGroups);
		}
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
			saveToCloud();
		}, 400);
	}

	/**
	 * Guests (or a logged-in user with no page open yet) only ever get the
	 * localStorage draft above — this is purely additive for logged-in users
	 * with an active cloud page, fired alongside it, never instead of it.
	 */
	function saveToCloud(): void {
		if (!session?.user || !activePageId) return;
		fetch(`/api/pages/${activePageId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ source: currentSource, fileName: currentFileName })
		}).catch(() => {});
	}

	function applyLoadedSchema(result: LoadedSchema, source: string, fileName: string, viewState?: typeof DEFAULT_VIEW_STATE): void {
		schema = result.schema;
		diagnostics = result.diagnostics;
		currentSource = source;
		currentFileName = fileName;
		selectedTables = new Set();

		if (!renderer) return;
		// 沒有明確帶入 viewState（例如匯入、範例載入）時，不能無條件套用 DEFAULT_VIEW_STATE——
		// 那樣會把 detailLevel 蓋回 'full'，讓使用者明明在精簡模式匯入，畫面卻變回完整模式，
		// 要手動切一次完整→精簡才會恢復。這裡改成照目前的 viewMode 決定要恢復成哪種預設值。
		const resolvedViewState =
			viewState ?? (viewMode === 'compact' ? { ...DEFAULT_VIEW_STATE, detailLevel: 'compact' as DetailLevel } : DEFAULT_VIEW_STATE);
		const start = performance.now();
		renderer.setViewState(resolvedViewState);
		renderer.setSchema(result.schema);
		const elapsed = Math.round(performance.now() - start);
		renderer.setDiagnostics(result.diagnostics);
		metricsText = t.metrics(result.schema.tables.length, result.schema.relations.length, elapsed);
		syncToolbarState();
		saveDraft({ fileName, source, viewState: toSerializable(renderer.getViewState()) });
		saveToCloud();
	}

	function loadSchema(source: string, fileName: string, viewState?: typeof DEFAULT_VIEW_STATE): void {
		applyLoadedSchema(loadSchemaFromText(source, fileName), source, fileName, viewState);
	}

	/** SQL 匯入是唯一 async 的載入路徑（要動態載入 node-sql-parser），其餘 loadSchema() 呼叫點不受影響。 */
	async function loadSchemaFromSqlAndApply(source: string, fileName: string, dialect: SqlDialectId): Promise<void> {
		const result = await loadSchemaFromSql(source, fileName, dialect);
		applyLoadedSchema(result, source, fileName);
	}

	/**
	 * Shared landing spot for every table/column edit. `refit: true` (table
	 * count actually changed) uses renderer.setSchema, which re-fits the
	 * view; `refit: false` (renaming/tweaking a column on an existing table)
	 * uses the lighter updateSchema so the camera doesn't jump around while
	 * someone is mid-edit.
	 */
	function commitSchema(next: Schema, options: { refit?: boolean } = {}): void {
		schema = next;
		diagnostics = validateSchema(next, { file: currentFileName });
		currentSource = toDsl(next);
		if (!renderer) return;
		if (options.refit) renderer.setSchema(next);
		else renderer.updateSchema(next);
		renderer.setDiagnostics(diagnostics);
		metricsText = t.metrics(next.tables.length, next.relations.length, 0);
		syncToolbarState();
		saveDraft({ fileName: currentFileName, source: currentSource, viewState: toSerializable(renderer.getViewState()) });
		saveToCloud();
	}

	function handleCreateTable(): void {
		if (!schema) return;
		commitSchema(mutate.createTable(schema), { refit: true });
	}

	function handleDuplicateTable(tableId: TableId): void {
		if (!schema) return;
		commitSchema(mutate.duplicateTable(schema, tableId), { refit: true });
	}

	function handleDeleteTable(tableId: TableId): void {
		if (!schema) return;
		commitSchema(mutate.deleteTable(schema, tableId), { refit: true });
	}

	function handleDeleteSelected(): void {
		if (!schema || selectedTables.size === 0) return;
		const next = [...selectedTables].reduce((acc, id) => mutate.deleteTable(acc, id), schema);
		commitSchema(next, { refit: true });
		clearSelection();
	}

	function handleRenameTable(tableId: TableId, name: string): void {
		if (!schema) return;
		commitSchema(mutate.renameTable(schema, tableId, name));
	}

	function handleAddColumn(tableId: TableId): void {
		if (!schema) return;
		commitSchema(mutate.addColumn(schema, tableId));
	}

	function handleUpdateColumn(tableId: TableId, columnName: string, patch: Partial<Column>): void {
		if (!schema) return;
		commitSchema(mutate.updateColumn(schema, tableId, columnName, patch));
	}

	function handleDeleteColumn(tableId: TableId, columnName: string): void {
		if (!schema) return;
		commitSchema(mutate.deleteColumn(schema, tableId, columnName));
	}

	function handleReady(instance: SchemaRenderer, host: HTMLDivElement): void {
		renderer = instance;
		canvasHost = host;
		renderer.setInteractionMode(interactionMode);
		scalePercent = Math.round(renderer.getScale() * 100);

		if (session?.user) {
			initCloudPages();
			return;
		}
		const draft = loadDraft();
		if (draft) {
			loadSchema(draft.source, draft.fileName, draft.viewState ? fromSerializable(draft.viewState) : undefined);
		} else {
			loadSchema(BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME);
		}
	}

	/** Logged-in users skip the localStorage draft entirely and go straight to their most recently edited cloud page. */
	async function initCloudPages(): Promise<void> {
		const res = await fetch('/api/pages');
		pages = res.ok ? await res.json() : [];
		if (pages.length > 0) {
			await handleSelectPage(pages[0].id);
		} else {
			loadSchema(BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME);
		}
	}

	async function handleSelectPage(pageId: string): Promise<void> {
		if (pageId === activePageId) return;
		const res = await fetch(`/api/pages/${pageId}`);
		if (!res.ok) return;
		const page = await res.json();
		activePageId = pageId;
		loadSchema(page.source, page.fileName);
	}

	async function handleCreatePage(): Promise<void> {
		const res = await fetch('/api/pages', { method: 'POST' });
		if (!res.ok) return;
		const page = await res.json();
		pages = [{ id: page.id, title: page.title, updatedAt: page.updatedAt }, ...pages];
		activePageId = page.id;
		loadSchema(page.source, page.fileName);
	}

	async function handleRenamePage(pageId: string, title: string): Promise<void> {
		pages = pages.map((p) => (p.id === pageId ? { ...p, title } : p));
		try {
			await fetch(`/api/pages/${pageId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
		} catch {
			// best-effort — local list already reflects the rename, next save/reload reconciles
		}
	}

	async function handleDeletePage(pageId: string): Promise<void> {
		pages = pages.filter((p) => p.id !== pageId);
		if (activePageId === pageId) {
			activePageId = null;
			if (pages.length > 0) await handleSelectPage(pages[0].id);
			else loadSchema(BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME);
		}
		try {
			await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
		} catch {
			// best-effort — it's already gone from the visible list
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

		const items: ContextMenuItem[] = [];

		// 側欄拿掉之後，右鍵空白畫布是唯一的「新增資料表」入口。
		if (!tableId && effectiveIds.length === 0) {
			items.push({ label: '新增資料表', onSelect: handleCreateTable });
		}

		// 編輯/建立副本/刪除只在單一表格（非多選）時有意義。
		if (tableId && !isMulti) {
			items.push(
				{
					label: '編輯',
					onSelect: () => handleFocusTable(tableId)
				},
				{
					label: '建立副本',
					onSelect: () => handleDuplicateTable(tableId)
				},
				{
					label: '刪除',
					onSelect: () => {
						const table = schema?.tables.find((t) => t.id === tableId);
						if (!table) return;
						if (!confirm(`確定要刪除資料表「${table.name}」嗎？連到它的關聯也會一併移除。`)) return;
						handleDeleteTable(tableId);
					}
				}
			);
		}

		items.push(
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
		);
		return items;
	}

	function handleImport(source: string, fileName: string, sqlDialect?: SqlDialectId): void {
		showImportDialog = false;
		if (sqlDialect) {
			void loadSchemaFromSqlAndApply(source, fileName, sqlDialect);
			return;
		}
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

	async function handleExportSql(dialectId: import('$lib/export/sql').SqlDialectId): Promise<void> {
		if (!schema) return;
		const { renderSchemaAsSql } = await import('$lib/export/sql');
		const base = currentFileName.replace(/\.(dbschema|schema\.(json|md))$/i, '');
		downloadFile(`${base}.${dialectId}.sql`, renderSchemaAsSql(schema, dialectId), 'text/plain');
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
				if (viewMode === 'compact') appSidebarRef?.focusSearch();
				else toolbarRef?.focusSearch();
			} else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTables.size > 0) {
				const target = event.target as HTMLElement | null;
				const tag = target?.tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
				event.preventDefault();
				handleDeleteSelected();
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
	<AppSidebar
		bind:this={appSidebarRef}
		{schema}
		{session}
		{pages}
		{activePageId}
		{focusedTableId}
		{hiddenGroups}
		onPickHit={handlePickHit}
		onSearchResults={handleSearchResults}
		onSelectPage={handleSelectPage}
		onCreatePage={handleCreatePage}
		onRenamePage={handleRenamePage}
		onDeletePage={handleDeletePage}
		onCloseInspector={resetFocus}
		onFocusTable={handleFocusTable}
		onToggleGroup={toggleGroupVisibility}
		onDuplicateTable={handleDuplicateTable}
		onDeleteTable={handleDeleteTable}
		onRenameTable={handleRenameTable}
		onAddColumn={handleAddColumn}
		onUpdateColumn={handleUpdateColumn}
		onDeleteColumn={handleDeleteColumn}
	/>

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
				onExportSql={handleExportSql}
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
