import type { TableId } from "@schemalens/schema-core";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

/** Layout 的輸入節點：只帶尺寸，不帶任何 Table 語意。 */
export interface LayoutNode extends Size {
  id: TableId;
  /** 所屬群組；有值時會被聚攏排在一起，群組外框才畫得出來。 */
  group?: string;
}

export interface LayoutEdge {
  id: string;
  source: TableId;
  target: TableId;
}

export interface LayoutInput {
  nodes: readonly LayoutNode[];
  edges: readonly LayoutEdge[];
}

export interface LayoutOptions {
  /** 同一層內節點之間的間距 */
  nodeGap?: number;
  /** 層與層之間的間距 */
  layerGap?: number;
  /** 不連通元件之間的間距 */
  componentGap?: number;
  direction?: "LR" | "TB";
  /** 是否依 group 聚攏（預設開啟；沒有任何節點帶 group 時自動略過）。 */
  clusterByGroup?: boolean;
  /** 群組外框與內部節點之間的邊距。 */
  groupPadding?: number;
  /** 群組外框頂端讓給標題的高度。 */
  groupHeaderHeight?: number;
  /** 群組區塊之間的間距。 */
  groupGap?: number;
}

export interface PositionedNode extends Rect {
  id: TableId;
  /** 所屬層（除錯與測試用） */
  layer: number;
}

export interface PositionedGraph {
  nodes: readonly PositionedNode[];
  positionById: ReadonlyMap<TableId, PositionedNode>;
  bounds: Rect;
  /** 群組名稱 → 外框矩形（已含邊距與標題高度）。 */
  groupBounds: ReadonlyMap<string, Rect>;
}

/**
 * Layout Engine 契約。
 * 換 ELK / Dagre 只需要換一個實作，Renderer 與 Extension 都不需要改。
 */
export interface LayoutEngine {
  readonly name: string;
  layout(input: LayoutInput, options?: LayoutOptions): PositionedGraph;
}
