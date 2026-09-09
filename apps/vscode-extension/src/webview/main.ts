import type { Schema } from "@schemalens/schema-core";
import type { SearchHit, TraversalDirection } from "@schemalens/schema-graph";
import {
  DEFAULT_LOCALE,
  DEFAULT_VIEW_STATE,
  SchemaRenderer,
  stringsFor,
  type DetailLevel,
  type LayoutMode,
  type Locale,
  type UnrelatedMode,
} from "@schemalens/schema-renderer";
import type { ExtensionToWebview, WebviewToExtension } from "../preview/protocol.js";
import { TOOLBAR_CSS, Toolbar, type ToolbarHandlers } from "./toolbar.js";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const post = (message: WebviewToExtension): void => vscode.postMessage(message);

const app = document.getElementById("app")!;

const style = document.createElement("style");
style.textContent = TOOLBAR_CSS;
document.head.append(style);

const canvas = document.createElement("div");
canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.top = "38px";

let schema: Schema | null = null;
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

const handlers: ToolbarHandlers = {
  onDetailLevel: (level: DetailLevel) => {
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
  });
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
      schema = message.schema;
      toolbar.setSchema(schema);

      const start = performance.now();
      renderer.setViewState(DEFAULT_VIEW_STATE);
      renderer.setSchema(schema);
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
    case "command": {
      if (message.command === "fitView") renderer.fitView();
      else resetFocus();
      return;
    }
  }
});

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
