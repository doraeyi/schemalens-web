import { columnRef, type Schema, type TableId } from "@schemalens/schema-core";
import type { SchemaGraph } from "./graph.js";

/** `schema.table.column` */
export type ColumnRef = string;

export interface RelatedColumnSet {
  /** 起點欄位（含自己）。 */
  root: ColumnRef;
  /** 與起點透過 FK 串在一起的所有欄位。 */
  columns: ReadonlySet<ColumnRef>;
  /** 參與其中的 relation 名稱。 */
  relations: ReadonlySet<string>;
  /** 這些欄位分布在哪些 table。 */
  tables: ReadonlySet<TableId>;
}

export interface ColumnTraversalOptions {
  /**
   * 追幾層。預設無上限（追到整條 FK 鏈的盡頭）——
   * 點 Users.Id 時，使用者要看的就是「所有指向它的欄位」，
   * 而那些欄位可能又被別人指向。
   */
  depth?: number;
}

/**
 * 欄位級的關聯追蹤。
 *
 * 與 table 級 traversal 不同：這裡走的是 relation 內「第 i 個來源欄位 ↔ 第 i 個目標欄位」
 * 的對應，因此 composite FK 只會串起真正對應的那一組欄位，
 * 不會把整張表的欄位都算進來。
 *
 * 方向不限：從 FK 欄位往上找被參照的主鍵，或從主鍵往下找所有參照它的 FK，
 * 都是使用者想看的「這個欄位跟誰有關」。
 */
export function getRelatedColumns(
  schema: Schema,
  graph: SchemaGraph,
  tableId: TableId,
  column: string,
  options: ColumnTraversalOptions = {},
): RelatedColumnSet {
  const root = columnRef(tableId, column);
  const depth = options.depth ?? Number.POSITIVE_INFINITY;

  const columns = new Set<ColumnRef>();
  const relations = new Set<string>();
  const tables = new Set<TableId>();

  // 起點欄位不存在時回傳空集合，讓 UI 自己決定要不要提示（不丟例外）。
  const known = new Set(graph.tableIds);
  if (!known.has(tableId)) {
    return { root, columns, relations, tables };
  }

  columns.add(root);
  tables.add(tableId);

  // 欄位 → 直接對應的欄位（含所在的 relation）。
  const adjacency = new Map<ColumnRef, Array<{ ref: ColumnRef; relation: string }>>();
  const link = (a: ColumnRef, b: ColumnRef, relation: string): void => {
    const list = adjacency.get(a);
    if (list) list.push({ ref: b, relation });
    else adjacency.set(a, [{ ref: b, relation }]);
  };

  for (const relation of schema.relations) {
    if (!known.has(relation.sourceTable) || !known.has(relation.targetTable)) continue;
    // composite FK：只配對同一個索引位置的欄位。
    const pairs = Math.min(relation.sourceColumns.length, relation.targetColumns.length);
    for (let i = 0; i < pairs; i++) {
      const from = columnRef(relation.sourceTable, relation.sourceColumns[i]!);
      const to = columnRef(relation.targetTable, relation.targetColumns[i]!);
      link(from, to, relation.name);
      link(to, from, relation.name);
    }
  }

  let frontier: ColumnRef[] = [root];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: ColumnRef[] = [];
    for (const current of frontier) {
      for (const edge of adjacency.get(current) ?? []) {
        relations.add(edge.relation);
        if (columns.has(edge.ref)) continue;
        columns.add(edge.ref);
        tables.add(tableIdOf(edge.ref));
        next.push(edge.ref);
      }
    }
    frontier = next;
  }

  return { root, columns, relations, tables };
}

/** `dbo.Users.Id` → `dbo.Users` */
export function tableIdOf(ref: ColumnRef): TableId {
  const lastDot = ref.lastIndexOf(".");
  return lastDot < 0 ? ref : ref.slice(0, lastDot);
}

/** `dbo.Users.Id` → `Id` */
export function columnNameOf(ref: ColumnRef): string {
  const lastDot = ref.lastIndexOf(".");
  return lastDot < 0 ? ref : ref.slice(lastDot + 1);
}
