import type { TableId } from "@schemalens/schema-core";
import { getRelatedTables, type SchemaGraph } from "@schemalens/schema-graph";
import type { ViewState } from "./viewState.js";

export type TableEmphasis = "selected" | "active" | "dimmed" | "hidden";
export type EdgeEmphasis = "highlight" | "normal" | "dimmed" | "hidden";

export interface VisibilityResult {
  tables: ReadonlyMap<TableId, TableEmphasis>;
  edges: ReadonlyMap<string, EdgeEmphasis>;
  /** 有 focus 時，相關 table 的數量（含自己），給 toolbar 顯示。 */
  relatedCount: number;
}

/**
 * Focus / Dim / Hide / Edge Highlight 的唯一決策點。
 *
 * Traversal 交給 schema-graph（約束 #7），這裡只把結果翻譯成視覺強調層級，
 * DOM 那一層則完全不做判斷、只套 class。
 */
export function resolveVisibility(graph: SchemaGraph, state: ViewState): VisibilityResult {
  const tables = new Map<TableId, TableEmphasis>();
  const edges = new Map<string, EdgeEmphasis>();
  const focusId = state.focus.tableId;

  if (!focusId || !graph.outgoing.has(focusId)) {
    for (const id of graph.tableIds) tables.set(id, "active");
    for (const edge of graph.edges) edges.set(edge.id, "normal");
    return { tables, edges, relatedCount: graph.tableIds.length };
  }

  const related = getRelatedTables(graph, focusId, {
    // depth: null = All，用 table 數當上限即可涵蓋整個連通元件。
    depth: state.focus.depth ?? graph.tableIds.length,
    direction: state.focus.direction,
  });

  const unrelatedTable: TableEmphasis = state.unrelated === "hide" ? "hidden" : "dimmed";
  const unrelatedEdge: EdgeEmphasis = state.unrelated === "hide" ? "hidden" : "dimmed";

  for (const id of graph.tableIds) {
    if (id === focusId) tables.set(id, "selected");
    else if (related.tables.has(id)) tables.set(id, "active");
    else tables.set(id, unrelatedTable);
  }

  for (const edge of graph.edges) {
    const bothVisible = related.tables.has(edge.source) && related.tables.has(edge.target);
    if (!bothVisible) {
      edges.set(edge.id, unrelatedEdge);
      continue;
    }
    // 直接接在焦點表上的線要更明顯，避免大量 relation 仍然形成雜訊（plan §27）。
    const touchesFocus = edge.source === focusId || edge.target === focusId;
    edges.set(edge.id, touchesFocus ? "highlight" : "normal");
  }

  return { tables, edges, relatedCount: related.tables.size };
}
