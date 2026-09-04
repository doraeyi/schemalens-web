import type { Column, Schema, Table, TableId } from "@schemalens/schema-core";
import type { LayoutNode } from "@schemalens/schema-layout";
import type { DetailLevel, ViewState } from "./viewState.js";

/**
 * Table Card 的幾何與內容模型。
 *
 * 這一層刻意是純函式：卡片尺寸與「第 N 個 Row 的中心在哪」都用固定
 * metrics 算出來，不依賴 DOM 量測。
 * 好處有兩個：
 *   1. Layout 拿到的尺寸與實際畫出來的尺寸必然一致，不會出現線接不準的情況。
 *   2. 欄位級 Relation 錨點可以被單元測試（plan §20、約束 #17）。
 */
export const CARD_METRICS = {
  /** 標題列（Table 名稱 + schema）高度 */
  headerHeight: 34,
  /** Table Comment 那一行的高度（Full 才顯示） */
  commentHeight: 18,
  /** 欄位列高度 */
  rowHeight: 22,
  /** 卡片上下內距（欄位區） */
  bodyPaddingY: 4,
  /** 摺疊或 Overview 時的卡片高度 */
  compactHeight: 34,
  minWidth: 200,
  maxWidth: 420,
  /** 用來估算文字寬度的每字元寬（等寬字型 12px 左右） */
  charWidth: 6.8,
  horizontalPadding: 20,
  /** 欄位標記欄（PK/FK/UQ/IDX）固定寬度 */
  badgeColumnWidth: 34,
} as const;

export interface CardRow {
  column: Column;
  /** 例如 `PK`、`FK`、`UQ`、`IDX`，可能多個。 */
  badges: string[];
  /** 例如 `nvarchar(255)` */
  typeLabel: string;
}

export interface CardModel {
  table: Table;
  detailLevel: DetailLevel;
  collapsed: boolean;
  /** 依 detailLevel 過濾後，實際會畫出來的欄位。 */
  rows: CardRow[];
  /** 因 detailLevel 被隱藏的欄位數，顯示成 "+N more"。 */
  hiddenColumnCount: number;
  showComment: boolean;
  width: number;
  height: number;
}

export function formatType(column: Column): string {
  if (column.length !== undefined) return `${column.type}(${column.length})`;
  if (column.precision !== undefined) {
    return column.scale !== undefined
      ? `${column.type}(${column.precision},${column.scale})`
      : `${column.type}(${column.precision})`;
  }
  return column.type;
}

export function columnBadges(column: Column): string[] {
  const badges: string[] = [];
  if (column.primaryKey) badges.push("PK");
  if (column.foreignKey) badges.push("FK");
  if (column.unique && !column.primaryKey) badges.push("UQ");
  if (column.indexed && !column.primaryKey && !column.unique) badges.push("IDX");
  return badges;
}

/** Keys 檢視只保留關鍵欄位；Full 顯示全部；Overview 不顯示欄位。 */
function isKeyColumn(column: Column): boolean {
  return column.primaryKey || column.foreignKey || column.unique || column.indexed;
}

export function visibleColumns(table: Table, detailLevel: DetailLevel): Column[] {
  if (detailLevel === "overview") return [];
  if (detailLevel === "keys") return table.columns.filter(isKeyColumn);
  return [...table.columns];
}

function estimateWidth(table: Table, rows: CardRow[], detailLevel: DetailLevel): number {
  const { charWidth, horizontalPadding, badgeColumnWidth, minWidth, maxWidth } = CARD_METRICS;
  let widest = (table.name.length + table.schema.length + 1) * charWidth + 24;
  if (detailLevel === "full" && table.comment) {
    widest = Math.max(widest, table.comment.length * charWidth);
  }
  for (const row of rows) {
    // 名稱 + 型別 + 標記欄，再加上 nullable/default 的尾註空間。
    const suffix = detailLevel === "full" ? (row.column.nullable ? 5 : 0) + (row.column.defaultValue ? 6 : 0) : 0;
    const text = (row.column.name.length + row.typeLabel.length + suffix + 3) * charWidth;
    widest = Math.max(widest, text + badgeColumnWidth);
  }
  return Math.round(Math.min(maxWidth, Math.max(minWidth, widest + horizontalPadding)));
}

export function buildCardModel(table: Table, state: ViewState): CardModel {
  const collapsed = state.collapsed.has(table.id);
  const detailLevel = state.detailLevel;
  const columns = collapsed ? [] : visibleColumns(table, detailLevel);
  const rows: CardRow[] = columns.map((column) => ({
    column,
    badges: columnBadges(column),
    typeLabel: formatType(column),
  }));
  const showComment = !collapsed && detailLevel === "full" && Boolean(table.comment);
  // Overview / Collapse 是刻意的降噪模式，連 "+N more" 都不該出現；
  // 只有 Keys 需要提示「還有欄位沒顯示」。
  const compact = collapsed || detailLevel === "overview";
  const hiddenColumnCount = compact ? 0 : table.columns.length - columns.length;

  const width = estimateWidth(table, rows, detailLevel);
  const height = computeCardHeight(rows.length, showComment, hiddenColumnCount > 0, compact);

  return { table, detailLevel, collapsed, rows, hiddenColumnCount, showComment, width, height };
}

export function computeCardHeight(
  rowCount: number,
  showComment: boolean,
  showMoreRow: boolean,
  compact: boolean,
): number {
  const m = CARD_METRICS;
  if (compact) return m.compactHeight + (showComment ? m.commentHeight : 0);
  const bodyRows = rowCount + (showMoreRow ? 1 : 0);
  return (
    m.headerHeight +
    (showComment ? m.commentHeight : 0) +
    m.bodyPaddingY * 2 +
    bodyRows * m.rowHeight
  );
}

/**
 * 欄位 Row 在卡片內的垂直中心（相對卡片頂端）。
 *
 * 找不到該欄位（Overview / Collapse / Keys 濾掉了）時退回卡片中心，
 * 這樣 Relation 線永遠有得畫，不會因為切換檢視就消失。
 */
export function rowCenterOffset(card: CardModel, columnName: string): number {
  const m = CARD_METRICS;
  const index = card.rows.findIndex((row) => row.column.name === columnName);
  if (index < 0) return card.height / 2;
  const top = m.headerHeight + (card.showComment ? m.commentHeight : 0) + m.bodyPaddingY;
  return top + index * m.rowHeight + m.rowHeight / 2;
}

export function buildCardModels(schema: Schema, state: ViewState): Map<TableId, CardModel> {
  const models = new Map<TableId, CardModel>();
  for (const table of schema.tables) models.set(table.id, buildCardModel(table, state));
  return models;
}

export function toLayoutNodes(models: ReadonlyMap<TableId, CardModel>): LayoutNode[] {
  return [...models.values()].map((card) => ({
    id: card.table.id,
    width: card.width,
    height: card.height,
  }));
}
