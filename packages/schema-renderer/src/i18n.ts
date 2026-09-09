/**
 * Renderer 的介面文字。
 *
 * 這一層不知道 VS Code 的存在（約束 #6），因此語系是由呼叫端傳進來的資料，
 * 而不是去讀任何環境設定。Extension 端負責決定要用哪一個。
 */
export type Locale = "en" | "zh-hant";

export const LOCALES: readonly Locale[] = ["en", "zh-hant"];

export interface RendererStrings {
  searchPlaceholder: string;
  viewGroup: string;
  depthGroup: string;
  directionGroup: string;
  unrelatedGroup: string;
  layoutGroup: string;
  layoutByGroup: string;
  layoutByRelation: string;
  columnFocus: string;
  groupLabel: string;
  allGroups: string;
  ungrouped: string;
  commentsGroup: string;
  commentsTruncate: string;
  commentsExpand: string;
  viewOverview: string;
  viewKeys: string;
  viewFull: string;
  depthAll: string;
  /** 例如「3 層」 */
  depthLevels: (levels: number) => string;
  depthDecrease: string;
  depthIncrease: string;
  /** 按鈕的 tooltip，說明各選項的用途。 */
  viewOverviewHint: string;
  viewKeysHint: string;
  viewFullHint: string;
  commentsTruncateHint: string;
  commentsExpandHint: string;
  directionAllHint: string;
  directionUpstreamHint: string;
  directionDownstreamHint: string;
  directionAll: string;
  directionUpstream: string;
  directionDownstream: string;
  unrelatedDim: string;
  unrelatedHide: string;
  resetFocus: string;
  fitView: string;
  resetLayout: string;
  resultTable: string;
  resultColumn: string;
  /** `+3 more columns` */
  moreColumns: (count: number) => string;
  /** 診斷橫幅的標題 */
  diagnosticsTitle: (count: number) => string;
  /** Toolbar 右側的統計 */
  metrics: (tables: number, relations: number, ms: number) => string;
  emptySchema: string;
}

const en: RendererStrings = {
  searchPlaceholder: "Search tables or columns…",
  viewGroup: "Columns",
  depthGroup: "Depth",
  directionGroup: "Direction",
  unrelatedGroup: "Unrelated",
  layoutGroup: "Layout",
  layoutByGroup: "By group",
  layoutByRelation: "By relations",
  columnFocus: "Column",
  groupLabel: "Group",
  allGroups: "All groups",
  ungrouped: "Ungrouped",
  commentsGroup: "Comments",
  commentsTruncate: "One line",
  commentsExpand: "Wrap",
  viewOverview: "Names only",
  viewKeys: "Key columns",
  viewFull: "All columns",
  depthAll: "All",
  depthLevels: (levels) => `${levels} ${levels === 1 ? "level" : "levels"}`,
  depthDecrease: "Fewer levels",
  depthIncrease: "More levels",
  viewOverviewHint: "Table names and relations only — good for seeing the whole shape",
  viewKeysHint: "Only PK / FK / UQ / IDX columns",
  viewFullHint: "Show every column",
  commentsTruncateHint: "Keep each comment on one line, truncated with …",
  commentsExpandHint: "Wrap long comments onto multiple lines",
  directionAllHint: "Follow relations in both directions",
  directionUpstreamHint: "Tables this one depends on",
  directionDownstreamHint: "Tables that depend on this one",
  directionAll: "Both",
  directionUpstream: "Upstream",
  directionDownstream: "Downstream",
  unrelatedDim: "Dim",
  unrelatedHide: "Hide",
  resetFocus: "Reset Focus",
  fitView: "Fit View",
  resetLayout: "Reset Layout",
  resultTable: "TABLE",
  resultColumn: "COLUMN",
  moreColumns: (count) => `+${count} more columns`,
  diagnosticsTitle: (count) =>
    `${count} schema ${count === 1 ? "issue" : "issues"} — showing the parts that could be parsed`,
  metrics: (tables, relations, ms) =>
    `${tables} tables · ${relations} relations · ${ms}ms`,
  emptySchema: "No tables to display",
};

const zhHant: RendererStrings = {
  searchPlaceholder: "搜尋 Table 或 Column…",
  viewGroup: "欄位顯示",
  depthGroup: "深度",
  directionGroup: "方向",
  unrelatedGroup: "不相關",
  layoutGroup: "排版",
  layoutByGroup: "依群組",
  layoutByRelation: "依關聯",
  columnFocus: "欄位聚焦",
  groupLabel: "群組",
  allGroups: "全部群組",
  ungrouped: "未分類",
  commentsGroup: "備註",
  commentsTruncate: "單行",
  commentsExpand: "換行",
  viewOverview: "只有表名",
  viewKeys: "主要欄位",
  viewFull: "全部欄位",
  depthAll: "全部",
  depthLevels: (levels) => `${levels} 層`,
  depthDecrease: "減少層數",
  depthIncrease: "增加層數",
  viewOverviewHint: "只顯示表名與關聯，適合先看整體結構",
  viewKeysHint: "只顯示 PK / FK / UQ / IDX 欄位",
  viewFullHint: "顯示每一個欄位",
  commentsTruncateHint: "備註只佔一行，過長以 … 省略",
  commentsExpandHint: "備註換行，完整顯示",
  directionAllHint: "兩個方向的關聯都看",
  directionUpstreamHint: "這張表依賴哪些表",
  directionDownstreamHint: "哪些表依賴這張表",
  directionAll: "雙向",
  directionUpstream: "上游",
  directionDownstream: "下游",
  unrelatedDim: "淡化",
  unrelatedHide: "隱藏",
  resetFocus: "取消聚焦",
  fitView: "全部顯示",
  resetLayout: "還原版面",
  resultTable: "資料表",
  resultColumn: "欄位",
  moreColumns: (count) => `還有 ${count} 個欄位`,
  diagnosticsTitle: (count) => `${count} 個 Schema 問題（Preview 顯示的是可解析的部分）`,
  metrics: (tables, relations, ms) => `${tables} 張表 · ${relations} 條關聯 · ${ms}ms`,
  emptySchema: "沒有可顯示的資料表",
};

export const RENDERER_STRINGS: Record<Locale, RendererStrings> = {
  en,
  "zh-hant": zhHant,
};

export const DEFAULT_LOCALE: Locale = "en";

/**
 * 把 VS Code 的 display language（或瀏覽器 language）對應到支援的語系。
 * 任何中文變體都歸到繁體中文，其餘一律 English。
 */
export function resolveLocale(language: string | undefined): Locale {
  if (!language) return DEFAULT_LOCALE;
  return /^zh\b/i.test(language) ? "zh-hant" : DEFAULT_LOCALE;
}

export function stringsFor(locale: Locale | undefined): RendererStrings {
  return RENDERER_STRINGS[locale ?? DEFAULT_LOCALE] ?? RENDERER_STRINGS[DEFAULT_LOCALE];
}
