import type { Column, Relation, Schema, SourceComments, Table } from "@schemalens/schema-core";

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
      ...leadingLines(group.sourceComments, ""),
      withTrailing(
        group.description ? `group ${group.name} ${quote(group.description)}` : `group ${group.name}`,
        group.sourceComments,
      ),
    );
  }
  // 只被 table 引用、沒有正式宣告的群組不需要補宣告——
  // `table X in G` 本身已經足以表達。
  if ((schema.groups ?? []).length > 0) lines.push("");

  const tableById = new Map(schema.tables.map((table) => [table.id, table]));
  const ref = (tableId: string): string => {
    const table = tableById.get(tableId);
    return table ? qualified(table) : tableId;
  };

  for (const table of schema.tables) {
    lines.push(...serializeTable(table, indent, align), "");
  }

  const indexLines = schema.tables.flatMap((table) =>
    table.indexes.flatMap((index) => {
      const prefix = index.unique ? "unique index" : "index";
      return [
        ...leadingLines(index.sourceComments, ""),
        withTrailing(`${prefix} ${index.name} on ${qualified(table)}(${index.columns.join(", ")})`, index.sourceComments),
      ];
    }),
  );
  if (indexLines.length > 0) lines.push(...indexLines, "");

  for (const relation of schema.relations) {
    lines.push(...serializeRelation(relation, indent, ref), "");
  }

  for (const text of schema.trailingComments ?? []) lines.push(`//${text}`);

  // 移除結尾多餘空行，並保證檔案以單一換行結束。
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

function serializeTable(table: Table, indent: string, align: boolean): string[] {
  const headerParts = [`table ${qualified(table)}`];
  if (table.comment) headerParts.push(quote(table.comment));
  if (table.group) headerParts.push(`in ${table.group}`);
  const header = withTrailing(`${headerParts.join(" ")} {`, table.sourceComments);

  const parts = table.columns.map((column) => columnParts(column));
  const widths = align
    ? {
        flags: max(parts.map((part) => part.flags.length)),
        name: max(parts.map((part) => part.name.length)),
        type: max(parts.map((part) => part.type.length)),
        nullability: max(parts.map((part) => part.nullability.length)),
      }
    : { flags: 0, name: 0, type: 0, nullability: 0 };

  const columnLines = parts.map((part) => {
    const segments = [
      part.flags.padEnd(widths.flags),
      part.name.padEnd(widths.name),
      part.type.padEnd(widths.type),
      part.nullability.padEnd(part.tail ? widths.nullability : 0),
    ];
    if (part.tail) segments.push(part.tail);
    return `${indent}${segments.join(" ").trimEnd()}`;
  });

  // 行尾註解也對齊成一欄，跟欄位定義的對齊風格一致。
  const commentColumn = align ? max(columnLines.map((line) => line.length)) : 0;
  const body = table.columns.flatMap((column, i) => {
    const definition = columnLines[i] ?? "";
    const trailing = column.sourceComments?.trailing;
    const line = trailing === undefined ? definition : `${definition.padEnd(commentColumn)} //${trailing}`;
    return [...leadingLines(column.sourceComments, indent), line];
  });
  const footer = (table.sourceComments?.footer ?? []).map((text) => `${indent}//${text}`);

  return [...leadingLines(table.sourceComments, ""), header, ...body, ...footer, "}"];
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

function serializeRelation(relation: Relation, indent: string, ref: (tableId: string) => string): string[] {
  const [source = "N", target = "1"] = relation.cardinality.split(":");
  const sourceRef = columnRef(ref(relation.sourceTable), relation.sourceColumns);
  const targetRef = columnRef(ref(relation.targetTable), relation.targetColumns);
  return [
    ...leadingLines(relation.sourceComments, ""),
    withTrailing(`relation ${relation.name} {`, relation.sourceComments),
    `${indent}${sourceRef} ${source} -> ${target === "M" ? "N" : target} ${targetRef}`,
    "}",
  ];
}

/** 單欄寫成 `Table.Column`，composite 寫成 `Table.(A, B)`。 */
function columnRef(tableId: string, columns: readonly string[]): string {
  if (columns.length === 1) return `${tableId}.${columns[0]}`;
  return `${tableId}.(${columns.join(", ")})`;
}

/** 原本 DSL 省略了 schema（schemaQualified === false）就照樣省略，其餘一律寫出完整的 `schema.name`。 */
function qualified(table: Table): string {
  return table.schemaQualified === false ? table.name : table.id;
}

function leadingLines(comments: SourceComments | undefined, indent: string): string[] {
  return (comments?.leading ?? []).map((text) => `${indent}//${text}`);
}

function withTrailing(line: string, comments: SourceComments | undefined): string {
  return comments?.trailing === undefined ? line : `${line} //${comments.trailing}`;
}

function quote(text: string): string {
  return `"${text.replace(/"/g, '\\"')}"`;
}

function max(values: number[]): number {
  return values.reduce((longest, value) => Math.max(longest, value), 0);
}
