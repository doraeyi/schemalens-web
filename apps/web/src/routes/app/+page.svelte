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
	import { signIn } from '@auth/sveltekit/client';
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
	import { lintSchema, type LintWarning } from '$lib/schema/lint';
	import { diffSchemas, buildMergedSchema, type SchemaDiff } from '$lib/schema/diff';
	import { applyDiffOverlay, clearDiffOverlay } from '$lib/canvas/diffOverlay';
	import SchemaCanvas from '$lib/components/SchemaCanvas.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';
	import DiagnosticsPanel, { type DisplayDiagnostic } from '$lib/components/DiagnosticsPanel.svelte';
	import ImportDialog from '$lib/components/ImportDialog.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import ViewSourceDialog from '$lib/components/ViewSourceDialog.svelte';
	import ConfirmDeleteDialog from '$lib/components/ConfirmDeleteDialog.svelte';
	import LoginPromptDialog from '$lib/components/LoginPromptDialog.svelte';
	import type { PageSummary } from '$lib/components/AppSidebar.svelte';
	import type { Session } from '@auth/sveltekit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// 不依賴 PageData 一定有 session 欄位——沒有 +layout.server.ts 提供登入狀態時
	// （例如這個部署還沒接上 GitHub OAuth／MySQL）安全地退回訪客模式，不讓型別檢查卡住。
	const session = $derived(((data as { session?: Session | null }).session ?? null));

	/** 一個全新、什麼都沒有的分頁——訪客沒有草稿、剛登入還沒有雲端分頁、刪掉最後一個分頁、
	 * 新增分頁時，一律套用這個，不再預塞範例內容。 */
	const EMPTY_SCHEMA_DSL = '';
	const EMPTY_SCHEMA_FILENAME = 'untitled.dbschema';
	/** 訪客在還沒登入時按「新增分頁」會先觸發登入，這個 key 記住「登入完成後要幫他建立分頁」的意圖。 */
	const PENDING_CREATE_KEY = 'sl-pending-create-page';

	let renderer: SchemaRenderer | null = null;
	let canvasHost: HTMLDivElement | null = null;
	let toolbarRef: Toolbar | undefined = $state();
	let appSidebarRef: AppSidebar | undefined = $state();

	let schema = $state<Schema | null>(null);
	let diagnostics = $state<SchemaDiagnostic[]>([]);
	let lintWarnings = $state<LintWarning[]>([]);
	const displayDiagnostics = $derived<DisplayDiagnostic[]>([
		...diagnostics.map((d) => ({
			code: d.code,
			severity: d.severity,
			message: d.message,
			detail: d.location ? `${d.location.line}:${d.location.column}` : undefined
		})),
		...lintWarnings.map((w) => ({
			code: w.code,
			severity: w.severity,
			message: w.message,
			detail: w.location ? (w.location.column ? `${w.location.tableId}.${w.location.column}` : w.location.tableId) : undefined
		}))
	]);
	let currentSource = $state('');
	let currentFileName = $state(EMPTY_SCHEMA_FILENAME);

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
	let showExportDialog = $state(false);
	let showViewSourceDialog = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	let deleteConfirm = $state<{ tableId: TableId } | null>(null);
	let showLoginPrompt = $state(false);
	let showCompareDialog = $state(false);
	let diffMode = $state<{ diff: SchemaDiff; sourceLabel: string } | null>(null);

	let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string, durationMs = 2500): void {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), durationMs);
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
			saveLocalDraft(currentFileName, currentSource);
			saveToCloud();
		}, 400);
	}

	/**
	 * 只有「訪客」或「登入但還沒有進到任何雲端分頁」才寫本機草稿——一旦有 activePageId，
	 * 內容已經確實存到雲端了，這裡如果還繼續寫，登出後訪客模式會撿到剛剛雲端分頁的殘留內容，
	 * 而不是真正空白（曾經發生過：登出後畫布還顯示登入時看的那份 schema）。
	 */
	function saveLocalDraft(fileName: string, source: string): void {
		if (!renderer || (session?.user && activePageId)) return;
		saveDraft({ fileName, source, viewState: toSerializable(renderer.getViewState()) });
	}

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
		lintWarnings = lintSchema(result.schema);
		// 不管原始來源是什麼格式（SQL、JSON、Markdown、DSL），存起來的一律是重新序列化過的 DSL——
		// 這是唯一一種「草稿／雲端分頁重新載入時保證能正確還原」的格式。loadSchemaFromText 只認得
		// .dbschema / .schema.json / .schema.md 這三種副檔名，完全沒有 SQL 分支；如果存的是原始
		// SQL 文字，下次重新整理／切換分頁時會被誤判成 DSL 去解析，整份炸掉（曾經發生過）。
		currentSource = toDsl(result.schema);
		currentFileName = fileName.replace(/\.(dbschema|schema\.(json|md)|sql)$/i, '') + '.dbschema';
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
		metricsText = t.metrics(result.schema.tables.length, result.schema.relations.length, elapsed);
		syncToolbarState();
		saveLocalDraft(currentFileName, currentSource);
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
		if (diffMode) return;
		schema = next;
		diagnostics = validateSchema(next, { file: currentFileName });
		lintWarnings = lintSchema(next);
		currentSource = toDsl(next);
		if (!renderer) return;
		if (options.refit) renderer.setSchema(next);
		else renderer.updateSchema(next);
		metricsText = t.metrics(next.tables.length, next.relations.length, 0);
		syncToolbarState();
		saveLocalDraft(currentFileName, currentSource);
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

	/** 右鍵選單「刪除」的入口：先開確認對話框列出會被牽連的關聯，不直接刪。 */
	function requestDeleteTable(tableId: TableId): void {
		deleteConfirm = { tableId };
	}

	function confirmDeleteTable(): void {
		if (!deleteConfirm) return;
		handleDeleteTable(deleteConfirm.tableId);
		deleteConfirm = null;
	}

	function cancelDeleteTable(): void {
		deleteConfirm = null;
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
			if (sessionStorage.getItem(PENDING_CREATE_KEY)) {
				sessionStorage.removeItem(PENDING_CREATE_KEY);
				// 訪客按「新增分頁」→ 觸發登入 → 整頁導轉去 GitHub 再導回來，這個往返會讓
				// currentSource 這些記憶體狀態整個重置——訪客當時畫布上的內容（匯入的／自己編輯的）
				// 只有 localStorage 草稿還留著，要先讀回來，handleCreatePage() 才不會存出一份空白的。
				const draft = loadDraft();
				if (draft) loadSchema(draft.source, draft.fileName, draft.viewState ? fromSerializable(draft.viewState) : undefined);
				fetchPages().then(() => handleCreatePage());
			} else {
				initCloudPages();
			}
			return;
		}
		const draft = loadDraft();
		if (draft) {
			loadSchema(draft.source, draft.fileName, draft.viewState ? fromSerializable(draft.viewState) : undefined);
		} else {
			loadSchema(EMPTY_SCHEMA_DSL, EMPTY_SCHEMA_FILENAME);
		}
	}

	async function fetchPages(): Promise<void> {
		const res = await fetch('/api/pages');
		pages = res.ok ? await res.json() : [];
	}

	/** Logged-in users skip the localStorage draft entirely and go straight to their most recently edited cloud page. */
	async function initCloudPages(): Promise<void> {
		await fetchPages();
		if (pages.length > 0) {
			await handleSelectPage(pages[0].id);
		} else {
			loadSchema(EMPTY_SCHEMA_DSL, EMPTY_SCHEMA_FILENAME);
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
		if (!session?.user) {
			showLoginPrompt = true;
			return;
		}
		// 還沒有任何分頁在編輯時（訪客剛匯入/編輯過東西、或剛登入還沒選過分頁），
		// 「新增分頁」實際上是要把手上這份內容存成第一個分頁，不能生一份空白的把它蓋掉。
		// 已經有分頁在編輯、要另外加一個新的才真的給空白（伺服器端沒收到 body 就是空白）。
		const body = activePageId ? undefined : JSON.stringify({ source: currentSource, fileName: currentFileName });
		const res = await fetch('/api/pages', {
			method: 'POST',
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body
		});
		if (!res.ok) {
			showToast(`新增分頁失敗：${res.status} ${await res.text()}`, 6000);
			return;
		}
		const page = await res.json();
		pages = [{ id: page.id, title: page.title, updatedAt: page.updatedAt }, ...pages];
		activePageId = page.id;
		loadSchema(page.source, page.fileName);
	}

	function confirmLoginPrompt(): void {
		showLoginPrompt = false;
		sessionStorage.setItem(PENDING_CREATE_KEY, '1');
		signIn('github');
	}

	function cancelLoginPrompt(): void {
		showLoginPrompt = false;
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
			else loadSchema(EMPTY_SCHEMA_DSL, EMPTY_SCHEMA_FILENAME);
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
					onSelect: () => requestDeleteTable(tableId)
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

	/**
	 * 版本比較用的第二份來源，只拿去算 diff、渲染一份合成 schema，完全不動目前正在編輯的
	 * schema/draft/雲端存檔——跟 handleImport 共用同一個 ImportDialog 元件，但不呼叫
	 * loadSchema()／applyLoadedSchema()。
	 */
	async function handleCompareImport(source: string, fileName: string, sqlDialect?: SqlDialectId): Promise<void> {
		showCompareDialog = false;
		if (!schema) return;
		const result = sqlDialect ? await loadSchemaFromSql(source, fileName, sqlDialect) : loadSchemaFromText(source, fileName);
		// 之前這裡直接丟掉 result.diagnostics——比較來源解析失敗時使用者完全看不到原因，
		// 只會看到一個「全部都是新增」這種莫名其妙的 diff（因為 compared 是空的）。現在改成
		// 把第一則實際的診斷訊息也顯示出來，不然「解析失敗」這四個字本身完全沒辦法除錯。
		// 注意：不能只挑 severity === 'error' 的——SQL 匯入那邊（parseSql.ts）刻意把每條敘述
		// 解析失敗都標成 'warning'（因為部分敘述失敗、其餘照樣成功是常態，見那邊的註解），
		// 只篩 'error' 會永遠篩不到東西，訊息就會一直退回到毫無資訊量的預設文字。
		if (result.schema.tables.length === 0) {
			const detail = result.diagnostics[0]?.message ?? '沒有解析出任何內容，可能是格式/方言選錯了';
			showToast(`比較失敗：${detail}`, 6000);
			return;
		}
		if (result.diagnostics.length > 0) {
			showToast(`比較來源有 ${result.diagnostics.length} 個解析問題（例如：${result.diagnostics[0].message}），diff 結果僅供參考`, 6000);
		}
		enterDiffMode(result.schema, fileName);
	}

	function enterDiffMode(compared: Schema, sourceLabel: string): void {
		if (!schema || !renderer) return;
		resetFocus();
		const diff = diffSchemas(compared, schema);
		const merged = buildMergedSchema(compared, schema);
		renderer.setSchema(merged);
		diffMode = { diff, sourceLabel };
		if (canvasHost) applyDiffOverlay(canvasHost, diff);
	}

	function exitDiffMode(): void {
		if (!schema || !renderer || !diffMode) return;
		if (canvasHost) clearDiffOverlay(canvasHost);
		renderer.setSchema(schema);
		diffMode = null;
		syncToolbarState();
	}

	function handleExportJson(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.(dbschema|schema\.md)$/i, '') + '.schema.json', toJson(schema), 'application/json');
	}

	function handleExportDsl(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.(dbschema|schema\.(json|md))$/i, '') + '.dbschema', toDsl(schema), 'text/plain');
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
				onDepth={(depth: number | null) => {
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

			<DiagnosticsPanel
				diagnostics={displayDiagnostics}
				onDismiss={() => {
					diagnostics = [];
					lintWarnings = [];
				}}
				onViewSource={() => (showViewSourceDialog = true)}
			/>

			{#if diffMode}
				<div
					class="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan bg-surface px-3 py-1.5 text-xs text-fg shadow-lg"
				>
					正在比較版本（{diffMode.sourceLabel} vs 目前）· 唯讀
					<span class="text-muted">
						+{diffMode.diff.addedTables.length} / -{diffMode.diff.removedTables.length} / ~{diffMode.diff.changedTables.length}
					</span>
					<button class="ml-1 rounded-full bg-cyan px-2 py-0.5 text-bg" onclick={exitDiffMode}>結束比較</button>
				</div>
			{/if}

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
				onExportClick={() => (showExportDialog = true)}
				onViewSourceClick={() => (showViewSourceDialog = true)}
				onToggleTheme={handleToggleTheme}
				onCompare={() => (showCompareDialog = true)}
				compareDisabled={!!diffMode}
			/>

			{#if toast}
				<div
					class="absolute top-3 right-3 z-30 max-w-sm rounded-lg border border-cyan bg-surface px-3 py-2 text-xs whitespace-pre-wrap text-fg shadow-lg"
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

{#if showExportDialog}
	<ExportDialog
		onClose={() => (showExportDialog = false)}
		onExportJson={handleExportJson}
		onExportDsl={handleExportDsl}
		onExportSql={handleExportSql}
	/>
{/if}

{#if showViewSourceDialog && schema}
	<ViewSourceDialog source={toDsl(schema)} onClose={() => (showViewSourceDialog = false)} />
{/if}

{#if showCompareDialog}
	<ImportDialog mode="compare" onClose={() => (showCompareDialog = false)} onImport={handleCompareImport} />
{/if}

{#if deleteConfirm && schema}
	<ConfirmDeleteDialog
		title={`確定要刪除資料表「${schema.tables.find((t) => t.id === deleteConfirm?.tableId)?.name ?? ''}」嗎？`}
		relations={mutate.relationsTouching(schema, deleteConfirm.tableId)}
		onConfirm={confirmDeleteTable}
		onCancel={cancelDeleteTable}
	/>
{/if}

{#if showLoginPrompt}
	<LoginPromptDialog
		message="請先登入才能新增分頁——分頁會儲存在雲端，跟你的 GitHub 帳號綁在一起。"
		onConfirm={confirmLoginPrompt}
		onCancel={cancelLoginPrompt}
	/>
{/if}
