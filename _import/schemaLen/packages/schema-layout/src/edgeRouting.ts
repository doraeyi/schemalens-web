import type { Point, Rect } from "./types.js";

export type AnchorSide = "left" | "right";

export interface EdgeAnchor {
  /** 節點外框，用來決定要從哪一側出線。 */
  node: Rect;
  /** 欄位 Row 的垂直中心（絕對座標）。Collapse / Overview 時退回卡片中心。 */
  rowCenterY: number;
}

export interface RoutedEdge {
  from: Point;
  to: Point;
  /** 三次貝茲控制點，畫成平滑的側向連線。 */
  c1: Point;
  c2: Point;
  fromSide: AnchorSide;
  toSide: AnchorSide;
  /** Cardinality 標籤的建議位置。 */
  fromLabel: Point;
  toLabel: Point;
}

/**
 * 欄位級 Relation Edge 的路徑計算。
 *
 * 純幾何，不碰 DOM，因此可單元測試，也能被別的 Renderer 重用。
 * 呼叫端負責量測 Row 的實際位置後傳進來（plan §20：線要連到 Column Row）。
 */
export function routeEdge(source: EdgeAnchor, target: EdgeAnchor, labelOffset = 14): RoutedEdge {
  const sourceCenterX = source.node.x + source.node.width / 2;
  const targetCenterX = target.node.x + target.node.width / 2;

  // 兩張卡片誰在右邊，就從那一側出線，避免線穿過卡片本體。
  const sourceOnLeft = sourceCenterX <= targetCenterX;
  const fromSide: AnchorSide = sourceOnLeft ? "right" : "left";
  const toSide: AnchorSide = sourceOnLeft ? "left" : "right";

  const from: Point = {
    x: fromSide === "right" ? source.node.x + source.node.width : source.node.x,
    y: source.rowCenterY,
  };
  const to: Point = {
    x: toSide === "right" ? target.node.x + target.node.width : target.node.x,
    y: target.rowCenterY,
  };

  // 控制點的水平伸出量隨距離增加，短距離時不會過度膨脹。
  const dx = Math.abs(to.x - from.x);
  const reach = Math.max(32, Math.min(dx * 0.5, 180));
  const c1: Point = { x: from.x + (fromSide === "right" ? reach : -reach), y: from.y };
  const c2: Point = { x: to.x + (toSide === "right" ? reach : -reach), y: to.y };

  return {
    from,
    to,
    c1,
    c2,
    fromSide,
    toSide,
    fromLabel: { x: from.x + (fromSide === "right" ? labelOffset : -labelOffset), y: from.y - 6 },
    toLabel: { x: to.x + (toSide === "right" ? labelOffset : -labelOffset), y: to.y - 6 },
  };
}

export function toSvgPath(edge: RoutedEdge): string {
  return `M ${edge.from.x} ${edge.from.y} C ${edge.c1.x} ${edge.c1.y}, ${edge.c2.x} ${edge.c2.y}, ${edge.to.x} ${edge.to.y}`;
}
