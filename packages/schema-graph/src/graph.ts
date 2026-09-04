import type { Relation, Schema, TableId } from "@schemalens/schema-core";

/**
 * Relation Graph。
 *
 * 方向定義（見 plan §23）：
 *   FK Source ──> Referenced Target
 *   Posts.AuthorId ──> Users.Id
 *
 * 因此對 Posts 而言 Users 是 upstream（被參照者），
 * 對 Users 而言 Posts 是 downstream（參照者）。
 */
export interface GraphEdge {
  /** relation.name；同名 relation 在 validator 會被擋掉。 */
  id: string;
  relation: Relation;
  source: TableId;
  target: TableId;
}

export interface SchemaGraph {
  tableIds: readonly TableId[];
  edges: readonly GraphEdge[];
  /** table → 由它出發（它持有 FK）的 edges */
  outgoing: ReadonlyMap<TableId, readonly GraphEdge[]>;
  /** table → 指向它（它被參照）的 edges */
  incoming: ReadonlyMap<TableId, readonly GraphEdge[]>;
}

export function buildGraph(schema: Schema): SchemaGraph {
  const tableIds = schema.tables.map((t) => t.id);
  const known = new Set(tableIds);
  const outgoing = new Map<TableId, GraphEdge[]>();
  const incoming = new Map<TableId, GraphEdge[]>();
  for (const id of tableIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }

  const edges: GraphEdge[] = [];
  for (const relation of schema.relations) {
    // Graph 只處理兩端都存在的 relation；缺表由 Validator 報錯，不在這裡丟例外。
    if (!known.has(relation.sourceTable) || !known.has(relation.targetTable)) continue;
    const edge: GraphEdge = {
      id: relation.name,
      relation,
      source: relation.sourceTable,
      target: relation.targetTable,
    };
    edges.push(edge);
    outgoing.get(edge.source)!.push(edge);
    incoming.get(edge.target)!.push(edge);
  }

  return { tableIds, edges, outgoing, incoming };
}
