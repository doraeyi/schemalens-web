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
}

/**
 * Layout Engine 契約。
 * 換 ELK / Dagre 只需要換一個實作，Renderer 與 Extension 都不需要改。
 */
export interface LayoutEngine {
  readonly name: string;
  layout(input: LayoutInput, options?: LayoutOptions): PositionedGraph;
}
