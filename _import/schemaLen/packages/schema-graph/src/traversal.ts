import type { TableId } from "@schemalens/schema-core";
import type { GraphEdge, SchemaGraph } from "./graph.js";

export type TraversalDirection = "all" | "upstream" | "downstream";

export interface TraversalOptions {
  /** 1 = 1-Hop、2 = 2-Hop。MVP 只需要 1 / 2，但實作不設上限。 */
  depth?: number;
  direction?: TraversalDirection;
}

export interface RelatedSet {
  /** 起點（含自己） */
  root: TableId;
  /** tableId → 距離（root = 0） */
  distance: ReadonlyMap<TableId, number>;
  /** 含 root 的相關 table 集合 */
  tables: ReadonlySet<TableId>;
  /** 兩端都落在 tables 內、且實際被走過的 relation 集合 */
  relations: ReadonlySet<string>;
}

function step(graph: SchemaGraph, id: TableId, direction: TraversalDirection): GraphEdge[] {
  const out = graph.outgoing.get(id) ?? [];
  const inc = graph.incoming.get(id) ?? [];
  switch (direction) {
    case "upstream":
      return [...out];
    case "downstream":
      return [...inc];
    default:
      return [...out, ...inc];
  }
}

/**
 * BFS 取得相關 Table / Relation。
 * 這是 Focus / Dim / Hide / 1-Hop / 2-Hop 的唯一真實來源，Renderer 只呈現結果。
 */
export function getRelatedTables(
  graph: SchemaGraph,
  tableId: TableId,
  options: TraversalOptions = {},
): RelatedSet {
  const depth = options.depth ?? 1;
  const direction = options.direction ?? "all";

  const distance = new Map<TableId, number>();
  const relations = new Set<string>();
  const tables = new Set<TableId>();

  if (!graph.outgoing.has(tableId)) {
    return { root: tableId, distance, tables, relations };
  }

  distance.set(tableId, 0);
  tables.add(tableId);
  let frontier: TableId[] = [tableId];

  for (let d = 0; d < depth; d++) {
    const next: TableId[] = [];
    for (const current of frontier) {
      for (const edge of step(graph, current, direction)) {
        const other = edge.source === current ? edge.target : edge.source;
        relations.add(edge.id);
        if (!distance.has(other)) {
          distance.set(other, d + 1);
          tables.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  // 補上「兩端都在集合內」但因為 BFS 沒走到而漏掉的 edge，
  // 否則 Focus 後會出現兩張都顯示、線卻不見的破圖。
  for (const edge of graph.edges) {
    if (tables.has(edge.source) && tables.has(edge.target)) relations.add(edge.id);
  }

  return { root: tableId, distance, tables, relations };
}

/** 從多個起點聯集（例如 search 命中多張表時）。 */
export function getRelatedTablesForMany(
  graph: SchemaGraph,
  tableIds: readonly TableId[],
  options: TraversalOptions = {},
): { tables: ReadonlySet<TableId>; relations: ReadonlySet<string> } {
  const tables = new Set<TableId>();
  const relations = new Set<string>();
  for (const id of tableIds) {
    const result = getRelatedTables(graph, id, options);
    for (const t of result.tables) tables.add(t);
    for (const r of result.relations) relations.add(r);
  }
  return { tables, relations };
}
