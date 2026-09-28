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
  type SourceComments,
  type Table,
  type TableGroup,
} from "@schemalens/schema-core";

export interface JsonSerializeOptions {
  /** 預設不輸出 SourceLocation：它綁定特定檔案，放進交換格式只會製造雜訊。 */
  includeLocations?: boolean;
  /** 縮排空白數；0 代表單行輸出。 */
  indent?: number;
}

/**
 * Schema → JSON。
 *
 * 輸出是 deterministic 的（固定的 key 順序、table 依 id 排序、relation 依名稱排序、
 * 固定縮排），因此適合直接進版控做 diff（plan §36）。
 * 欄位與 index 內的順序**不排序**——那是有語意的，composite index 尤其不能動。
 */
export function toJson(schema: Schema, options: JsonSerializeOptions = {}): string {
  const indent = options.indent ?? 2;
  return JSON.stringify(toJsonObject(schema, options), null, indent) + (indent > 0 ? "\n" : "");
}

export function toJsonObject(schema: Schema, options: JsonSerializeOptions = {}): unknown {
  const tables = [...schema.tables].sort((a, b) => a.id.localeCompare(b.id));
  const groups = [...(schema.groups ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const relations = [...schema.relations].sort((a, b) => a.name.localeCompare(b.name));

  return {
    version: schema.version,
    metadata: {
      name: schema.metadata.name,
      defaultSchema: schema.metadata.defaultSchema,
    },
    tables: tables.map((table) => ({
      id: table.id,
      schema: table.schema,
      name: table.name,
      comment: table.comment,
      group: table.group,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        length: column.length,
        precision: column.precision,
        scale: column.scale,
        nullable: column.nullable,
        defaultValue: column.defaultValue,
        comment: column.comment,
        primaryKey: column.primaryKey,
        foreignKey: column.foreignKey,
        unique: column.unique,
        indexed: column.indexed,
        ...commentsOut(column.sourceComments),
        ...(options.includeLocations && column.location ? { location: column.location } : {}),
      })),
      indexes: table.indexes.map((index) => ({
        name: index.name,
        columns: index.columns,
        unique: index.unique,
        ...commentsOut(index.sourceComments),
        ...(options.includeLocations && index.location ? { location: index.location } : {}),
      })),
      ...(table.schemaQualified === false ? { schemaQualified: false } : {}),
      ...commentsOut(table.sourceComments),
      ...(options.includeLocations && table.location ? { location: table.location } : {}),
    })),
    groups: groups.map((group) => ({
      name: group.name,
      description: group.description,
      ...commentsOut(group.sourceComments),
      ...(options.includeLocations && group.location ? { location: group.location } : {}),
    })),
    relations: relations.map((relation) => ({
      name: relation.name,
      sourceTable: relation.sourceTable,
      sourceColumns: relation.sourceColumns,
      targetTable: relation.targetTable,
      targetColumns: relation.targetColumns,
      cardinality: relation.cardinality,
      ...commentsOut(relation.sourceComments),
      ...(options.includeLocations && relation.location ? { location: relation.location } : {}),
    })),
    ...(schema.trailingComments?.length ? { trailingComments: schema.trailingComments } : {}),
  };
}

/** 沒有任何 `//` 註解時完全不輸出這個欄位，既有的 JSON 輸出維持不變。 */
function commentsOut(comments: (SourceComments & { footer?: string[] }) | undefined): { sourceComments?: SourceComments } {
  if (!comments) return {};
  const hasAny = Boolean(comments.leading?.length || comments.trailing !== undefined || comments.footer?.length);
  return hasAny ? { sourceComments: comments } : {};
}

function commentsIn(value: unknown): (SourceComments & { footer?: string[] }) | undefined {
  if (!isRecord(value)) return undefined;
  const leading = stringArray(value.leading);
  const footer = stringArray(value.footer);
  const trailing = typeof value.trailing === "string" ? value.trailing : undefined;
  if (leading.length === 0 && footer.length === 0 && trailing === undefined) return undefined;
  return {
    ...(leading.length ? { leading } : {}),
    ...(trailing !== undefined ? { trailing } : {}),
    ...(footer.length ? { footer } : {}),
  };
}

export interface FromJsonResult {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
}

const CARDINALITIES = new Set<string>(["1:1", "1:N", "N:1", "N:M"]);

/**
 * JSON → Schema。
 *
 * 外部 JSON 不一定乾淨（手改、他人工具產生），所以這裡採取容錯策略：
 * 缺欄位補預設值、型別不對就跳過該筆並記診斷，**永遠回傳一份可以畫的 Schema**（US10）。
 * 語意層面的檢查交給 validateSchema。
 */
export function fromJson(input: string | unknown, file?: string): FromJsonResult {
  const diagnostics: SchemaDiagnostic[] = [];
  const report = (message: string): void => {
    diagnostics.push({
      code: "SCHEMA_PARSE_ERROR",
      severity: "error",
      message,
      location: file ? { file, line: 1, column: 1 } : undefined,
    });
  };

  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      report(`JSON 格式錯誤：${(error as Error).message}`);
      return { schema: emptySchemaWith(undefined), diagnostics };
    }
  }

  if (!isRecord(raw)) {
    report("JSON 根節點必須是物件");
    return { schema: emptySchemaWith(undefined), diagnostics };
  }

  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  const defaultSchema = typeof metadata.defaultSchema === "string" ? metadata.defaultSchema : DEFAULT_SCHEMA_NAME;
  const schemaName = typeof metadata.name === "string" ? metadata.name : undefined;

  const tables: Table[] = [];
  for (const entry of asArray(raw.tables, "tables", report)) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      report("table 缺少 name，已跳過");
      continue;
    }
    const tableSchema = typeof entry.schema === "string" ? entry.schema : defaultSchema;
    const id = typeof entry.id === "string" ? entry.id : makeTableId(tableSchema, entry.name);

    const columns: Column[] = [];
    for (const rawColumn of asArray(entry.columns, `${id}.columns`, report)) {
      if (!isRecord(rawColumn) || typeof rawColumn.name !== "string") {
        report(`${id} 有欄位缺少 name，已跳過`);
        continue;
      }
      columns.push({
        name: rawColumn.name,
        type: typeof rawColumn.type === "string" ? rawColumn.type : "unknown",
        length: numberOrUndefined(rawColumn.length),
        precision: numberOrUndefined(rawColumn.precision),
        scale: numberOrUndefined(rawColumn.scale),
        nullable: rawColumn.nullable !== false,
        defaultValue: typeof rawColumn.defaultValue === "string" ? rawColumn.defaultValue : undefined,
        comment: typeof rawColumn.comment === "string" ? rawColumn.comment : undefined,
        primaryKey: rawColumn.primaryKey === true,
        foreignKey: rawColumn.foreignKey === true,
        unique: rawColumn.unique === true,
        indexed: rawColumn.indexed === true,
        ...optionalComments(rawColumn.sourceComments),
      });
    }

    const indexes: Index[] = [];
    for (const rawIndex of asArray(entry.indexes, `${id}.indexes`, report)) {
      if (!isRecord(rawIndex) || typeof rawIndex.name !== "string") {
        report(`${id} 有 index 缺少 name，已跳過`);
        continue;
      }
      indexes.push({
        name: rawIndex.name,
        columns: asArray(rawIndex.columns, `${rawIndex.name}.columns`, report).filter(
          (value): value is string => typeof value === "string",
        ),
        unique: rawIndex.unique === true,
        ...optionalComments(rawIndex.sourceComments),
      });
    }

    tables.push({
      id,
      schema: tableSchema,
      name: entry.name,
      comment: typeof entry.comment === "string" ? entry.comment : undefined,
      group: typeof entry.group === "string" ? entry.group : undefined,
      columns,
      indexes,
      ...(entry.schemaQualified === false ? { schemaQualified: false } : {}),
      ...optionalComments(entry.sourceComments),
    });
  }

  const groups: TableGroup[] = [];
  const seenGroups = new Set<string>();
  for (const entry of asArray(raw.groups, "groups", report)) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      report("group 缺少 name，已跳過");
      continue;
    }
    if (seenGroups.has(entry.name)) continue;
    seenGroups.add(entry.name);
    groups.push({
      name: entry.name,
      description: typeof entry.description === "string" ? entry.description : undefined,
      ...optionalComments(entry.sourceComments),
    });
  }

  const relations: Relation[] = [];
  for (const entry of asArray(raw.relations, "relations", report)) {
    if (
      !isRecord(entry) ||
      typeof entry.name !== "string" ||
      typeof entry.sourceTable !== "string" ||
      typeof entry.targetTable !== "string"
    ) {
      report("relation 缺少 name / sourceTable / targetTable，已跳過");
      continue;
    }
    const cardinality =
      typeof entry.cardinality === "string" && CARDINALITIES.has(entry.cardinality)
        ? (entry.cardinality as Cardinality)
        : "N:1";
    if (entry.cardinality !== cardinality) {
      report(`relation ${entry.name} 的 cardinality 不合法，已退回 N:1`);
    }

    relations.push({
      name: entry.name,
      sourceTable: entry.sourceTable,
      sourceColumns: stringArray(entry.sourceColumns),
      targetTable: entry.targetTable,
      targetColumns: stringArray(entry.targetColumns),
      cardinality,
      ...optionalComments(entry.sourceComments),
    });
  }

  const schema: Schema = {
    version: typeof raw.version === "string" ? raw.version : SCHEMA_VERSION,
    metadata: { name: schemaName, defaultSchema },
    tables,
    relations,
    groups,
    ...(stringArray(raw.trailingComments).length ? { trailingComments: stringArray(raw.trailingComments) } : {}),
  };
  // JSON 內的 foreignKey / indexed 可能沒寫或過期，一律重新推導。
  const declared = snapshotFlags(schema);
  deriveColumnFlags(schema);
  restoreDeclaredFlags(schema, declared);

  return { schema, diagnostics };
}

function optionalComments(value: unknown): { sourceComments?: SourceComments & { footer?: string[] } } {
  const comments = commentsIn(value);
  return comments ? { sourceComments: comments } : {};
}

function emptySchemaWith(name: string | undefined): Schema {
  return {
    version: SCHEMA_VERSION,
    metadata: { name, defaultSchema: DEFAULT_SCHEMA_NAME },
    tables: [],
    relations: [],
    groups: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, label: string, report: (message: string) => void): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    report(`${label} 必須是陣列，已忽略`);
    return [];
  }
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function snapshotFlags(schema: Schema): Map<string, { foreignKey: boolean; indexed: boolean }> {
  const flags = new Map<string, { foreignKey: boolean; indexed: boolean }>();
  for (const table of schema.tables) {
    for (const column of table.columns) {
      flags.set(`${table.id}.${column.name}`, {
        foreignKey: column.foreignKey,
        indexed: column.indexed,
      });
    }
  }
  return flags;
}

function restoreDeclaredFlags(
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
