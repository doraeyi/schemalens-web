import type { TableId } from "@schemalens/schema-core";

/**
 * 「比較」模式的標記：新增綠框、刪除紅色虛線＋半透明、修改黃框，欄位列同色底。
 * 網頁版（比較版本／歷史）跟 VS Code 插件（跟 git 比較）共用。
 *
 * 用結構型別接 SchemaDiff（@schemalens/schema-diff），renderer 不必依賴 schema-diff。
 */
export interface OverlayDiff {
  addedTables: ReadonlyArray<{ id: TableId }>;
  removedTables: ReadonlyArray<{ id: TableId }>;
  changedTables: ReadonlyArray<{
    tableId: TableId;
    addedColumns: ReadonlyArray<{ name: string }>;
    removedColumns: ReadonlyArray<{ name: string }>;
    changedColumns: ReadonlyArray<{ name: string }>;
  }>;
}

const STYLE_ID = "dbs-diff-overlay-style";

// class 名稱沿用網頁版原本的 sl-diff-*（apps/web/src/app.css 裡也有同樣的規則），兩邊看起來一致。
const CSS = `
.dbs-card.sl-diff-added { outline: 2px solid #22c55e !important; outline-offset: 2px; }
.dbs-card.sl-diff-removed { outline: 2px dashed #ef4444 !important; outline-offset: 2px; opacity: 0.55; }
.dbs-card.sl-diff-changed { outline: 2px solid #eab308 !important; outline-offset: 2px; }
.dbs-row.sl-diff-added { background: color-mix(in oklab, #22c55e 18%, transparent) !important; }
.dbs-row.sl-diff-removed {
  background: color-mix(in oklab, #ef4444 18%, transparent) !important;
  text-decoration: line-through;
  opacity: 0.7;
}
.dbs-row.sl-diff-changed { background: color-mix(in oklab, #eab308 18%, transparent) !important; }
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

/**
 * 渲染完 buildMergedSchema() 產生的合成 schema 之後，直接對已經畫出來的 .dbs-card/.dbs-row
 * DOM 節點加樣式——不用改 renderer 本身。
 */
export function applyDiffOverlay(canvasHost: HTMLElement, diff: OverlayDiff): void {
  ensureStyle(canvasHost.ownerDocument);
  const addedTableIds = new Set(diff.addedTables.map((t) => t.id));
  const removedTableIds = new Set(diff.removedTables.map((t) => t.id));
  const changedByTable = new Map(diff.changedTables.map((t) => [t.tableId, t]));

  for (const card of canvasHost.querySelectorAll<HTMLElement>(".dbs-card")) {
    const tableId = card.dataset.tableId;
    if (!tableId) continue;

    if (addedTableIds.has(tableId)) {
      card.classList.add("sl-diff-added");
    } else if (removedTableIds.has(tableId)) {
      card.classList.add("sl-diff-removed");
    } else {
      const tableDiff = changedByTable.get(tableId);
      if (!tableDiff) continue;
      card.classList.add("sl-diff-changed");
      const addedCols = new Set(tableDiff.addedColumns.map((c) => c.name));
      const removedCols = new Set(tableDiff.removedColumns.map((c) => c.name));
      const changedCols = new Set(tableDiff.changedColumns.map((c) => c.name));
      for (const row of card.querySelectorAll<HTMLElement>(".dbs-row")) {
        const column = row.dataset.column;
        if (!column) continue;
        if (addedCols.has(column)) row.classList.add("sl-diff-added");
        else if (removedCols.has(column)) row.classList.add("sl-diff-removed");
        else if (changedCols.has(column)) row.classList.add("sl-diff-changed");
      }
    }
  }
}

export function clearDiffOverlay(canvasHost: HTMLElement): void {
  for (const el of canvasHost.querySelectorAll(".sl-diff-added, .sl-diff-removed, .sl-diff-changed")) {
    el.classList.remove("sl-diff-added", "sl-diff-removed", "sl-diff-changed");
  }
}
