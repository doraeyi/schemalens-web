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
  /** 標題列（Table 名稱 + schema + Table 備註，同一行）高度 */
  headerHeight: 34,
  /** 欄位列高度 */
  rowHeight: 22,
  /** 卡片上下內距（欄位區） */
  bodyPaddingY: 4,
  /** 摺疊或 Overview 時的卡片高度 */
  compactHeight: 34,
  minWidth: 220,
  // Full 檢視要放得下欄位備註（中文備註的實際寬度是字數的兩倍），因此上限較寬。
  maxWidth: 680,
  /** 半形字元的寬度（等寬字型 12px 左右）；全形字以兩倍計 */
  charWidth: 6.8,
  horizontalPadding: 20,
  /** 欄位標記欄（PK/FK/UQ/IDX）固定寬度；要放得下兩個帶框的標記 */
  badgeColumnWidth: 50,
  /** 欄位列的 grid 欄間距總和（4 個間隔 × 8px） */
  columnGaps: 32,
  /** 展開備註時，每行放幾個字就換行 */
  commentWrapChars: 6,
  /** 備註每行的高度 */
  commentLineHeight: 14,
} as const;

export interface CardRow {
  column: Column;
  /** 例如 `PK`、`FK`、`UQ`、`IDX`，可能多個。 */
  badges: string[];
  /** 例如 `nvarchar(255)` */
  typeLabel: string;
  /**
   * 展開備註時，已經切好的每一行。
   * 換行在這裡算完而不是交給瀏覽器，否則 layout 拿到的高度會與實際畫出來的不一致，
   * 關聯線的錨點就會接歪。
   */
  commentLines: string[];
  /** 這一列實際的高度；備註換行時會比 rowHeight 高。 */
  height: number;
}

export interface CardModel {
  table: Table;
  detailLevel: DetailLevel;
  collapsed: boolean;
  /** 依 detailLevel 過濾後，實際會畫出來的欄位。 */
  rows: CardRow[];
  /** 因 detailLevel 被隱藏的欄位數，顯示成 "+N more"。 */
  hiddenColumnCount: number;
  /** Table 備註是否要顯示；它與 schema 名稱同一行，不佔額外高度。 */
  showComment: boolean;
  /** 欄位備註是否展開成多行（否則單行截斷成 …）。 */
  commentsExpanded: boolean;
  /** 所屬群組（功能模組）；沒有分類時為 undefined。 */
  group?: string;
  width: number;
  height: number;
}

/**
 * 全形字元（中日韓、全形標點）在等寬字型下約為半形的兩倍寬。
 *
 * 這個範圍涵蓋 CJK 統一表意文字、假名、諺文與全形標點，
 * 已足夠涵蓋 Schema 註解會出現的文字。
 */
const FULL_WIDTH =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/;

/**
 * 以「半形字元」為單位量文字寬度。
 *
 * 直接用 text.length 會讓中文備註被低估近一半，
 * 卡片因此不夠寬，備註就算很短也會被截斷成 …。
 */
export function textWidth(text: string): number {
  let width = 0;
  for (const char of text) width += FULL_WIDTH.test(char) ? 2 : 1;
  return width;
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

/**
 * 把備註切成固定字數的多行。
 *
 * 以「字」為單位而不是像素：中文與英文混排時，用像素估算會失準，
 * 而固定字數換行的結果是確定的，layout 與繪製才不會對不上。
 */
export function wrapComment(
  comment: string,
  charsPerLine: number = CARD_METRICS.commentWrapChars,
): string[] {
  const text = comment.trim();
  if (!text) return [];
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += charsPerLine) {
    lines.push(text.slice(i, i + charsPerLine));
  }
  return lines;
}

export function visibleColumns(table: Table, detailLevel: DetailLevel): Column[] {
  if (detailLevel === "overview") return [];
  if (detailLevel === "keys") return table.columns.filter(isKeyColumn);
  return [...table.columns];
}

function estimateWidth(
  table: Table,
  rows: CardRow[],
  detailLevel: DetailLevel,
  commentsExpanded: boolean,
): number {
  const { charWidth, horizontalPadding, badgeColumnWidth, columnGaps, minWidth, maxWidth } =
    CARD_METRICS;

  // 標題列：名稱 + schema + Table 備註都在同一行。
  const headerChars =
    textWidth(table.name) +
    textWidth(table.schema) +
    2 +
    (table.group ? textWidth(table.group) + 3 : 0) +
    (table.comment ? textWidth(table.comment) + 3 : 0);
  let widest = headerChars * charWidth + 24;

  for (const row of rows) {
    // 名稱 + 型別 + 標記欄，再加上 nullable/default 與欄位備註的空間。
    const suffix = detailLevel === "full" ? (row.column.nullable ? 5 : 0) + (row.column.defaultValue ? 6 : 0) : 0;
    // 展開時備註欄固定為 commentWrapChars 寬（以全形計，中英文都放得下）；
    // 截斷時才需要預留原文長度。
    const comment =
      detailLevel === "full" && row.column.comment
        ? commentsExpanded
          ? CARD_METRICS.commentWrapChars * 2 + 2
          : textWidth(row.column.comment) + 3
        : 0;
    const text =
      (textWidth(row.column.name) + textWidth(row.typeLabel) + suffix + comment) * charWidth;
    widest = Math.max(widest, text + badgeColumnWidth + columnGaps);
  }
  return Math.round(Math.min(maxWidth, Math.max(minWidth, widest + horizontalPadding)));
}

export function buildCardModel(table: Table, state: ViewState): CardModel {
  const collapsed = state.collapsed.has(table.id);
  const detailLevel = state.detailLevel;
  const columns = collapsed ? [] : visibleColumns(table, detailLevel);

  // 備註只在 Full 檢視顯示，因此也只有 Full 需要考慮展開。
  const commentsExpanded = state.expandComments && detailLevel === "full";

  const rows: CardRow[] = columns.map((column) => {
    const commentLines =
      commentsExpanded && column.comment ? wrapComment(column.comment) : [];
    const commentHeight = commentLines.length * CARD_METRICS.commentLineHeight + 6;
    return {
      column,
      badges: columnBadges(column),
      typeLabel: formatType(column),
      commentLines,
      height: Math.max(CARD_METRICS.rowHeight, commentHeight),
    };
  });
  // Table 備註與 schema 名稱同一行，不再自成一列，所以任何檢視層級都顯示得起。
  const showComment = Boolean(table.comment);
  // Overview / Collapse 是刻意的降噪模式，連 "+N more" 都不該出現；
  // 只有 Keys 需要提示「還有欄位沒顯示」。
  const compact = collapsed || detailLevel === "overview";
  const hiddenColumnCount = compact ? 0 : table.columns.length - columns.length;

  const width = estimateWidth(table, rows, detailLevel, commentsExpanded);
  const height = computeCardHeight(rows, hiddenColumnCount > 0, compact);

  return {
    table,
    detailLevel,
    collapsed,
    rows,
    hiddenColumnCount,
    showComment,
    commentsExpanded,
    group: table.group,
    width,
    height,
  };
}

export function computeCardHeight(
  rows: readonly CardRow[],
  showMoreRow: boolean,
  compact: boolean,
): number {
  const m = CARD_METRICS;
  if (compact) return m.compactHeight;
  // 每一列的高度可能不同（備註展開時），所以要逐列加總而不是乘法。
  const body = rows.reduce((total, row) => total + row.height, 0);
  return m.headerHeight + m.bodyPaddingY * 2 + body + (showMoreRow ? m.rowHeight : 0);
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

  // 列高不再固定，必須累加前面每一列的實際高度。
  let top = m.headerHeight + m.bodyPaddingY;
  for (let i = 0; i < index; i++) top += card.rows[i]!.height;
  return top + card.rows[index]!.height / 2;
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
    // 帶上群組，Layout 才能把同群組的表聚在一起、外框才有意義。
    group: card.group,
  }));
}
