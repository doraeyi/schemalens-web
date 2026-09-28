import type { TableId } from "@schemalens/schema-core";

/**
 * 只需要 SchemaDiff（@schemalens/schema-diff）裡的這幾個欄位——用結構型別接，
 * renderer 就不用依賴 schema-diff。
 */
export interface HighlightableChanges {
  addedTables: ReadonlyArray<{ id: TableId }>;
  changedTables: ReadonlyArray<{
    tableId: TableId;
    addedColumns: ReadonlyArray<{ name: string }>;
    changedColumns: ReadonlyArray<{ name: string }>;
  }>;
}

const STYLE_ID = "dbs-change-highlight-style";
const DURATION_MS = 4000;

const CSS = `
@keyframes dbs-change-flash {
  0%, 60% { box-shadow: 0 0 0 3px var(--dbs-change-color), 0 0 18px var(--dbs-change-color); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes dbs-change-row-flash {
  0%, 60% { background: color-mix(in srgb, var(--dbs-change-color) 28%, transparent); }
  100% { background: transparent; }
}
.dbs-card.dbs-change-added, .dbs-card.dbs-change-changed {
  animation: dbs-change-flash ${DURATION_MS}ms ease-out forwards;
}
.dbs-row.dbs-change-added, .dbs-row.dbs-change-changed {
  animation: dbs-change-row-flash ${DURATION_MS}ms ease-out forwards;
}
.dbs-change-added { --dbs-change-color: var(--vscode-charts-green, #3fb950); }
.dbs-change-changed { --dbs-change-color: var(--vscode-charts-yellow, #d29922); }
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

/**
 * 在已經畫好的卡片上短暫標出這次的變更：新增的表／欄位綠色、修改的黃色，幾秒後淡掉。
 * 給「檔案被外部改寫」這種使用者沒親手改的更新用——agent 一次改很多地方時，才看得出改了哪裡。
 * 刪掉的東西已經不在畫面上，沒辦法標，呼叫端自己用別的方式（例如狀態列）說明。
 *
 * 必須在 setSchema／updateSchema 之後呼叫（那兩個會重建 DOM）。回傳拿掉標記的函式。
 */
export function highlightChanges(host: HTMLElement, changes: HighlightableChanges): () => void {
  ensureStyle(host.ownerDocument);
  const marked: Array<[HTMLElement, string]> = [];
  const mark = (el: HTMLElement, kind: "added" | "changed"): void => {
    const className = `dbs-change-${kind}`;
    el.classList.add(className);
    marked.push([el, className]);
  };

  const added = new Set(changes.addedTables.map((t) => t.id));
  const changedByTable = new Map(changes.changedTables.map((t) => [t.tableId, t]));

  for (const card of host.querySelectorAll<HTMLElement>(".dbs-card")) {
    const tableId = card.dataset.tableId;
    if (!tableId) continue;
    if (added.has(tableId)) {
      mark(card, "added");
      continue;
    }
    const tableChanges = changedByTable.get(tableId);
    if (!tableChanges) continue;
    mark(card, "changed");
    const addedColumns = new Set(tableChanges.addedColumns.map((c) => c.name));
    const changedColumns = new Set(tableChanges.changedColumns.map((c) => c.name));
    for (const row of card.querySelectorAll<HTMLElement>(".dbs-row")) {
      const column = row.dataset.column;
      if (!column) continue;
      if (addedColumns.has(column)) mark(row, "added");
      else if (changedColumns.has(column)) mark(row, "changed");
    }
  }

  const clear = (): void => {
    for (const [el, className] of marked) el.classList.remove(className);
  };
  setTimeout(clear, DURATION_MS);
  return clear;
}
