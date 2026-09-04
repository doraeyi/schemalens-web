import type { PositionedNode } from "@schemalens/schema-layout";
import { CARD_METRICS, type CardModel } from "./cardModel.js";
import { stringsFor, type RendererStrings } from "./i18n.js";

export interface CardElements {
  root: HTMLElement;
  /** columnName → row element，供 Column Highlight（US6）使用。 */
  rowByColumn: Map<string, HTMLElement>;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 畫一張 drawDB-like Table Card。
 *
 * 用 DOM 而不是 Canvas：文字清晰、直接吃 VS Code 主題、
 * 而且每個欄位 Row 都是真實元素，Column 級的 hover / 高亮 / 雙擊回跳
 * 才不用自己重做命中測試。
 */
export function renderCard(
  card: CardModel,
  position: PositionedNode,
  strings: RendererStrings = stringsFor(undefined),
): CardElements {
  const root = el("div", "dbs-card");
  root.dataset.tableId = card.table.id;
  root.style.left = `${position.x}px`;
  root.style.top = `${position.y}px`;
  root.style.width = `${card.width}px`;
  root.style.height = `${card.height}px`;

  // 標題列：▾ 名稱 / schema / Table 備註全部同一行，備註不佔額外高度。
  const header = el("div", "dbs-card-header");
  const toggle = el("span", "dbs-card-toggle", card.collapsed ? "▸" : "▾");
  toggle.dataset.action = "toggle-collapse";
  header.append(toggle, el("span", "dbs-card-name", card.table.name));
  header.append(el("span", "dbs-card-schema", card.table.schema));
  if (card.showComment && card.table.comment) {
    const comment = el("span", "dbs-card-comment", card.table.comment);
    comment.title = card.table.comment;
    header.append(comment);
  }
  root.append(header);

  const rowByColumn = new Map<string, HTMLElement>();
  if (card.rows.length > 0 || card.hiddenColumnCount > 0) {
    const body = el("div", "dbs-card-body");
    for (const row of card.rows) {
      const rowEl = el("div", "dbs-row");
      rowEl.dataset.column = row.column.name;
      rowEl.style.height = `${CARD_METRICS.rowHeight}px`;

      const badges = el("div", "dbs-row-badges");
      for (const badge of row.badges) {
        badges.append(el("span", `dbs-badge ${badge.toLowerCase()}`, badge));
      }
      rowEl.append(badges, el("span", "dbs-row-name", row.column.name));

      rowEl.append(el("span", "dbs-row-type", row.typeLabel));

      if (card.detailLevel === "full") {
        const flags: string[] = [];
        if (row.column.nullable) flags.push("null");
        if (row.column.defaultValue) flags.push(`= ${row.column.defaultValue}`);
        if (flags.length) rowEl.append(el("span", "dbs-row-flags", flags.join(" ")));

        // 欄位用途說明直接畫出來（plan §19）。只放 tooltip 的話，
        // 使用者必須逐欄 hover 才知道欄位是做什麼的。
        if (row.column.comment) {
          rowEl.append(el("span", "dbs-row-comment", row.column.comment));
        }
      }

      // 卡片寬度有上限，過長的備註會被截斷，因此 tooltip 仍保留完整內容。
      if (row.column.comment) rowEl.title = `${row.column.name} — ${row.column.comment}`;

      body.append(rowEl);
      rowByColumn.set(row.column.name, rowEl);
    }

    if (card.hiddenColumnCount > 0) {
      const more = el("div", "dbs-row dbs-row-more", strings.moreColumns(card.hiddenColumnCount));
      more.dataset.action = "expand-detail";
      body.append(more);
    }
    root.append(body);
  }

  return { root, rowByColumn };
}
