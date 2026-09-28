import type { Schema } from "@schemalens/schema-core";
import { buildMergedSchema, diffSchemas } from "@schemalens/schema-diff";
import { layeredLayout } from "@schemalens/schema-layout";
import type { SearchHit, TraversalDirection } from "@schemalens/schema-graph";
import {
  DEFAULT_LOCALE,
  DEFAULT_VIEW_STATE,
  SchemaRenderer,
  applyDiffOverlay,
  clearCompactOverlay,
  createCompactLayoutEngine,
  syncCompactOverlay,
  highlightChanges,
  stringsFor,
  type DetailLevel,
  type LayoutMode,
  type Locale,
  type UnrelatedMode,
} from "@schemalens/schema-renderer";
import { toPng, toSvg } from "html-to-image";
import type { ExtensionToWebview, ImageFormat, WebviewToExtension } from "../preview/protocol.js";
import { TOOLBAR_CSS, Toolbar, type ToolbarHandlers, type ViewMode } from "./toolbar.js";
import { DETAIL_PANEL_CSS, renderDetailPanel } from "./detailPanel.js";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const post = (message: WebviewToExtension): void => vscode.postMessage(message);

const app = document.getElementById("app")!;

const style = document.createElement("style");
style.textContent = TOOLBAR_CSS + DETAIL_PANEL_CSS;
document.head.append(style);

const canvas = document.createElement("div");
canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.top = "38px";

let schema: Schema | null = null;
/** 畫布上實際畫的那份（比較模式時是合成的 schema），精簡模式的排版跟分區外框都依它。 */
let renderedSchema: Schema | null = null;
let viewMode: ViewMode = "full";
let detailLevelBeforeCompact: DetailLevel | null = null;
const compactLayoutEngine = createCompactLayoutEngine(() => renderedSchema);
let locale: Locale = DEFAULT_LOCALE;
let lastMetrics: { tables: number; relations: number; ms: number } | null = null;

const renderer = new SchemaRenderer(canvas, {
  locale,
  events: {
    openSource: (target) => post({ type: "openSource", tableId: target.tableId, column: target.column }),
    tableSelected: () => syncToolbar(),
    columnSelected: (target) => {
      toolbar.setColumnFocus(target ? `${target.tableId}.${target.column}` : null);
    },
    viewStateChanged: () => syncToolbar(),
    layoutChanged: () => toolbar.setLayoutDirty(true),
  },
});
// 插件沒有網頁版的多選/框選功能，select/move 模式的切換鈕也沒有對應 UI——
// 固定用 move 模式，拖曳背景永遠平移，維持合併前「畫布本來就能拖」的行為。
renderer.setInteractionMode("move");

const handlers: ToolbarHandlers = {
  onDetailLevel: (level: DetailLevel) => {
    if (viewMode === "compact") setViewMode("full");
    renderer.setViewState({ detailLevel: level });
    syncToolbar();
  },
  onDepth: (depth: number | null) => {
    renderer.setViewState({ focus: { ...renderer.getViewState().focus, depth } });
    syncToolbar();
  },
  onDirection: (direction: TraversalDirection) => {
    renderer.setViewState({ focus: { ...renderer.getViewState().focus, direction } });
    syncToolbar();
  },
  onUnrelated: (mode: UnrelatedMode) => {
    renderer.setViewState({ unrelated: mode });
    syncToolbar();
  },
  onComments: (expanded: boolean) => {
    renderer.setViewState({ expandComments: expanded });
    syncToolbar();
  },
  onLayoutMode: (mode: LayoutMode) => {
    renderer.setViewState({ layoutMode: mode });
    // 換排版會清掉手動拖曳的位置，「還原版面」也就沒有東西可還原了。
    toolbar.setLayoutDirty(false);
    syncToolbar();
  },
  onGroupFilter: (group: string | null) => {
    renderer.setViewState({ groupFilter: group });
    syncToolbar();
  },
  onClearColumnFocus: () => {
    renderer.clearColumnFocus();
    toolbar.setColumnFocus(null);
  },
  onResetFocus: () => {
    resetFocus();
  },
  onFitView: () => renderer.fitView(),
  onExport: () => post({ type: "requestExport" }),
  onCompare: () => post({ type: "requestCompare" }),
  onViewMode: (mode: ViewMode) => setViewMode(mode),
  onResetLayout: () => {
    renderer.resetLayout();
    toolbar.setLayoutDirty(false);
  },
  onPickHit: (hit: SearchHit) => {
    // US3 / US6：Table 命中 → Jump + Focus；Column 命中 → 額外高亮該欄位。
    if (hit.kind === "column") renderer.revealColumn(hit.tableId, hit.column);
    else renderer.focusTable(hit.tableId);
    syncToolbar();
  },
  onSearchResults: (hits: SearchHit[]) => {
    renderer.setSearchMatches([...new Set(hits.map((hit) => hit.tableId))]);
  },
  onLocale: (next: Locale) => {
    // 先在本地套用，UI 立刻有反應。
    // 若只等 Extension 寫設定再推回來，鏈上任何一環失敗（或 Extension Host
    // 跑的是舊版程式碼）就會變成「按了完全沒事」，使用者無從判斷。
    applyLocale(next);
    // 再請 Extension 寫回設定，讓選擇被記住、其他 Preview 也一致。
    post({ type: "setLocale", locale: next });
  },
};

function buildToolbar(h: ToolbarHandlers): Toolbar {
  return new Toolbar(h, stringsFor(locale));
}

let toolbar = buildToolbar(handlers);
app.append(toolbar.element, canvas);
syncToolbar();

/**
 * 比較模式（跟 git 裡的舊版本比）。base 固定，目前的內容（schema）照常跟著檔案更新，
 * 每次更新都重新跟 base 比——agent 一邊改，畫面上就一邊看得到跟上一次 commit 的差異。
 */
let compareBase: { schema: Schema; label: string } | null = null;
let currentLabel = "";

const compareBanner = document.createElement("div");
compareBanner.style.cssText =
  "position:absolute;top:46px;left:50%;transform:translateX(-50%);z-index:20;display:flex;gap:8px;align-items:center;" +
  "padding:4px 10px;border-radius:999px;font-size:12px;border:1px solid var(--vscode-focusBorder);" +
  "background:var(--vscode-editorWidget-background);color:var(--vscode-foreground);box-shadow:0 2px 8px rgba(0,0,0,.3)";
compareBanner.hidden = true;
const compareText = document.createElement("span");
const compareExit = document.createElement("button");
compareExit.className = "dbs-btn";
compareExit.addEventListener("click", () => exitCompare());
compareBanner.append(compareText, compareExit);
app.append(compareBanner);

function renderCompare(refit: boolean): void {
  if (!compareBase || !schema) return;
  const diff = diffSchemas(compareBase.schema, schema);
  const merged = buildMergedSchema(compareBase.schema, schema);
  draw(merged, refit);
  applyDiffOverlay(canvas, diff);
  const strings = stringsFor(locale);
  compareText.textContent = strings.compareBanner(
    compareBase.label,
    currentLabel,
    diff.addedTables.length,
    diff.removedTables.length,
    diff.changedTables.length,
  );
  compareExit.textContent = strings.exitCompare;
  compareBanner.hidden = false;
}

function exitCompare(): void {
  if (!compareBase) return;
  compareBase = null;
  compareBanner.hidden = true;
  if (schema) draw(schema, false);
}

/** 所有「換資料重畫」都走這裡：記下畫了哪份，精簡模式的分區外框要跟著重算。 */
function draw(next: Schema, refit: boolean): void {
  renderedSchema = next;
  if (refit) renderer.setSchema(next);
  else renderer.updateSchema(next);
  syncCompact();
}

/** 跟網頁版的精簡模式相同：依群組分區、卡片只顯示表名、關聯改成直角連線；點表在右側看欄位。 */
function setViewMode(mode: ViewMode): void {
  if (mode === viewMode) return;
  viewMode = mode;
  if (mode === "compact") {
    detailLevelBeforeCompact = renderer.getViewState().detailLevel;
    renderer.setViewState({ detailLevel: "compact" });
    renderer.setLayoutEngine(compactLayoutEngine);
    // 分區版面本來就由上往下排好，點表不用自動平移過去。
    renderer.setAutoCenterOnFocus(false);
  } else {
    renderer.setLayoutEngine(layeredLayout);
    renderer.setAutoCenterOnFocus(true);
    if (detailLevelBeforeCompact) renderer.setViewState({ detailLevel: detailLevelBeforeCompact });
    detailLevelBeforeCompact = null;
  }
  syncToolbar();
  renderer.fitView();
}

function syncCompact(): void {
  if (viewMode === "compact" && renderedSchema) {
    syncCompactOverlay(canvas, renderedSchema, new Set(), stringsFor(locale).compactZoneTitle);
  } else {
    clearCompactOverlay(canvas);
  }
}

const detailPanel = document.createElement("div");
detailPanel.className = "dbs-detail-panel";
detailPanel.hidden = true;
app.append(detailPanel);

function syncDetailPanel(): void {
  const tableId = renderer.getViewState().focus.tableId;
  const table = viewMode === "compact" && tableId ? renderedSchema?.tables.find((t) => t.id === tableId) : undefined;
  detailPanel.hidden = !table;
  if (table) {
    renderDetailPanel(detailPanel, table, locale, {
      close: () => resetFocus(),
      openSource: (column) => post({ type: "openSource", tableId: table.id, column }),
    });
  }
}

/**
 * 換語系。
 * Toolbar 的標籤是建構時決定的，所以整條重建再換掉；
 * 這比讓每個按鈕都持有自己的 setter 單純，而且切換語系不是熱路徑。
 */
function applyLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  renderer.setLocale(locale);

  const rebuilt = buildToolbar(handlers);
  toolbar.element.replaceWith(rebuilt.element);
  toolbar = rebuilt;
  if (schema) toolbar.setSchema(schema);
  if (lastMetrics) paintMetrics();
  rebuilt.setLayoutDirty(renderer.hasManualPositions());
  syncToolbar();
  if (compareBase) renderCompare(false);
}

function resetFocus(): void {
  renderer.setViewState({
    focus: { ...renderer.getViewState().focus, tableId: null },
    columnFocus: null,
    highlightedColumn: null,
    searchMatches: new Set(),
  });
  toolbar.setColumnFocus(null);
  syncToolbar();
}

function syncToolbar(): void {
  const state = renderer.getViewState();
  toolbar.setActive({
    detailLevel: state.detailLevel,
    depth: state.focus.depth,
    direction: state.focus.direction,
    unrelated: state.unrelated,
    expandComments: state.expandComments,
    layoutMode: state.layoutMode,
    groupFilter: state.groupFilter,
    locale,
    viewMode,
  });
  syncCompact();
  syncDetailPanel();
}

function paintMetrics(): void {
  if (!lastMetrics) return;
  toolbar.setMetrics(
    stringsFor(locale).metrics(lastMetrics.tables, lastMetrics.relations, lastMetrics.ms),
  );
}

window.addEventListener("message", (event: MessageEvent<ExtensionToWebview>) => {
  const message = event.data;
  switch (message.type) {
    case "locale": {
      applyLocale(message.locale);
      return;
    }
    case "schema": {
      const keepView = Boolean(message.preserveView && schema);
      // 換成另一個檔案的話，原本的比較就沒意義了。
      if (!message.preserveView) exitCompare();
      schema = message.schema;
      currentLabel = message.label;
      toolbar.setSchema(schema);

      const start = performance.now();
      if (compareBase) {
        renderCompare(false);
      } else if (keepView) {
        // 同一個檔案的更新（打字、存檔、agent 改寫）：保留縮放、平移跟聚焦，不要每次都跳回全圖。
        // 聚焦中的表被刪掉的話就取消聚焦，不留一個指向不存在的表的狀態。
        const focused = renderer.getViewState().focus.tableId;
        if (focused && !schema.tables.some((table) => table.id === focused)) resetFocus();
        draw(schema, false);
        if (message.changes) highlightChanges(canvas, message.changes);
      } else {
        renderer.setViewState(
          viewMode === "compact" ? { ...DEFAULT_VIEW_STATE, detailLevel: "compact" } : DEFAULT_VIEW_STATE,
        );
        draw(schema, true);
      }
      const elapsed = performance.now() - start;

      renderer.setDiagnostics(message.diagnostics);
      syncToolbar();

      lastMetrics = {
        tables: schema.tables.length,
        relations: schema.relations.length,
        ms: Math.round(elapsed),
      };
      paintMetrics();
      post({
        type: "metrics",
        tableCount: schema.tables.length,
        relationCount: schema.relations.length,
        layoutMs: elapsed,
        renderMs: elapsed,
      });
      return;
    }
    case "diagnostics": {
      renderer.setDiagnostics(message.diagnostics);
      return;
    }
    case "compare": {
      compareBase = { schema: message.base, label: message.baseLabel };
      renderCompare(true);
      return;
    }
    case "exitCompare": {
      exitCompare();
      return;
    }
    case "exportImage": {
      void exportImage(message.requestId, message.format);
      return;
    }
    case "command": {
      if (message.command === "fitView") renderer.fitView();
      else resetFocus();
      return;
    }
  }
});

/**
 * 跟網頁版「複製成 PNG／SVG」同一套（html-to-image，輸出目前畫布可見的範圍）。
 * Webview 裡不方便直接存檔或寫剪貼簿，所以把 data URL 丟回 Extension 端，由它用存檔對話框寫檔。
 */
async function exportImage(requestId: number, format: ImageFormat): Promise<void> {
  try {
    const dataUrl = format === "png" ? await toPng(canvas, { pixelRatio: 2 }) : await toSvg(canvas);
    post({ type: "imageExported", requestId, dataUrl });
  } catch (error) {
    post({ type: "imageExportFailed", requestId, message: error instanceof Error ? error.message : String(error) });
  }
}

// plan §42：Esc 取消 Focus、Ctrl/Cmd+F 進搜尋。
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    resetFocus();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    toolbar.focusSearch();
  }
});

window.addEventListener("resize", () => {
  if (schema) renderer.fitView();
});

post({ type: "ready" });
