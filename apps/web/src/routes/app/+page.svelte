<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_VIEW_STATE,
		applyGroupVisibility,
		clearCompactOverlay,
		createCompactLayoutEngine,
		syncCompactOverlay,
		stringsFor,
		type DetailLevel,
		type InteractionMode,
		type SchemaRenderer,
		type UnrelatedMode
	} from '@schemalens/schema-renderer';

	const locale = $derived(currentLocale());
	const t = $derived(stringsFor(locale));
	const m = $derived(APP_MESSAGES[locale]);
	import { validateSchema, type Column, type Schema, type SchemaDiagnostic, type TableId } from '@schemalens/schema-core';
	import type { SearchHit, TraversalDirection } from '@schemalens/schema-graph';
	import { loadSchemaFromText, loadSchemaFromSql, type LoadedSchema } from '$lib/schema/documentSchema';
	import type { SqlDialectId } from '@schemalens/schema-sql';
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/state';
	import { currentLocale } from '$lib/i18n/current';
	import type { Locale } from '$lib/i18n/locale';
	import { APP_MESSAGES } from './messages';
	import { createSchemaCollab, type SchemaCollabSession } from '$lib/collab/schemaCollab';
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
	import { layeredLayout } from '@schemalens/schema-layout';
	import { toJson, toDsl } from '@schemalens/schema-serializer';
	import * as mutate from '$lib/schema/mutations';
	import { lintSchema, type LintWarning } from '@schemalens/schema-lint';
	import { diffSchemas, buildMergedSchema, tableOverlapRatio, type SchemaDiff } from '@schemalens/schema-diff';
	import { applyDiffOverlay, clearDiffOverlay } from '@schemalens/schema-renderer';
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
	import EmptyCanvas from '$lib/components/EmptyCanvas.svelte';
	import FocusBar from '$lib/components/FocusBar.svelte';
	import type { DisplayMode } from '$lib/components/Toolbar.svelte';
	import { SAMPLE_SCHEMA_DSL, SAMPLE_SCHEMA_DSL_EN, SAMPLE_SCHEMA_FILENAME } from '$lib/schema/sampleSchema';
	import AiSettingsDialog from '$lib/components/AiSettingsDialog.svelte';
	import { clearAiSettings, loadAiSettings, saveAiSettings, type AiSettings } from '$lib/ai/settings';
	import VersionHistoryDialog, { type VersionSummary } from '$lib/components/VersionHistoryDialog.svelte';
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
			advisory: true,
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
	/** 目前這個分頁是不是即時協作模式、目前登入的人是不是它的擁有者——決定要不要開協作 session、要不要顯示邀請按鈕。 */
	let activePageMode = $state<'normal' | 'realtime'>('normal');
	let activePageIsOwner = $state(true);
	/** 即時協作 session——本機 dev 專用，見 $lib/collab/schemaCollab.ts。房間就是 pageId，切分頁時换新的。 */
	let collab: SchemaCollabSession | null = null;
	let collabRoom = $state<string | null>(null);
	let inviteLink = $state<string | null>(null);
	let inviteLoading = $state(false);
	let previousDetailLevel: DetailLevel | null = null;
	const compactLayoutEngine = createCompactLayoutEngine(() => schema);

	let contextMenu = $state<{ x: number; y: number; tableId: TableId | null } | null>(null);
	let createPageMenu = $state<{ x: number; y: number } | null>(null);
	let showImportDialog = $state(false);
	let showExportDialog = $state(false);
	let showViewSourceDialog = $state(false);
	let showAiSettings = $state(false);
	let aiSettings = $state<AiSettings | null>(null);
	let toast = $state<string | null>(null);
	/** 提示上的動作按鈕（目前只有匯入後的「復原」）。 */
	let toastAction = $state<{ label: string; run: () => void } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	/** 給螢幕閱讀器的狀態播報（聚焦哪張表、取消聚焦）。 */
	let liveMessage = $state('');
	let announcedFocus: TableId | null = null;
	/** 從畫布 Shift+Enter／雙擊進到程式碼對話框時，要捲到哪張表。 */
	let viewSourceTable = $state<string | null>(null);

	let deleteConfirm = $state<{ tableId: TableId } | null>(null);
	let showLoginPrompt = $state(false);
	let showCompareDialog = $state(false);
	let diffMode = $state<{ diff: SchemaDiff; sourceLabel: string; nextLabel: string } | null>(null);
	let showVersionHistory = $state(false);
	let versions = $state<VersionSummary[]>([]);

	let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Ctrl+Z／Ctrl+Y 用的編輯歷史：每次 commitSchema 改動前的 schema 快照。切分頁、載入草稿、
	 * 收到協作對象的修改時清空——復原只退自己在這個分頁上做的事，不會把別人剛改的蓋回去。
	 */
	const HISTORY_LIMIT = 100;
	let undoStack: Schema[] = [];
	let redoStack: Schema[] = [];

	function clearHistory(): void {
		undoStack = [];
		redoStack = [];
	}

	/** 有對話框或選單開著時，畫布快捷鍵不作用，免得在對話框後面偷偷改到資料。 */
	const overlayOpen = $derived(
		!!contextMenu ||
			!!createPageMenu ||
			!!deleteConfirm ||
			showImportDialog ||
			showExportDialog ||
			showViewSourceDialog ||
			showAiSettings ||
			showLoginPrompt ||
			showCompareDialog ||
			showVersionHistory
	);

	/** renderer 還沒準備好、或雲端分頁還在載入時不要閃一下空狀態。 */
	let canvasReady = $state(false);
	const hasTables = $derived((schema?.tables.length ?? 0) > 0);

	function showToast(message: string, durationMs = 2500, action: { label: string; run: () => void } | null = null): void {
		toast = message;
		toastAction = action;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = null;
			toastAction = null;
		}, durationMs);
	}

	/** 聚焦改變時播報一句，螢幕閱讀器使用者才知道畫面變了。 */
	function announceFocus(tableId: TableId | null): void {
		if (tableId === announcedFocus) return;
		announcedFocus = tableId;
		if (!tableId || !schema) {
			liveMessage = tableId === null && schema ? m.focusCleared : '';
			return;
		}
		const table = schema.tables.find((t) => t.id === tableId);
		const related = new Set(
			schema.relations
				.filter((r) => r.sourceTable === tableId || r.targetTable === tableId)
				.map((r) => (r.sourceTable === tableId ? r.targetTable : r.sourceTable))
		);
		liveMessage = m.focused(table?.name ?? tableId, related.size);
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
		announceFocus(focusedTableId);
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

	/** 工具列「顯示」：分區總覽就是精簡模式，其餘三個是完整模式下的欄位密度。 */
	function handleDisplay(display: DisplayMode): void {
		if (display === 'compact') {
			handleViewModeChange('compact');
			return;
		}
		if (viewMode === 'compact') handleViewModeChange('full');
		renderer?.setViewState({ detailLevel: display });
		syncToolbarState();
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

	/**
	 * 雲端上「最後一次確定跟我一致」的內容——自己存成功的、或剛從雲端載入的。一般分頁會被
	 * 瀏覽器以外的地方改掉（MCP：使用者在 claude.ai／ChatGPT 裡叫 AI 改），拿這個比對才分得出
	 * 「雲端變了是別人改的」還是「我自己剛存的」。
	 */
	let lastCloudSource: string | null = null;
	let cloudSavesInFlight = 0;

	function saveToCloud(): void {
		if (!session?.user || !activePageId) return;
		const pageId = activePageId;
		const source = currentSource;
		cloudSavesInFlight++;
		fetch(`/api/pages/${pageId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ source, fileName: currentFileName })
		})
			.then((res) => {
				if (res.ok && pageId === activePageId) lastCloudSource = source;
			})
			.catch(() => {})
			.finally(() => cloudSavesInFlight--);
	}

	/**
	 * 一般分頁的外部修改偵測（即時協作分頁走 Yjs，不需要這個）。切回這個視窗、或畫面開著時定期檢查；
	 * 自己還有存檔在路上、或正在比較模式時先不動，避免拿到自己還沒寫進去的舊內容把畫面蓋回去。
	 */
	async function checkExternalChanges(): Promise<void> {
		if (!session?.user || !activePageId || activePageMode === 'realtime' || diffMode || cloudSavesInFlight > 0) return;
		if (document.visibilityState !== 'visible') return;
		const pageId = activePageId;
		const res = await fetch(`/api/pages/${pageId}`).catch(() => null);
		if (!res?.ok || pageId !== activePageId || cloudSavesInFlight > 0) return;
		const pageRow = await res.json();
		if (lastCloudSource === null || pageRow.source === lastCloudSource) return;
		lastCloudSource = pageRow.source;
		applyRemoteCollabSchema(loadSchemaFromText(pageRow.source, pageRow.fileName).schema);
		showToast(m.externalChange, 5000);
	}

	function applyLoadedSchema(
		result: LoadedSchema,
		source: string,
		fileName: string,
		viewState?: typeof DEFAULT_VIEW_STATE,
		resetZoomTo100 = false
	): void {
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
		clearHistory();

		if (!renderer) return;
		// 沒有明確帶入 viewState（例如匯入、範例載入）時，不能無條件套用 DEFAULT_VIEW_STATE——
		// 那樣會把 detailLevel 蓋回 'full'，讓使用者明明在精簡模式匯入，畫面卻變回完整模式，
		// 要手動切一次完整→精簡才會恢復。這裡改成照目前的 viewMode 決定要恢復成哪種預設值。
		const resolvedViewState =
			viewState ?? (viewMode === 'compact' ? { ...DEFAULT_VIEW_STATE, detailLevel: 'compact' as DetailLevel } : DEFAULT_VIEW_STATE);
		const start = performance.now();
		renderer.setViewState(resolvedViewState);
		renderer.setSchema(result.schema);
		// 匯入不管表有多少一律先給 100% 實際大小，使用者自己決定要不要縮小——
		// 不像一般載入分頁那樣自動縮放塞進畫面，避免表一多整個被縮到看不清楚。
		if (resetZoomTo100) renderer.centerAtScale(1);
		// 手機上「縮放到全圖」常常縮到 30% 幾，欄位字剩 4px；至少保留 60%，其餘用手指拖。
		if (window.matchMedia('(max-width: 767px)').matches && renderer.getScale() < 0.6) renderer.centerAtScale(0.6);
		const elapsed = Math.round(performance.now() - start);
		metricsText = t.metrics(result.schema.tables.length, result.schema.relations.length, elapsed);
		syncToolbarState();
		saveLocalDraft(currentFileName, currentSource);
		saveToCloud();
		// 注意：這裡故意不推到 collab——applyLoadedSchema 除了匯入之外，草稿還原／切換分頁／
		// 雲端分頁載入……這些「載入我自己原本的狀態」的路徑全部共用這個函式。之前在這裡無條件
		// push 過，結果只要協作房間裡有任何一個人重新整理頁面、切分頁，就會把整份共享內容
		// 洗成他自己載入的東西，害其他協作者的畫面（包含剛匯入的資料）被蓋掉。真的要廣播的
		// 地方（明確的使用者動作）改成呼叫端自己 push，見 handleImport()。
	}

	function loadSchema(
		source: string,
		fileName: string,
		viewState?: typeof DEFAULT_VIEW_STATE,
		resetZoomTo100 = false
	): void {
		applyLoadedSchema(loadSchemaFromText(source, fileName), source, fileName, viewState, resetZoomTo100);
	}

	/**
	 * 收到協作對象傳來的 schema（已經是表格級同步組回來的完整 Schema，不是字串，
	 * 見 $lib/collab/schemaCollab.ts）：直接套用，不用再 parse。一般分頁被外部修改
	 * （checkExternalChanges）時也走這裡，理由一樣：不要重置使用者的鏡頭。故意不走 loadSchema()／
	 * applyLoadedSchema() 那條路——那條路是給「載入一份新分頁」用的，會重置 viewState
	 * 跟自動 fitView，對方每動一次你的畫面就會跳走、縮放被重置。這裡跟 commitSchema 的
	 * refit:false 分支一樣，只用 renderer.updateSchema() 換資料重繪，鏡頭留在原地。
	 */
	function applyRemoteCollabSchema(next: Schema): void {
		schema = next;
		clearHistory();
		diagnostics = validateSchema(next, { file: currentFileName });
		lintWarnings = lintSchema(next);
		currentSource = toDsl(next);
		renderer?.updateSchema(next);
		metricsText = t.metrics(next.tables.length, next.relations.length, 0);
		syncToolbarState();
		saveLocalDraft(currentFileName, currentSource);
		saveToCloud();
	}

	/**
	 * Shared landing spot for every table/column edit. `refit: true` (table
	 * count actually changed) uses renderer.setSchema, which re-fits the
	 * view; `refit: false` (renaming/tweaking a column on an existing table)
	 * uses the lighter updateSchema so the camera doesn't jump around while
	 * someone is mid-edit.
	 *
	 * `record: false` is for undo/redo themselves, which manage the stacks.
	 */
	function commitSchema(next: Schema, options: { refit?: boolean; record?: boolean } = {}): void {
		if (diffMode) return;
		const nextSource = toDsl(next);
		// 失焦時就算沒改字也會送一次修改，內容沒變就不記，免得要按好幾次 Ctrl+Z 才退得動。
		if ((options.record ?? true) && schema && nextSource !== currentSource) {
			undoStack.push($state.snapshot(schema) as Schema);
			if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
			redoStack = [];
		}
		schema = next;
		diagnostics = validateSchema(next, { file: currentFileName });
		lintWarnings = lintSchema(next);
		currentSource = nextSource;
		if (!renderer) return;
		if (options.refit) renderer.setSchema(next);
		else renderer.updateSchema(next);
		metricsText = t.metrics(next.tables.length, next.relations.length, 0);
		syncToolbarState();
		saveLocalDraft(currentFileName, currentSource);
		saveToCloud();
		collab?.pushLocalSchema(next);
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

	/** Delete 鍵：有多選刪多選，沒有就刪目前點選（聚焦）的那張。不跳確認，靠提示上的「復原」反悔。 */
	function handleDeleteSelected(): void {
		const ids = shortcutTargets();
		if (!schema || diffMode || ids.length === 0) return;
		const label = ids.length === 1 ? (schema.tables.find((t) => t.id === ids[0])?.name ?? ids[0]) : null;
		const deletingFocused = !!focusedTableId && ids.includes(focusedTableId);
		const next = ids.reduce((acc, id) => mutate.deleteTable(acc, id), schema);
		if (deletingFocused) resetFocus();
		commitSchema(next, { refit: true });
		clearSelection();
		showToast(label ? m.deletedOne(label) : m.deletedMany(ids.length), 5000, { label: m.undo, run: undo });
	}

	/** 復原／重做共用：換成另一份快照，表數有變才重新 fit，選取裡已經不存在的表一併拿掉。 */
	function restoreSnapshot(target: Schema): void {
		if (!schema) return;
		commitSchema(target, { refit: target.tables.length !== schema.tables.length, record: false });
		const ids = new Set(target.tables.map((t) => t.id));
		const kept = [...selectedTables].filter((id) => ids.has(id));
		if (kept.length !== selectedTables.size) {
			selectedTables = new Set(kept);
			syncSelectionHighlight();
		}
	}

	function undo(): void {
		if (diffMode || !schema) return;
		const previous = undoStack.pop();
		if (!previous) {
			showToast(m.nothingToUndo, 1500);
			return;
		}
		redoStack.push($state.snapshot(schema) as Schema);
		restoreSnapshot(previous);
		showToast(m.undone, 1500);
	}

	function redo(): void {
		if (diffMode || !schema) return;
		const next = redoStack.pop();
		if (!next) {
			showToast(m.nothingToRedo, 1500);
			return;
		}
		undoStack.push($state.snapshot(schema) as Schema);
		restoreSnapshot(next);
		showToast(m.redone, 1500);
	}

	/** Ctrl+A：選取畫面上看得到的所有表（被「主題區域」藏起來的群組不算）。 */
	function selectAllTables(): void {
		if (!canvasHost) return;
		const ids = [...canvasHost.querySelectorAll<HTMLElement>('.dbs-card')]
			.filter((card) => card.getClientRects().length > 0)
			.map((card) => card.dataset.tableId)
			.filter((id): id is TableId => !!id);
		if (ids.length === 0) return;
		selectedTables = new Set(ids);
		syncSelectionHighlight();
		showToast(m.selectedAll(ids.length), 1500);
	}

	/** 快捷鍵要作用的表：有多選就用多選，沒有就用目前聚焦的那張。 */
	function shortcutTargets(): TableId[] {
		if (selectedTables.size > 0) return [...selectedTables];
		return focusedTableId ? [focusedTableId] : [];
	}

	function duplicateTargets(): void {
		const ids = shortcutTargets();
		if (!schema || ids.length === 0) return;
		commitSchema(
			ids.reduce((acc, id) => mutate.duplicateTable(acc, id), schema),
			{ refit: true }
		);
		showToast(m.duplicated(ids.length), 2000);
	}

	async function copyTargetsAsText(): Promise<void> {
		const ids = shortcutTargets();
		if (!schema || ids.length === 0) return;
		await copyTablesAsText(schema, ids);
		showToast(m.copiedDefinitions(ids.length), 2000);
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
		canvasReady = true;
		// 手機用手指拖就是要平移；框選（選取模式）在觸控上用不到。
		if (window.matchMedia('(max-width: 767px)').matches) interactionMode = 'move';
		syncBottomInset();
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

	/**
	 * Logged-in users skip the localStorage draft entirely. If the URL has a
	 * `?page=<id>` (邀請連結導過來的協作者，或直接分享的網址), open that one first;
	 * 打不開（沒權限/不存在）就退回原本的行為：最近編輯過的雲端分頁。
	 */
	async function initCloudPages(): Promise<void> {
		await fetchPages();
		const requestedPageId = page.url.searchParams.get('page');
		if (requestedPageId && (await handleSelectPage(requestedPageId))) return;
		if (pages.length > 0) {
			await handleSelectPage(pages[0].id);
		} else {
			loadSchema(EMPTY_SCHEMA_DSL, EMPTY_SCHEMA_FILENAME);
		}
	}

	async function handleSelectPage(pageId: string): Promise<boolean> {
		if (pageId === activePageId) return true;
		const res = await fetch(`/api/pages/${pageId}`);
		if (!res.ok) return false;
		const pageRow = await res.json();
		activePageId = pageId;
		activePageMode = pageRow.mode === 'realtime' ? 'realtime' : 'normal';
		activePageIsOwner = session?.user?.id === pageRow.userId;
		lastCloudSource = pageRow.source;
		loadSchema(pageRow.source, pageRow.fileName);
		return true;
	}

	async function handleCreatePage(mode: 'normal' | 'realtime' = 'normal'): Promise<void> {
		if (!session?.user) {
			showLoginPrompt = true;
			return;
		}
		// 還沒有任何分頁在編輯時（訪客剛匯入/編輯過東西、或剛登入還沒選過分頁），
		// 「新增分頁」實際上是要把手上這份內容存成第一個分頁，不能生一份空白的把它蓋掉。
		// 已經有分頁在編輯、要另外加一個新的才真的給空白（伺服器端沒收到 body 就是空白）。
		const body = activePageId
			? JSON.stringify({ mode })
			: JSON.stringify({ source: currentSource, fileName: currentFileName, mode });
		const res = await fetch('/api/pages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		});
		if (!res.ok) {
			showToast(m.createPageFailed(`${res.status} ${await res.text()}`), 6000);
			return;
		}
		const pageRow = await res.json();
		pages = [{ id: pageRow.id, title: pageRow.title, updatedAt: pageRow.updatedAt, mode: pageRow.mode }, ...pages];
		activePageId = pageRow.id;
		activePageMode = pageRow.mode === 'realtime' ? 'realtime' : 'normal';
		activePageIsOwner = true;
		lastCloudSource = pageRow.source;
		// 跟匯入一樣：不管是全新空白分頁，還是帶著訪客登入前內容建立的分頁，一律 100% 起始，
		// 不自動縮放塞畫面。
		loadSchema(pageRow.source, pageRow.fileName, undefined, true);
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
			activePageMode = 'normal';
			activePageIsOwner = true;
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

	function openCreatePageMenu(event: MouseEvent): void {
		createPageMenu = { x: event.clientX, y: event.clientY };
	}

	function createPageMenuItems(): ContextMenuItem[] {
		return [
			{ label: m.newPage, onSelect: () => void handleCreatePage('normal') },
			{ label: m.newRealtimePage, onSelect: () => void handleCreatePage('realtime') }
		];
	}

	/** 擁有者按「邀請協作者」：產生（或重新產生）邀請連結的 token，組成完整網址給複製。 */
	async function handleGenerateInviteLink(): Promise<void> {
		if (!activePageId) return;
		inviteLoading = true;
		try {
			const res = await fetch(`/api/pages/${activePageId}/invite`, { method: 'POST' });
			if (!res.ok) {
				showToast(m.inviteFailed(`${res.status} ${await res.text()}`), 6000);
				return;
			}
			const { token } = await res.json();
			inviteLink = `${window.location.origin}/join/${token}`;
		} finally {
			inviteLoading = false;
		}
	}

	async function copyInviteLink(): Promise<void> {
		if (!inviteLink) return;
		try {
			await navigator.clipboard.writeText(inviteLink);
			showToast(m.inviteCopied);
		} catch {
			showToast(m.clipboardBlocked);
		}
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
			items.push({ label: m.newTable, onSelect: handleCreateTable });
		}

		// 編輯/建立副本/刪除只在單一表格（非多選）時有意義。
		if (tableId && !isMulti) {
			items.push(
				{
					label: m.edit,
					onSelect: () => handleFocusTable(tableId)
				},
				{
					label: m.duplicate,
					onSelect: () => handleDuplicateTable(tableId)
				},
				{
					label: m.delete,
					onSelect: () => requestDeleteTable(tableId)
				}
			);
		}

		items.push(
			{
				label: m.copyPng(isMulti ? effectiveIds.length : null),
				onSelect: async () => {
					if (!canvasHost || !schema) return;
					try {
						const selection = isMulti ? { schema, tableIds: new Set(effectiveIds) } : undefined;
						await copyDiagramAsPng(canvasHost, selection);
						showToast(m.copiedPng);
					} catch {
						showToast(m.clipboardBlocked);
					}
				}
			},
			{
				label: m.copySvg(isMulti ? effectiveIds.length : null),
				onSelect: async () => {
					if (!canvasHost || !schema) return;
					try {
						const selection = isMulti ? { schema, tableIds: new Set(effectiveIds) } : undefined;
						const result = await copyDiagramAsSvg(canvasHost, selection);
						showToast(
							result === 'image' ? m.copiedSvg : m.copiedSvgText
						);
					} catch {
						showToast(m.clipboardBlocked);
					}
				}
			},
			{
				label: m.copyText(isMulti ? effectiveIds.length : null),
				onSelect: async () => {
					if (!schema) return;
					try {
						if (effectiveIds.length > 1) await copyTablesAsText(schema, effectiveIds);
						else if (effectiveIds.length === 1) await copyTableAsText(schema, effectiveIds[0]);
						else await copySchemaAsText(schema);
						showToast(m.copiedText);
					} catch {
						showToast(m.clipboardBlocked);
					}
				}
			}
		);
		return items;
	}

	/**
	 * 匯入：畫布上已經有表時，對話框會讓使用者選「取代」或「合併」；不管哪種，匯入前都先記下
	 * 原本的內容，提示上給一顆「復原」——之前匯入會直接蓋掉整份 schema，訪客的資料只在瀏覽器裡，
	 * 蓋掉就沒了。
	 */
	async function handleImport(
		source: string,
		fileName: string,
		sqlDialect?: SqlDialectId,
		strategy: 'replace' | 'merge' = 'replace'
	): Promise<void> {
		showImportDialog = false;
		const before = schema && schema.tables.length > 0 ? { source: currentSource, fileName: currentFileName } : null;
		// 匯入是使用者明確的動作，才值得廣播給協作對象——跟 applyLoadedSchema 內部其他
		// 「載入我自己原本狀態」的呼叫點不同，所以這裡呼叫端自己 push，不是共用函式無條件 push。
		let result = sqlDialect ? await loadSchemaFromSql(source, fileName, sqlDialect) : loadSchemaFromText(source, fileName);
		if (strategy === 'merge' && schema && result.schema.tables.length > 0) {
			const merged = mutate.mergeSchemas(schema, result.schema);
			result = { schema: merged, diagnostics: [...result.diagnostics, ...validateSchema(merged, { file: fileName })] };
			fileName = currentFileName;
		}
		const previous = schema && schema.tables.length > 0 ? ($state.snapshot(schema) as Schema) : null;
		applyLoadedSchema(result, source, fileName, undefined, strategy === 'replace');
		// applyLoadedSchema 會清空歷史；匯入是使用者的動作，留一步讓 Ctrl+Z 退回匯入前。
		if (previous) undoStack = [previous];
		if (schema) collab?.pushLocalSchema(schema);
		announceImport(strategy, before);
	}

	function undoImport(before: { source: string; fileName: string }): void {
		loadSchema(before.source, before.fileName);
		if (schema) collab?.pushLocalSchema(schema);
		showToast(m.importUndone);
	}

	/** 匯入完明確說結果：幾張表、幾條關聯；解析不到任何東西時直接講，不要只留一張空畫布。 */
	function announceImport(
		strategy: 'replace' | 'merge' = 'replace',
		before: { source: string; fileName: string } | null = null
	): void {
		if (!schema) return;
		const problems = diagnostics.length;
		const undo = before ? { label: m.undo, run: () => undoImport(before) } : null;
		if (schema.tables.length === 0) {
			showToast(
				m.importedNothing(problems > 0 ? diagnostics[0].message : null),
				6000
			);
			return;
		}
		// 只算真的畫得出來的關聯：指到不存在的表的那幾條會列在問題清單，不該算進「已匯入」。
		const tableIds = new Set(schema.tables.map((t) => t.id));
		const drawn = schema.relations.filter((r) => tableIds.has(r.sourceTable) && tableIds.has(r.targetTable)).length;
		const base = m.imported(strategy === 'merge', schema.tables.length, drawn);
		showToast(
			problems > 0 ? m.importedProblems(base, problems) : m.importedOk(base),
			undo ? 9000 : 4500,
			undo
		);
	}

	function handleLoadSample(): void {
		loadSchema(locale === 'en' ? SAMPLE_SCHEMA_DSL_EN : SAMPLE_SCHEMA_DSL, SAMPLE_SCHEMA_FILENAME);
		if (schema) collab?.pushLocalSchema(schema);
		showToast(m.sampleLoaded, 5000);
	}

	function handleStartBlank(): void {
		if (!schema) return;
		commitSchema(mutate.createTable(schema), { refit: true });
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
			const detail = result.diagnostics[0]?.message ?? m.compareNothing;
			showToast(m.compareFailed(detail), 6000);
			return;
		}
		if (result.diagnostics.length > 0) {
			showToast(m.compareProblems(result.diagnostics.length, result.diagnostics[0].message), 6000);
		}
		enterDiffMode(result.schema, fileName);
	}

	/**
	 * `next`/`nextLabel` 預設是目前正在編輯的即時內容——原本「比較」功能唯一支援的用法。
	 * 版本歷史的「跟基準比較」會明確帶兩份都是過去快照的 Schema 進來，這時候兩邊都不是
	 * 「目前」，退出時一樣換回 `schema`（活的可編輯狀態），跟原本行為一致。
	 */
	function enterDiffMode(compared: Schema, sourceLabel: string, next: Schema | null = null, nextLabel = m.current): void {
		if (!schema || !renderer) return;
		const target = next ?? schema;
		resetFocus();
		const diff = diffSchemas(compared, target);
		const merged = buildMergedSchema(compared, target);
		renderer.setSchema(merged);
		diffMode = { diff, sourceLabel, nextLabel };
		if (canvasHost) applyDiffOverlay(canvasHost, diff);

		// table id（schema.表名）幾乎沒有重疊時，很可能是使用者拿了兩份不相干的 schema
		// 來比較，不是同一份 schema 的兩個版本——這種情況下 diff 只會顯示「整表新增/刪除」，
		// 看不出欄位層級的差異，所以提醒一下而不是默默顯示一個可能誤導的結果。
		const totalTables = compared.tables.length + target.tables.length;
		if (compared !== target && totalTables >= 3 && tableOverlapRatio(compared, target) < 0.2) {
			showToast(m.unrelatedSchemas, 6000);
		}
	}

	function exitDiffMode(): void {
		if (!schema || !renderer || !diffMode) return;
		if (canvasHost) clearDiffOverlay(canvasHost);
		renderer.setSchema(schema);
		diffMode = null;
		syncToolbarState();
	}

	async function openVersionHistory(): Promise<void> {
		if (!activePageId) return;
		showVersionHistory = true;
		const res = await fetch(`/api/pages/${activePageId}/versions`);
		versions = res.ok ? await res.json() : [];
	}

	async function handleSaveVersion(label: string): Promise<void> {
		if (!activePageId) return;
		const res = await fetch(`/api/pages/${activePageId}/versions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ label, source: currentSource, fileName: currentFileName })
		});
		if (!res.ok) {
			showToast(m.saveVersionFailed(`${res.status} ${await res.text()}`), 6000);
			return;
		}
		versions = [await res.json(), ...versions];
	}

	/** 跟現有的「比較」功能共用同一套 enterDiffMode——差別只在來源是資料庫存的舊版本，不是使用者貼上的文字。 */
	/**
	 * baseVersionId 有帶時（版本歷史面板裡「選為基準」後再點另一筆），比較的是兩份都是過去
	 * 快照的版本，不牽涉目前正在編輯的即時內容；沒帶時維持原本「這筆 vs 目前」的行為。
	 */
	async function handleDiffVersion(versionId: string, baseVersionId?: string): Promise<void> {
		if (!activePageId) return;
		const res = await fetch(`/api/pages/${activePageId}/versions/${versionId}`);
		if (!res.ok) return;
		const version = await res.json();
		const versionSchema = loadSchemaFromText(version.source, version.fileName).schema;

		if (baseVersionId) {
			const baseRes = await fetch(`/api/pages/${activePageId}/versions/${baseVersionId}`);
			if (!baseRes.ok) return;
			const base = await baseRes.json();
			showVersionHistory = false;
			enterDiffMode(loadSchemaFromText(base.source, base.fileName).schema, base.label, versionSchema, version.label);
			return;
		}
		showVersionHistory = false;
		enterDiffMode(versionSchema, version.label);
	}

	/**
	 * 單純打開看某一筆版本當時長怎樣，不是要比較差異——重用 enterDiffMode 的唯讀/退出機制，
	 * 拿同一份 Schema 自己跟自己比較（diff 一定是空的，不會有新增/刪除/改動的顏色），
	 * banner 那邊改判斷 sourceLabel === nextLabel 顯示「正在檢視」而不是「vs」。
	 */
	async function handleViewVersion(versionId: string): Promise<void> {
		if (!activePageId) return;
		const res = await fetch(`/api/pages/${activePageId}/versions/${versionId}`);
		if (!res.ok) return;
		const version = await res.json();
		const versionSchema = loadSchemaFromText(version.source, version.fileName).schema;
		showVersionHistory = false;
		enterDiffMode(versionSchema, version.label, versionSchema, version.label);
	}

	async function handleDeleteVersion(versionId: string): Promise<void> {
		if (!activePageId) return;
		versions = versions.filter((v) => v.id !== versionId);
		try {
			await fetch(`/api/pages/${activePageId}/versions/${versionId}`, { method: 'DELETE' });
		} catch {
			// best-effort — 本機列表已經反映刪除了，下次重新整理會跟資料庫同步
		}
	}

	function handleExportJson(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.(dbschema|schema\.md)$/i, '') + '.schema.json', toJson(schema), 'application/json');
	}

	function handleExportDsl(): void {
		if (!schema) return;
		downloadFile(currentFileName.replace(/\.(dbschema|schema\.(json|md))$/i, '') + '.dbschema', toDsl(schema), 'text/plain');
	}

	async function handleExportSql(dialectId: import('@schemalens/schema-sql').SqlDialectId): Promise<void> {
		if (!schema) return;
		const { renderSchemaAsSql } = await import('@schemalens/schema-sql/export');
		const base = currentFileName.replace(/\.(dbschema|schema\.(json|md))$/i, '');
		downloadFile(`${base}.${dialectId}.sql`, renderSchemaAsSql(schema, dialectId), 'text/plain');
	}

	/**
	 * 手機寬度時檢視面板從畫布底部浮上來（約 42% 高 + 底部工具列），聚焦時要把表置中在面板上方，
	 * 不然點了一張表，它剛好被面板蓋住。桌面版面板在側欄裡，不用扣。
	 */
	function syncBottomInset(): void {
		if (!renderer) return;
		const narrow = window.matchMedia('(max-width: 767px)').matches;
		renderer.setBottomInset(narrow ? Math.round(window.innerHeight * 0.42) + 88 : 0);
	}

	/**
	 * 切換介面語言要整頁重新載入（renderer 的文字是建立時給的）。編輯內容每次改動都已經存了，
	 * 這裡只是把還在 400ms 防抖裡的畫面狀態（縮放、聚焦）先寫進草稿，回來時還在原位。
	 */
	function handleToggleLanguage(target: Locale): void {
		clearTimeout(draftSaveTimer);
		if (currentSource) saveLocalDraft(currentFileName, currentSource);
		window.location.assign(`/app?lang=${target}`);
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
		aiSettings = loadAiSettings();

		const handleExternalCheck = () => void checkExternalChanges();
		window.addEventListener('focus', handleExternalCheck);
		document.addEventListener('visibilitychange', handleExternalCheck);
		const externalCheckTimer = setInterval(handleExternalCheck, 10_000);

		const isTyping = (target: EventTarget | null) => {
			const el = target as HTMLElement | null;
			const tag = el?.tagName;
			return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
		};

		const handleKeydown = (event: KeyboardEvent) => {
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			// 輸入框裡的 Ctrl+Z／Ctrl+A／Ctrl+C 留給瀏覽器原本的文字編輯行為。
			const canvasShortcut = !isTyping(event.target) && !overlayOpen && !event.altKey;
			if (canvasShortcut && mod && key === 'z') {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}
			if (canvasShortcut && mod && key === 'y') {
				event.preventDefault();
				redo();
				return;
			}
			if (canvasShortcut && mod && key === 'a' && hasTables && !diffMode) {
				event.preventDefault();
				selectAllTables();
				return;
			}
			if (canvasShortcut && mod && key === 'd' && !diffMode && shortcutTargets().length > 0) {
				event.preventDefault();
				duplicateTargets();
				return;
			}
			// 有選取網頁文字時讓瀏覽器照常複製文字。
			if (canvasShortcut && mod && key === 'c' && !window.getSelection()?.toString() && shortcutTargets().length > 0) {
				event.preventDefault();
				void copyTargetsAsText();
				return;
			}
			if (canvasShortcut && !mod && hasTables) {
				if (event.key === '+' || event.key === '=') {
					renderer?.zoomBy(1.2);
					return;
				}
				if (event.key === '-' || event.key === '_') {
					renderer?.zoomBy(1 / 1.2);
					return;
				}
				if (event.shiftKey && event.code === 'Digit1') {
					renderer?.fitView();
					return;
				}
			}
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
				toolbarRef?.focusSearch();
			} else if ((event.key === 'Delete' || event.key === 'Backspace') && shortcutTargets().length > 0) {
				if (isTyping(event.target) || overlayOpen) return;
				event.preventDefault();
				handleDeleteSelected();
			}
		};
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('resize', syncBottomInset);
		return () => {
			window.removeEventListener('resize', syncBottomInset);
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('focus', handleExternalCheck);
			document.removeEventListener('visibilitychange', handleExternalCheck);
			clearInterval(externalCheckTimer);
		};
	});

	/**
	 * 即時協作 session 的生命週期：目前分頁是即時協作模式時，房間固定用 pageId，
	 * 自動連上本機 dev relay server(見 apps/web/scripts/yjs-dev-server.mjs)；
	 * 切到別的分頁、或分頁本身不是即時協作模式，Svelte 會先跑這次回傳的 cleanup
	 * 把舊 session 關掉，再視新的 activePageId/activePageMode 決定要不要開新的。
	 */
	$effect(() => {
		if (activePageMode !== 'realtime' || !activePageId) {
			collabRoom = null;
			return;
		}
		const room = activePageId;
		const session = createSchemaCollab(room, applyRemoteCollabSchema);
		collab = session;
		collabRoom = room;
		// 補位：房間如果是空的（relay server 剛重啟過、或自己是第一個進來的人），
		// 把當下已經載入的內容推上去，不用等到下一次編輯才有東西可以同步。新設計下
		// 就算兩人幾乎同時都做這個補位、寫的內容一樣，per-key 覆蓋沒有交錯風險。
		if (schema) session.pushLocalSchema(schema);
		return () => {
			session.destroy();
			if (collab === session) collab = null;
		};
	});
</script>

<svelte:head>
	<title>{m.pageTitle}</title>
</svelte:head>

<a
	href="#sl-canvas"
	class="sl-skip-link"
	onclick={(event) => {
		event.preventDefault();
		canvasHost?.querySelector<HTMLElement>('.dbs-card')?.focus();
	}}
>
	{m.skipToCanvas}
</a>
<div class="sr-only" role="status" aria-live="polite">{liveMessage}</div>
<div class="relative flex h-dvh overflow-hidden bg-bg text-fg">
	<AppSidebar
		bind:this={appSidebarRef}
		{schema}
		{session}
		{pages}
		{activePageId}
		{focusedTableId}
		{hiddenGroups}
		onSelectPage={handleSelectPage}
		onCreatePage={openCreatePageMenu}
		onSaveToCloud={() => (showLoginPrompt = true)}
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

	<div class="flex min-w-0 flex-1 flex-col">
		{#if hasTables}
			<Toolbar
				bind:this={toolbarRef}
				{schema}
				display={viewMode === 'compact' ? 'compact' : active.detailLevel}
				expandComments={active.expandComments}
				groupFilter={active.groupFilter}
				{columnFocusLabel}
				selectedCount={selectedTables.size}
				{layoutDirty}
				{metricsText}
				hasFocus={!!focusedTableId}
				onDisplay={handleDisplay}
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
				onResetLayout={() => {
					renderer?.resetLayout();
					layoutDirty = false;
				}}
				onPickHit={handlePickHit}
				onSearchResults={handleSearchResults}
			/>
		{/if}

		<div id="sl-canvas" class="relative flex-1">
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
				onOpenSource={(target) => {
					viewSourceTable = schema?.tables.find((t) => t.id === target.tableId)?.name ?? null;
					showViewSourceDialog = true;
				}}
				onDiagnosticSelected={() => {}}
				onViewportChanged={(scale) => (scalePercent = Math.round(scale * 100))}
				onCardToggleSelect={toggleTableSelection}
				onPlainClick={clearSelection}
				onMarqueeSelect={(ids, additive) => {
					selectedTables = additive ? new Set([...selectedTables, ...ids]) : new Set(ids);
					syncSelectionHighlight();
				}}
			/>

			{#if focusedTableId && schema && !diffMode && viewMode === 'full'}
				<FocusBar
					tableName={schema.tables.find((t) => t.id === focusedTableId)?.name ?? focusedTableId}
					depth={active.depth}
					direction={active.direction}
					unrelated={active.unrelated}
					onDepth={(depth) => {
						if (!renderer) return;
						renderer.setViewState({ focus: { ...renderer.getViewState().focus, depth } });
						syncToolbarState();
					}}
					onDirection={(direction) => {
						if (!renderer) return;
						renderer.setViewState({ focus: { ...renderer.getViewState().focus, direction } });
						syncToolbarState();
					}}
					onUnrelated={(mode) => {
						renderer?.setViewState({ unrelated: mode });
						syncToolbarState();
					}}
					onReset={resetFocus}
				/>
			{/if}

			{#if canvasReady && schema && !hasTables && !diffMode}
				<EmptyCanvas
					onLoadSample={handleLoadSample}
					onImport={() => (showImportDialog = true)}
					onStartBlank={handleStartBlank}
				/>
			{/if}

			{#if collabRoom}
				<div class="absolute top-3 left-3 z-10 flex items-center gap-2 text-xs">
					<div class="flex items-center gap-1.5 rounded-full border border-cyan/40 bg-surface/90 px-3 py-1 text-cyan shadow">
						{m.live}
					</div>
					{#if activePageIsOwner}
						<button
							class="rounded-full border border-border bg-surface/90 px-3 py-1 text-muted shadow hover:border-cyan hover:text-cyan disabled:opacity-60"
							onclick={() => {
								inviteLink = null;
								void handleGenerateInviteLink();
							}}
							disabled={inviteLoading}
						>
							{inviteLoading ? m.inviting : m.invite}
						</button>
					{/if}
				</div>
				{#if inviteLink}
					<div
						class="absolute top-12 left-3 z-10 flex items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs shadow-2xl"
					>
						<span class="max-w-64 truncate font-mono text-muted">{inviteLink}</span>
						<button class="text-cyan hover:opacity-80" onclick={copyInviteLink}>{m.copy}</button>
						<button class="text-muted hover:text-fg" onclick={() => (inviteLink = null)}>×</button>
					</div>
				{/if}
			{/if}

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
					{#if diffMode.sourceLabel === diffMode.nextLabel}
						{m.viewingVersion(diffMode.sourceLabel)}
					{:else}
						{m.comparingVersions(diffMode.sourceLabel, diffMode.nextLabel)}
						<span class="text-muted">
							+{diffMode.diff.addedTables.length} / -{diffMode.diff.removedTables.length} / ~{diffMode.diff.changedTables.length}
						</span>
					{/if}
					<button class="ml-1 rounded-full bg-cyan px-2 py-0.5 text-bg" onclick={exitDiffMode}>
						{diffMode.sourceLabel === diffMode.nextLabel ? m.backToEdit : m.endCompare}
					</button>
				</div>
			{/if}

			<BottomBar
				{scalePercent}
				mode={interactionMode}
				{theme}
				onZoomIn={() => renderer?.zoomBy(1.2)}
				onZoomOut={() => renderer?.zoomBy(1 / 1.2)}
				onZoomReset={() => renderer?.fitView()}
				onModeChange={handleModeChange}
				onImportClick={() => (showImportDialog = true)}
				onExportClick={() => (showExportDialog = true)}
				onViewSourceClick={() => (showViewSourceDialog = true)}
				onToggleTheme={handleToggleTheme}
				onCompare={() => (showCompareDialog = true)}
				compareDisabled={!!diffMode || !hasTables}
				onHistory={openVersionHistory}
				historyDisabled={!activePageId}
				onAiClick={() => (showAiSettings = true)}
				aiConfigured={!!aiSettings}
				signedIn={!!session?.user}
				onToggleLanguage={handleToggleLanguage}
			/>

			{#if toast}
				<div
					class="absolute right-3 bottom-20 left-3 z-30 ml-auto max-w-sm rounded-xl border border-cyan/50 bg-surface px-3 py-2.5 text-xs whitespace-pre-wrap text-fg shadow-[0_14px_30px_-16px_rgb(0_0_0/0.6)] sm:left-auto"
					role="status"
					aria-live="polite"
				>
					<div class="flex items-start gap-3">
						<span class="min-w-0 flex-1">{toast}</span>
						{#if toastAction}
							<button
								class="sl-button sl-button-secondary sl-button-sm -my-1"
								onclick={() => {
									const action = toastAction;
									toast = null;
									toastAction = null;
									action?.run();
								}}
							>
								{toastAction.label}
							</button>
						{/if}
					</div>
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

{#if createPageMenu}
	<ContextMenu
		x={createPageMenu.x}
		y={createPageMenu.y}
		items={createPageMenuItems()}
		onClose={() => (createPageMenu = null)}
	/>
{/if}

{#if showImportDialog}
	<ImportDialog
		existingTableCount={diffMode ? 0 : (schema?.tables.length ?? 0)}
		onClose={() => (showImportDialog = false)}
		onImport={handleImport}
	/>
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
	<ViewSourceDialog
		source={toDsl(schema)}
		focusTable={viewSourceTable}
		onClose={() => {
			showViewSourceDialog = false;
			viewSourceTable = null;
		}}
	/>
{/if}

{#if showAiSettings}
	<AiSettingsDialog
		current={aiSettings}
		signedIn={!!session?.user}
		onSave={(next) => {
			saveAiSettings(next);
			aiSettings = next;
			showAiSettings = false;
			showToast(m.aiSaved);
		}}
		onClear={() => {
			clearAiSettings();
			aiSettings = null;
			showAiSettings = false;
		}}
		onClose={() => (showAiSettings = false)}
	/>
{/if}

{#if showCompareDialog}
	<ImportDialog mode="compare" onClose={() => (showCompareDialog = false)} onImport={handleCompareImport} />
{/if}

{#if showVersionHistory}
	<VersionHistoryDialog
		{versions}
		onSaveVersion={handleSaveVersion}
		onViewVersion={handleViewVersion}
		onDiffVersion={handleDiffVersion}
		onDeleteVersion={handleDeleteVersion}
		onClose={() => (showVersionHistory = false)}
	/>
{/if}

{#if deleteConfirm && schema}
	<ConfirmDeleteDialog
		title={m.confirmDeleteTable(schema.tables.find((t) => t.id === deleteConfirm?.tableId)?.name ?? '')}
		relations={mutate.relationsTouching(schema, deleteConfirm.tableId)}
		onConfirm={confirmDeleteTable}
		onCancel={cancelDeleteTable}
	/>
{/if}

{#if showLoginPrompt}
	<LoginPromptDialog onConfirm={confirmLoginPrompt} onCancel={cancelLoginPrompt} />
{/if}
