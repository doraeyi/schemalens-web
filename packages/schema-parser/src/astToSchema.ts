import {
  DEFAULT_SCHEMA_NAME,
  SCHEMA_VERSION,
  deriveColumnFlags,
  makeTableId,
  type Cardinality,
  type Column,
  type Index,
  type Relation,
  type Schema,
  type SchemaDiagnostic,
  type Table,
} from "@schemalens/schema-core";
import type { ColumnNode, QualifiedNameNode, SchemaFileNode, TypeRefNode } from "./ast.js";

export interface AstToSchemaResult {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
}

export interface AstToSchemaOptions {
  defaultSchema?: string;
  schemaName?: string;
}

/**
 * AST → Schema Domain Model。
 *
 * 這一步只處理「結構上無法同時存在」的問題：重複的 Table / Column / Index 名稱，
 * 以及 index 掛在不存在的 Table 上——因為這些情況一旦收斂進 Model 就再也看不出來了。
 * 參照類的檢查（relation 指向不存在的欄位、composite 數量不符…）留給 Validator。
 */
export function astToSchema(ast: SchemaFileNode, options: AstToSchemaOptions = {}): AstToSchemaResult {
  const defaultSchema = options.defaultSchema ?? DEFAULT_SCHEMA_NAME;
  const diagnostics: SchemaDiagnostic[] = [];
  const tables: Table[] = [];
  const tableById = new Map<string, Table>();
  const relations: Relation[] = [];
  const relationNames = new Set<string>();

  const resolveId = (name: QualifiedNameNode): string =>
    makeTableId(name.schema ?? defaultSchema, name.name);

  for (const statement of ast.statements) {
    if (statement.kind !== "table") continue;

    const id = resolveId(statement.name);
    const existing = tableById.get(id);
    if (existing) {
      diagnostics.push({
        code: "SCHEMA_DUPLICATE_TABLE",
        severity: "error",
        message: `Table 重複定義：${id}`,
        location: statement.location,
      });
      continue;
    }

    const columns: Column[] = [];
    const seenColumns = new Set<string>();
    for (const node of statement.columns) {
      if (seenColumns.has(node.name)) {
        diagnostics.push({
          code: "SCHEMA_DUPLICATE_COLUMN",
          severity: "error",
          message: `Column 重複定義：${id}.${node.name}`,
          location: node.location,
        });
        continue;
      }
      seenColumns.add(node.name);
      columns.push(toColumn(node));
    }

    const table: Table = {
      id,
      schema: statement.name.schema ?? defaultSchema,
      name: statement.name.name,
      comment: statement.comment,
      columns,
      indexes: [],
      location: statement.location,
    };
    tables.push(table);
    tableById.set(id, table);
  }

  for (const statement of ast.statements) {
    if (statement.kind !== "index") continue;

    const id = resolveId(statement.table);
    const table = tableById.get(id);
    if (!table) {
      diagnostics.push({
        code: "SCHEMA_UNKNOWN_TABLE",
        severity: "error",
        message: `index ${statement.name} 掛在不存在的 Table：${id}`,
        location: statement.location,
      });
      continue;
    }
    if (table.indexes.some((index) => index.name === statement.name)) {
      diagnostics.push({
        code: "SCHEMA_DUPLICATE_INDEX",
        severity: "error",
        message: `Index 重複定義：${statement.name}`,
        location: statement.location,
      });
      continue;
    }

    const index: Index = {
      name: statement.name,
      columns: statement.columns,
      unique: statement.unique,
      location: statement.location,
    };
    table.indexes.push(index);
  }

  for (const statement of ast.statements) {
    if (statement.kind !== "relation") continue;
    if (relationNames.has(statement.name)) {
      diagnostics.push({
        code: "SCHEMA_INVALID_RELATION",
        severity: "error",
        message: `Relation 名稱重複：${statement.name}`,
        location: statement.location,
      });
      continue;
    }
    if (statement.mappings.length === 0) continue;

    const first = statement.mappings[0]!;
    const sourceTable = resolveId(first.source.table);
    const targetTable = resolveId(first.target.table);

    // 同一個 relation 區塊內的多行必須指向同一組 Table，否則無法收成一條 relation。
    const inconsistent = statement.mappings.find(
      (mapping) =>
        resolveId(mapping.source.table) !== sourceTable ||
        resolveId(mapping.target.table) !== targetTable,
    );
    if (inconsistent) {
      diagnostics.push({
        code: "SCHEMA_INVALID_COMPOSITE_RELATION",
        severity: "error",
        message: `relation ${statement.name} 的欄位對應必須指向同一組 Table`,
        location: inconsistent.location,
      });
      continue;
    }

    relationNames.add(statement.name);
    relations.push({
      name: statement.name,
      sourceTable,
      sourceColumns: statement.mappings.flatMap((mapping) => mapping.source.columns),
      targetTable,
      targetColumns: statement.mappings.flatMap((mapping) => mapping.target.columns),
      cardinality: toCardinality(first.sourceCardinality, first.targetCardinality),
      location: statement.location,
    });
  }

  const schema: Schema = {
    version: SCHEMA_VERSION,
    metadata: { name: options.schemaName, defaultSchema },
    tables,
    relations,
  };
  // FK / indexed 旗標由 relation 與 index 推導，DSL 上的 FK/IDX 標記只是額外提示。
  const declaredFlags = collectDeclaredFlags(ast, resolveId);
  deriveColumnFlags(schema);
  applyDeclaredFlags(schema, declaredFlags);

  return { schema, diagnostics };
}

function toColumn(node: ColumnNode): Column {
  const flags = new Set(node.flags);
  const primaryKey = flags.has("PK");
  const { length, precision, scale } = splitTypeArgs(node.type);

  return {
    name: node.name,
    type: node.type.name,
    length,
    precision,
    scale,
    // 規格：PK 隱含 not null；其餘未標示時預設可為空。
    nullable: primaryKey ? false : (node.nullable ?? true),
    defaultValue: node.defaultValue,
    comment: node.comment,
    primaryKey,
    foreignKey: flags.has("FK"),
    unique: flags.has("UQ"),
    indexed: flags.has("IDX"),
    location: node.location,
  };
}

/** 一個參數 = length；兩個參數 = precision, scale。 */
function splitTypeArgs(type: TypeRefNode): {
  length?: number;
  precision?: number;
  scale?: number;
} {
  if (type.args.length === 1) return { length: type.args[0] };
  if (type.args.length >= 2) return { precision: type.args[0], scale: type.args[1] };
  return {};
}

function toCardinality(source: string, target: string): Cardinality {
  const many = (value: string): boolean => value === "N" || value === "M";
  if (many(source) && many(target)) return "N:M";
  if (many(source)) return "N:1";
  if (many(target)) return "1:N";
  return "1:1";
}

/** DSL 上手寫的 FK / IDX 標記，避免 deriveColumnFlags 把它們清掉。 */
function collectDeclaredFlags(
  ast: SchemaFileNode,
  resolveId: (name: QualifiedNameNode) => string,
): Map<string, { foreignKey: boolean; indexed: boolean }> {
  const declared = new Map<string, { foreignKey: boolean; indexed: boolean }>();
  for (const statement of ast.statements) {
    if (statement.kind !== "table") continue;
    const id = resolveId(statement.name);
    for (const column of statement.columns) {
      const flags = new Set(column.flags);
      if (!flags.has("FK") && !flags.has("IDX")) continue;
      declared.set(`${id}.${column.name}`, {
        foreignKey: flags.has("FK"),
        indexed: flags.has("IDX"),
      });
    }
  }
  return declared;
}

function applyDeclaredFlags(
  schema: Schema,
  declared: ReadonlyMap<string, { foreignKey: boolean; indexed: boolean }>,
): void {
  for (const table of schema.tables) {
    for (const column of table.columns) {
      const flags = declared.get(`${table.id}.${column.name}`);
      if (!flags) continue;
      column.foreignKey ||= flags.foreignKey;
      column.indexed ||= flags.indexed;
    }
  }
}
