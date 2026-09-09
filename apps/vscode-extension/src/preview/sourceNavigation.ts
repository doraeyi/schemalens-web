import type { Schema, SourceLocation } from "@schemalens/schema-core";

export interface SourceTarget {
  tableId: string;
  column?: string;
}

/**
 * 從 Preview 的點擊目標找出 DSL 位置（US9 / AC-17）。
 *
 * 找欄位失敗時退回該 Table 的定義位置——跳到「大概對的地方」
 * 仍然比什麼都不做有用。
 */
export function findSourceLocation(schema: Schema, target: SourceTarget): SourceLocation | undefined {
  const table = schema.tables.find((candidate) => candidate.id === target.tableId);
  if (!table) return undefined;

  if (target.column) {
    const column = table.columns.find((candidate) => candidate.name === target.column);
    if (column?.location) return column.location;
  }
  return table.location;
}

/** Relation 的定義位置，供 Edge 的 Open Source 使用。 */
export function findRelationLocation(schema: Schema, relationName: string): SourceLocation | undefined {
  return schema.relations.find((relation) => relation.name === relationName)?.location;
}
