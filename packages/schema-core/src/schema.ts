import {
  DEFAULT_SCHEMA_NAME,
  SCHEMA_VERSION,
  type Column,
  type Relation,
  type Schema,
  type Table,
  type TableId,
} from "./model.js";

export function makeTableId(schema: string, name: string): TableId {
  return `${schema}.${name}`;
}

export function parseTableId(id: TableId): { schema: string; name: string } {
  const dot = id.indexOf(".");
  if (dot < 0) return { schema: DEFAULT_SCHEMA_NAME, name: id };
  return { schema: id.slice(0, dot), name: id.slice(dot + 1) };
}

export function emptySchema(name?: string): Schema {
  return {
    version: SCHEMA_VERSION,
    metadata: { name, defaultSchema: DEFAULT_SCHEMA_NAME },
    tables: [],
    relations: [],
  };
}

/** O(1) 查表用的索引；Graph / Renderer / Validator 共用，避免各自做線性搜尋。 */
export interface SchemaIndex {
  tableById: ReadonlyMap<TableId, Table>;
  columnByRef: ReadonlyMap<string, Column>;
  relationByName: ReadonlyMap<string, Relation>;
}

export function columnRef(tableId: TableId, column: string): string {
  return `${tableId}.${column}`;
}

export function indexSchema(schema: Schema): SchemaIndex {
  const tableById = new Map<TableId, Table>();
  const columnByRef = new Map<string, Column>();
  const relationByName = new Map<string, Relation>();

  for (const table of schema.tables) {
    tableById.set(table.id, table);
    for (const column of table.columns) {
      columnByRef.set(columnRef(table.id, column.name), column);
    }
  }
  for (const relation of schema.relations) {
    relationByName.set(relation.name, relation);
  }
  return { tableById, columnByRef, relationByName };
}

/** 標記 FK / indexed 等由 relation & index 推導出來的欄位旗標。 */
export function deriveColumnFlags(schema: Schema): void {
  const index = indexSchema(schema);
  for (const table of schema.tables) {
    const indexed = new Set<string>();
    for (const idx of table.indexes) {
      for (const c of idx.columns) indexed.add(c);
    }
    for (const column of table.columns) {
      column.indexed = indexed.has(column.name);
      column.foreignKey = false;
    }
  }
  for (const relation of schema.relations) {
    for (const name of relation.sourceColumns) {
      const column = index.columnByRef.get(columnRef(relation.sourceTable, name));
      if (column) column.foreignKey = true;
    }
  }
}
