import type { Relation, TableId } from "@schemalens/schema-core";
import type { PositionedNode } from "@schemalens/schema-layout";
import { routeEdge, toSvgPath, type RoutedEdge } from "@schemalens/schema-layout";
import { rowCenterOffset, type CardModel } from "./cardModel.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface EdgeElements {
  root: SVGGElement;
  /** 透明的粗線，負責點擊命中。 */
  hit: SVGPathElement;
  /** 背景色底線，讓線經過卡片時仍看得清楚。 */
  halo: SVGPathElement;
  path: SVGPathElement;
  sourceLabel: SVGTextElement;
  targetLabel: SVGTextElement;
}

/** Cardinality 兩端各自的標記，例如 N:1 → source 端 N、target 端 1。 */
export function cardinalityEnds(relation: Relation): { source: string; target: string } {
  const [source = "N", target = "1"] = relation.cardinality.split(":");
  return { source, target };
}

/**
 * 計算一條 Relation 的欄位級路徑。
 *
 * 錨點取的是實際 Column Row 的中心（約束 #17）；
 * 當該欄位在目前檢視被隱藏（Overview / Collapse / Keys），
 * rowCenterOffset 會退回卡片中心，線不會斷掉。
 */
export function routeRelation(
  relation: Relation,
  cards: ReadonlyMap<TableId, CardModel>,
  positions: ReadonlyMap<TableId, PositionedNode>,
): RoutedEdge | null {
  const sourceCard = cards.get(relation.sourceTable);
  const targetCard = cards.get(relation.targetTable);
  const sourcePos = positions.get(relation.sourceTable);
  const targetPos = positions.get(relation.targetTable);
  if (!sourceCard || !targetCard || !sourcePos || !targetPos) return null;

  // Composite FK 第一版共用一條線，以第一個欄位當錨點（plan §20）。
  const sourceColumn = relation.sourceColumns[0] ?? "";
  const targetColumn = relation.targetColumns[0] ?? "";

  return routeEdge(
    { node: sourcePos, rowCenterY: sourcePos.y + rowCenterOffset(sourceCard, sourceColumn) },
    { node: targetPos, rowCenterY: targetPos.y + rowCenterOffset(targetCard, targetColumn) },
  );
}

export function renderEdge(relation: Relation, routed: RoutedEdge): EdgeElements {
  const root = document.createElementNS(SVG_NS, "g");
  root.setAttribute("class", "dbs-edge");
  root.dataset.relation = relation.name;

  const d = toSvgPath(routed);

  // 透明的粗線負責點擊命中，視覺線才能保持細。
  const hit = document.createElementNS(SVG_NS, "path");
  hit.setAttribute("class", "dbs-edge-hit");
  hit.setAttribute("d", d);

  // 背景色的粗底線：線經過卡片時會留下一圈空隙，兩者才都看得清楚。
  const halo = document.createElementNS(SVG_NS, "path");
  halo.setAttribute("class", "dbs-edge-halo");
  halo.setAttribute("d", d);

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", "dbs-edge-path");
  path.setAttribute("d", d);

  const ends = cardinalityEnds(relation);
  const sourceLabel = document.createElementNS(SVG_NS, "text");
  sourceLabel.setAttribute("class", "dbs-edge-label");
  sourceLabel.setAttribute("x", String(routed.fromLabel.x));
  sourceLabel.setAttribute("y", String(routed.fromLabel.y));
  sourceLabel.setAttribute("text-anchor", routed.fromSide === "right" ? "start" : "end");
  sourceLabel.textContent = ends.source;

  const targetLabel = document.createElementNS(SVG_NS, "text");
  targetLabel.setAttribute("class", "dbs-edge-label");
  targetLabel.setAttribute("x", String(routed.toLabel.x));
  targetLabel.setAttribute("y", String(routed.toLabel.y));
  targetLabel.setAttribute("text-anchor", routed.toSide === "right" ? "start" : "end");
  targetLabel.textContent = ends.target;

  root.append(hit, halo, path, sourceLabel, targetLabel);
  return { root, hit, halo, path, sourceLabel, targetLabel };
}

/**
 * 就地更新一條線的幾何。
 *
 * 拖曳卡片時只會動到相鄰的幾條線，重建整層 SVG 太浪費；
 * 直接改屬性可以讓 200 張表的拖曳仍然跟手。
 */
export function updateEdgeGeometry(
  elements: EdgeElements,
  relation: Relation,
  routed: RoutedEdge,
): void {
  const d = toSvgPath(routed);
  elements.hit.setAttribute("d", d);
  elements.halo.setAttribute("d", d);
  elements.path.setAttribute("d", d);

  elements.sourceLabel.setAttribute("x", String(routed.fromLabel.x));
  elements.sourceLabel.setAttribute("y", String(routed.fromLabel.y));
  elements.sourceLabel.setAttribute("text-anchor", routed.fromSide === "right" ? "start" : "end");

  elements.targetLabel.setAttribute("x", String(routed.toLabel.x));
  elements.targetLabel.setAttribute("y", String(routed.toLabel.y));
  elements.targetLabel.setAttribute("text-anchor", routed.toSide === "right" ? "start" : "end");

  const ends = cardinalityEnds(relation);
  elements.sourceLabel.textContent = ends.source;
  elements.targetLabel.textContent = ends.target;
}

/** Hover / Click 時要顯示的完整欄位對應（plan §20）。 */
export function describeRelation(relation: Relation): string {
  const pairs = relation.sourceColumns.map(
    (column, i) =>
      `${relation.sourceTable}.${column} → ${relation.targetTable}.${relation.targetColumns[i] ?? "?"}`,
  );
  return `${relation.name}\n${pairs.join("\n")}\nCardinality: ${relation.cardinality}`;
}
