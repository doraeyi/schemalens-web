import type { TableId } from "@schemalens/schema-core";
import type { TraversalDirection } from "@schemalens/schema-graph";

/**
 * 資訊量層級（plan §30、US7）。
 * 預設 **必須** 是 Full：打開 Preview 就要看到完整 Table / Column / Type。
 * Overview 只是降噪模式，不是預設畫面。
 */
export type DetailLevel = "overview" | "keys" | "full";

/** 未相關 Table 的處理方式（plan §23）。 */
export type UnrelatedMode = "dim" | "hide";

export interface FocusState {
  tableId: TableId | null;
  /** 1-Hop / 2-Hop；null 代表 All（不限制深度）。 */
  depth: 1 | 2 | null;
  direction: TraversalDirection;
}

export interface ViewState {
  detailLevel: DetailLevel;
  focus: FocusState;
  unrelated: UnrelatedMode;
  /** 被 Collapse 的 table。 */
  collapsed: ReadonlySet<TableId>;
  /**
   * 欄位備註是否完整展開。
   * 預設 false：備註單行、過長截斷成 …，避免卡片被長註解撐爆。
   */
  expandComments: boolean;
  /**
   * 欄位聚焦：只亮起這個欄位與它透過 FK 對應到的欄位，其餘欄位降為雜訊。
   * 與 highlightedColumn（Search 命中的單一欄位）不同，這是一整組關聯欄位。
   */
  columnFocus: { tableId: TableId; column: string } | null;
  /** Column Search 命中後要高亮的欄位（US6）。 */
  highlightedColumn: { tableId: TableId; column: string } | null;
  /** Search 命中的 table 集合，用於卡片外框標示。 */
  searchMatches: ReadonlySet<TableId>;
  /**
   * 只顯示這個群組的 table；null 代表不篩選。
   * 與 Focus 是不同維度：Focus 依關聯展開，群組依人為分類。
   */
  groupFilter: string | null;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  // 約束 #15 / #16：預設就是完整卡片，不是 Table 名稱 + 線。
  detailLevel: "full",
  focus: { tableId: null, depth: 1, direction: "all" },
  unrelated: "dim",
  expandComments: false,
  collapsed: new Set(),
  columnFocus: null,
  highlightedColumn: null,
  searchMatches: new Set(),
  groupFilter: null,
};

export function resetFocus(state: ViewState): ViewState {
  return {
    ...state,
    focus: { ...state.focus, tableId: null },
    columnFocus: null,
    highlightedColumn: null,
    searchMatches: new Set(),
  };
}

export function toggleCollapsed(state: ViewState, tableId: TableId): ViewState {
  const collapsed = new Set(state.collapsed);
  if (collapsed.has(tableId)) collapsed.delete(tableId);
  else collapsed.add(tableId);
  return { ...state, collapsed };
}
