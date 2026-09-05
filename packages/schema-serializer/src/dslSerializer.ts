import type { Column, Relation, Schema, Table } from "@schemalens/schema-core";

export interface DslSerializeOptions {
  /** 縮排空白數。 */
  indent?: number;
  /** 是否把欄位的名稱／型別對齊成欄狀，預設開啟（可讀性優先）。 */
  align?: boolean;
}

/**
 * Schema → DSL。
 *
 * Deterministic：固定的語句順序（table → index → relation）、固定縮排、
 * 一律寫出明確的 nullability，因此同一份 Schema 永遠序列化成同一段文字，
 * git diff 才有意義（plan §36）。
 */
export function toDsl(schema: Schema, options: DslSerializeOptions = {}): string {
  const indent = " ".repeat(options.indent ?? 2);
  const align = options.align ?? true;
  const lines: string[] = [];

  // 群組宣告放在最前面：描述集中在一處，成員關係則寫在各自的 table 上，
  // 這樣重新解析後兩者不會互相矛盾。
  for (const group of schema.groups ?? []) {
    lines.push(
      group.description
        ? `group ${group.name} ${quote(group.description)}`
        : `group ${group.name}`,
    );
  }
  // 只被 table 引用、沒有正式宣告的群組不需要補宣告——
  // `table X in G` 本身已經足以表達。
  if ((schema.groups ?? []).length > 0) lines.push("");

  for (const table of schema.tables) {
    lines.push(...serializeTable(table, indent, align), "");
  }

  const indexLines = schema.tables.flatMap((table) =>
    table.indexes.map((index) => {
      const prefix = index.unique ? "unique index" : "index";
      return `${prefix} ${index.name} on ${qualified(table)}(${index.columns.join(", ")})`;
    }),
  );
  if (indexLines.length > 0) lines.push(...indexLines, "");

  for (const relation of schema.relations) {
    lines.push(...serializeRelation(relation, indent), "");
  }

  // 移除結尾多餘空行，並保證檔案以單一換行結束。
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

function serializeTable(table: Table, indent: string, align: boolean): string[] {
  const headerParts = [`table ${qualified(table)}`];
  if (table.comment) headerParts.push(quote(table.comment));
  if (table.group) headerParts.push(`in ${table.group}`);
  const header = `${headerParts.join(" ")} {`;

  const parts = table.columns.map((column) => columnParts(column));
  const widths = align
    ? {
        flags: max(parts.map((part) => part.flags.length)),
        name: max(parts.map((part) => part.name.length)),
        type: max(parts.map((part) => part.type.length)),
        nullability: max(parts.map((part) => part.nullability.length)),
      }
    : { flags: 0, name: 0, type: 0, nullability: 0 };

  const body = parts.map((part) => {
    const segments = [
      part.flags.padEnd(widths.flags),
      part.name.padEnd(widths.name),
      part.type.padEnd(widths.type),
      part.nullability.padEnd(part.tail ? widths.nullability : 0),
    ];
    if (part.tail) segments.push(part.tail);
    return `${indent}${segments.join(" ").trimEnd()}`;
  });

  return [header, ...body, "}"];
}

interface ColumnParts {
  flags: string;
  name: string;
  type: string;
  nullability: string;
  tail: string;
}

function columnParts(column: Column): ColumnParts {
  const flags: string[] = [];
  if (column.primaryKey) flags.push("PK");
  if (column.foreignKey) flags.push("FK");
  if (column.unique && !column.primaryKey) flags.push("UQ");
  // IDX 只在沒有其他標記時才寫出來，避免 PK/UQ 欄位重複標示。
  if (column.indexed && flags.length === 0) flags.push("IDX");

  const tail: string[] = [];
  if (column.defaultValue !== undefined) tail.push(`default ${serializeDefault(column.defaultValue)}`);
  if (column.comment) tail.push(quote(column.comment));

  return {
    flags: flags.join(" "),
    name: column.name,
    type: serializeType(column),
    nullability: column.nullable ? "null" : "not null",
    tail: tail.join(" "),
  };
}

function serializeType(column: Column): string {
  if (column.length !== undefined) return `${column.type}(${column.length})`;
  if (column.precision !== undefined) {
    return column.scale !== undefined
      ? `${column.type}(${column.precision},${column.scale})`
      : `${column.type}(${column.precision})`;
  }
  return column.type;
}

/**
 * 數值原樣輸出；其餘一律加引號。
 * `sysutcdatetime()` 這種帶括號的預設值不加引號會解析失敗。
 */
function serializeDefault(value: string): string {
  return /^[0-9]+$/.test(value) ? value : quote(value);
}

function serializeRelation(relation: Relation, indent: string): string[] {
  const [source = "N", target = "1"] = relation.cardinality.split(":");
  const sourceRef = columnRef(relation.sourceTable, relation.sourceColumns);
  const targetRef = columnRef(relation.targetTable, relation.targetColumns);
  return [
    `relation ${relation.name} {`,
    `${indent}${sourceRef} ${source} -> ${target === "M" ? "N" : target} ${targetRef}`,
    "}",
  ];
}

/** 單欄寫成 `Table.Column`，composite 寫成 `Table.(A, B)`。 */
function columnRef(tableId: string, columns: readonly string[]): string {
  if (columns.length === 1) return `${tableId}.${columns[0]}`;
  return `${tableId}.(${columns.join(", ")})`;
}

function qualified(table: Table): string {
  return table.id;
}

function quote(text: string): string {
  return `"${text.replace(/"/g, '\\"')}"`;
}

function max(values: number[]): number {
  return values.reduce((longest, value) => Math.max(longest, value), 0);
}
