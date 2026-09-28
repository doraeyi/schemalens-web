import type { Column, Table } from "@schemalens/schema-core";
import type { Locale } from "@schemalens/schema-renderer";

/**
 * 精簡模式的表格詳情（網頁版側欄 TableInspector 的唯讀版本）：精簡模式的卡片只有表名，
 * 點一張表就在右側列出它的欄位。雙擊欄位跳到 DSL 定義。
 */

const STRINGS: Record<Locale, { close: string; columns: (n: number) => string; openSourceHint: string; defaultValue: string }> = {
  en: {
    close: "Close",
    columns: (n) => `${n} columns`,
    openSourceHint: "Double-click to jump to the definition",
    defaultValue: "default",
  },
  "zh-hant": {
    close: "關閉",
    columns: (n) => `${n} 個欄位`,
    openSourceHint: "雙擊跳到定義",
    defaultValue: "預設",
  },
};

export const DETAIL_PANEL_CSS = `
.dbs-detail-panel {
  position: absolute; top: 46px; right: 10px; bottom: 10px; z-index: 15;
  width: 320px; max-width: 45%; overflow: auto; box-sizing: border-box; padding: 10px 12px;
  border-radius: 8px; font-size: 12px;
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  background: var(--vscode-editorWidget-background, #252526);
  color: var(--vscode-foreground, #cccccc);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.dbs-detail-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.dbs-detail-title { font-weight: 700; font-size: 13px; word-break: break-all; }
.dbs-detail-sub { color: var(--vscode-descriptionForeground, #9d9d9d); margin-top: 2px; }
.dbs-detail-close { margin-left: auto; }
.dbs-detail-row { padding: 5px 4px; border-top: 1px solid var(--vscode-panel-border, #3c3c3c); cursor: default; }
.dbs-detail-row:hover { background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05)); }
.dbs-detail-line { display: flex; gap: 6px; align-items: baseline; }
.dbs-detail-flags { min-width: 26px; font-size: 10px; font-weight: 700; color: var(--vscode-charts-yellow, #d29922); }
.dbs-detail-name { font-weight: 600; }
.dbs-detail-type { margin-left: auto; font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-charts-green, #3fb950); }
.dbs-detail-null { color: var(--vscode-descriptionForeground, #9d9d9d); font-size: 10px; }
.dbs-detail-note { color: var(--vscode-descriptionForeground, #9d9d9d); margin: 2px 0 0 32px; }
`;

function flagsOf(column: Column): string {
  const flags: string[] = [];
  if (column.primaryKey) flags.push("PK");
  if (column.foreignKey) flags.push("FK");
  if (column.unique && !column.primaryKey) flags.push("UQ");
  if (column.indexed && flags.length === 0) flags.push("IDX");
  return flags.join(" ");
}

function typeOf(column: Column): string {
  if (column.length !== undefined) return `${column.type}(${column.length})`;
  if (column.precision !== undefined) {
    return column.scale !== undefined ? `${column.type}(${column.precision},${column.scale})` : `${column.type}(${column.precision})`;
  }
  return column.type;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderDetailPanel(
  panel: HTMLElement,
  table: Table,
  locale: Locale,
  actions: { close(): void; openSource(column?: string): void },
): void {
  const strings = STRINGS[locale];
  const head = el("div", "dbs-detail-head");
  const titles = el("div", "");
  const title = el("div", "dbs-detail-title", table.id);
  title.title = strings.openSourceHint;
  title.addEventListener("dblclick", () => actions.openSource());
  const sub = el("div", "dbs-detail-sub", [table.comment, table.group, strings.columns(table.columns.length)].filter(Boolean).join(" · "));
  titles.append(title, sub);
  const close = el("button", "dbs-btn dbs-detail-close", strings.close);
  close.addEventListener("click", () => actions.close());
  head.append(titles, close);

  const rows = table.columns.map((column) => {
    const row = el("div", "dbs-detail-row");
    row.title = strings.openSourceHint;
    row.addEventListener("dblclick", () => actions.openSource(column.name));
    const line = el("div", "dbs-detail-line");
    line.append(
      el("span", "dbs-detail-flags", flagsOf(column)),
      el("span", "dbs-detail-name", column.name),
      el("span", "dbs-detail-null", column.nullable ? "NULL" : "NOT NULL"),
      el("span", "dbs-detail-type", typeOf(column)),
    );
    row.append(line);
    const note = [column.defaultValue !== undefined ? `${strings.defaultValue} ${column.defaultValue}` : "", column.comment ?? ""]
      .filter(Boolean)
      .join(" · ");
    if (note) row.append(el("div", "dbs-detail-note", note));
    return row;
  });

  panel.replaceChildren(head, ...rows);
}
