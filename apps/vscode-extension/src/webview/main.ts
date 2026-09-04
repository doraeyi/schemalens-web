import type { Schema } from "@schemalens/schema-core";
import type { TraversalDirection } from "@schemalens/schema-graph";
import {
  DEFAULT_VIEW_STATE,
  SchemaRenderer,
  type DetailLevel,
  type UnrelatedMode,
} from "@schemalens/schema-renderer";
import type { ExtensionToWebview, WebviewToExtension } from "../preview/protocol.js";
import { TOOLBAR_CSS, Toolbar } from "./toolbar.js";

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

const renderer = new SchemaRenderer(canvas, {
  events: {
    openSource: (target) => post({ type: "openSource", tableId: target.tableId, column: target.column }),
    tableSelected: () => syncToolbar(),
    viewStateChanged: () => syncToolbar(),
  },
});

const toolbar = new Toolbar({
  onDetailLevel: (level: DetailLevel) => {
    renderer.setViewState({ detailLevel: level });
    syncToolbar();
  },
  onDepth: (depth) => {
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
  onResetFocus: () => {
    renderer.setViewState({
      focus: { ...renderer.getViewState().focus, tableId: null },
      highlightedColumn: null,
      searchMatches: new Set(),
    });
    syncToolbar();
  },
  onFitView: () => renderer.fitView(),
  onPickHit: (hit) => {
    // US3 / US6：Table 命中 → Jump + Focus；Column 命中 → 額外高亮該欄位。
    if (hit.kind === "column") renderer.revealColumn(hit.tableId, hit.column);
    else renderer.focusTable(hit.tableId);
    syncToolbar();
  },
  onSearchResults: (hits) => {
    renderer.setSearchMatches([...new Set(hits.map((hit) => hit.tableId))]);
  },
});

app.append(toolbar.element, canvas);

function syncToolbar(): void {
  const state = renderer.getViewState();
  toolbar.setActive({
    detailLevel: state.detailLevel,
    depth: state.focus.depth,
    direction: state.focus.direction,
    unrelated: state.unrelated,
  });
}

window.addEventListener("message", (event: MessageEvent<ExtensionToWebview>) => {
  const message = event.data;
  switch (message.type) {
    case "schema": {
      schema = message.schema;
      toolbar.setSchema(schema);

      const layoutStart = performance.now();
      renderer.setViewState(DEFAULT_VIEW_STATE);
      renderer.setSchema(schema);
      const elapsed = performance.now() - layoutStart;

      renderer.setDiagnostics(message.diagnostics);
      syncToolbar();

      toolbar.setMetrics(
        `${schema.tables.length} tables · ${schema.relations.length} relations · ${elapsed.toFixed(0)}ms`,
      );
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
      else {
        renderer.setViewState({
          focus: { ...renderer.getViewState().focus, tableId: null },
          highlightedColumn: null,
          searchMatches: new Set(),
        });
        syncToolbar();
      }
      return;
    }
  }
});

// plan §42：Esc 取消 Focus、Ctrl/Cmd+F 進搜尋。
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    renderer.setViewState({
      focus: { ...renderer.getViewState().focus, tableId: null },
      highlightedColumn: null,
      searchMatches: new Set(),
    });
    syncToolbar();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    toolbar.focusSearch();
  }
});

window.addEventListener("resize", () => {
  if (schema) renderer.fitView();
});

post({ type: "ready" });
