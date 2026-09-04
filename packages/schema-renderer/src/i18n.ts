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
  viewOverview: string;
  viewKeys: string;
  viewFull: string;
  depthAll: string;
  depth1Hop: string;
  depth2Hop: string;
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
  viewGroup: "View",
  depthGroup: "Depth",
  directionGroup: "Direction",
  unrelatedGroup: "Unrelated",
  viewOverview: "Overview",
  viewKeys: "Keys",
  viewFull: "Full",
  depthAll: "All",
  depth1Hop: "1-Hop",
  depth2Hop: "2-Hop",
  directionAll: "All",
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
  viewGroup: "檢視",
  depthGroup: "深度",
  directionGroup: "方向",
  unrelatedGroup: "不相關",
  viewOverview: "總覽",
  viewKeys: "索引鍵",
  viewFull: "完整",
  depthAll: "全部",
  depth1Hop: "1 層",
  depth2Hop: "2 層",
  directionAll: "全部",
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
