import type { Schema, TableId } from "@schemalens/schema-core";
import { getRelatedColumns, getRelatedTables, type SchemaGraph } from "@schemalens/schema-graph";
import type { ViewState } from "./viewState.js";

/**
 * `active` 是「沒有聚焦時的常態」；`related` 是「因為聚焦而被點亮」。
 * 兩者分開，Renderer 才能給相關表正向的視覺標示，
 * 而不是只讓其他表變暗、相關表看起來與平常無異。
 */
export type TableEmphasis = "selected" | "related" | "active" | "dimmed" | "hidden" | "filtered";
export type EdgeEmphasis = "highlight" | "normal" | "dimmed" | "hidden" | "filtered";

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
export function resolveVisibility(
  graph: SchemaGraph,
  state: ViewState,
  schema?: Schema,
): VisibilityResult {
  const tables = new Map<TableId, TableEmphasis>();
  const edges = new Map<string, EdgeEmphasis>();
  const focusId = state.focus.tableId;

  // 群組篩選是先於 Focus 的一層過濾：不在群組內的表無論如何都不強調。
  const inFilter = (id: TableId): boolean => {
    if (!state.groupFilter || !schema) return true;
    const table = schema.tables.find((candidate) => candidate.id === id);
    return table?.group === state.groupFilter;
  };

  const unrelatedTable: TableEmphasis = state.unrelated === "hide" ? "hidden" : "dimmed";
  const unrelatedEdge: EdgeEmphasis = state.unrelated === "hide" ? "hidden" : "dimmed";

  // 欄位聚焦啟用時，強調**完全由欄位決定**。
  //
  // 否則會出現：焦點表在表層級有一堆鄰居，那些鄰居跟著亮起來，
  // 但它們與使用者剛點的欄位毫無關係——畫面說「這些有關」，其實沒有。
  // 欄位聚焦是比表更細的鏡頭，啟用時就該由它說了算。
  const columnFocus = state.columnFocus;
  if (columnFocus && schema) {
    const related = getRelatedColumns(schema, graph, columnFocus.tableId, columnFocus.column);

    for (const id of graph.tableIds) {
      if (!inFilter(id)) tables.set(id, "filtered");
      else if (id === columnFocus.tableId) tables.set(id, "selected");
      else if (related.tables.has(id)) tables.set(id, "related");
      else tables.set(id, unrelatedTable);
    }

    for (const edge of graph.edges) {
      if (!inFilter(edge.source) || !inFilter(edge.target)) edges.set(edge.id, "filtered");
      else if (related.relations.has(edge.id)) edges.set(edge.id, "highlight");
      else edges.set(edge.id, unrelatedEdge);
    }

    return { tables, edges, relatedCount: related.tables.size };
  }

  if (!focusId || !graph.outgoing.has(focusId)) {
    for (const id of graph.tableIds) tables.set(id, inFilter(id) ? "active" : "filtered");
    for (const edge of graph.edges) {
      edges.set(edge.id, inFilter(edge.source) && inFilter(edge.target) ? "normal" : "filtered");
    }
    return {
      tables,
      edges,
      relatedCount: graph.tableIds.filter(inFilter).length,
    };
  }

  const related = getRelatedTables(graph, focusId, {
    // depth: null = All，用 table 數當上限即可涵蓋整個連通元件。
    depth: state.focus.depth ?? graph.tableIds.length,
    direction: state.focus.direction,
  });

  for (const id of graph.tableIds) {
    if (!inFilter(id)) tables.set(id, "filtered");
    else if (id === focusId) tables.set(id, "selected");
    else if (related.tables.has(id)) tables.set(id, "related");
    else tables.set(id, unrelatedTable);
  }

  for (const edge of graph.edges) {
    if (!inFilter(edge.source) || !inFilter(edge.target)) {
      edges.set(edge.id, "filtered");
      continue;
    }
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
