import type { SchemaDiagnostic } from "../errors.js";
import type { Cardinality, Relation, Schema, Table } from "../model.js";
import { columnRef, indexSchema } from "../schema.js";

const VALID_CARDINALITIES = new Set<Cardinality>(["1:1", "1:N", "N:1", "N:M"]);

export interface ValidateOptions {
  /** 診斷要標在哪個檔案；Schema 內既有的 location 優先。 */
  file?: string;
}

/**
 * Schema 語意驗證。
 *
 * 職責邊界：
 *  - **結構性**問題（重複的 table / column / index 名稱、index 掛在不存在的 table）
 *    在 AST → Schema 那一步就會被回報，因為收斂進 Domain Model 後就看不出來了。
 *  - **參照性**問題（relation 指向不存在的 table / column、index 欄位不存在、
 *    composite 欄位數不符…）由這裡負責。
 *
 * 這裡不丟例外，只回傳診斷；Preview 永遠拿得到一份可以畫的 Schema（US10）。
 */
export function validateSchema(schema: Schema, options: ValidateOptions = {}): SchemaDiagnostic[] {
  const diagnostics: SchemaDiagnostic[] = [];
  const index = indexSchema(schema);

  const report = (
    code: SchemaDiagnostic["code"],
    message: string,
    location?: SchemaDiagnostic["location"],
  ): void => {
    diagnostics.push({
      code,
      severity: "error",
      message,
      location: location ? { file: options.file, ...location } : undefined,
    });
  };

  for (const table of schema.tables) {
    validateTable(table, report);
  }
  for (const relation of schema.relations) {
    validateRelation(relation, index, report);
  }

  return diagnostics;
}

type Report = (
  code: SchemaDiagnostic["code"],
  message: string,
  location?: SchemaDiagnostic["location"],
) => void;

function validateTable(table: Table, report: Report): void {
  const columnNames = new Set(table.columns.map((column) => column.name));

  for (const index of table.indexes) {
    if (index.columns.length === 0) {
      report("SCHEMA_UNKNOWN_INDEX_COLUMN", `index ${index.name} 沒有指定欄位`, index.location);
      continue;
    }
    for (const column of index.columns) {
      if (!columnNames.has(column)) {
        report(
          "SCHEMA_UNKNOWN_INDEX_COLUMN",
          `index ${index.name} 參照到不存在的欄位：${table.id}.${column}`,
          index.location,
        );
      }
    }
    // Composite index 內欄位重複通常是打錯字，不是有意的設計。
    const seen = new Set<string>();
    for (const column of index.columns) {
      if (seen.has(column)) {
        report(
          "SCHEMA_DUPLICATE_INDEX",
          `index ${index.name} 內欄位重複：${column}`,
          index.location,
        );
      }
      seen.add(column);
    }
  }
}

function validateRelation(
  relation: Relation,
  index: ReturnType<typeof indexSchema>,
  report: Report,
): void {
  const location = relation.location;

  if (!VALID_CARDINALITIES.has(relation.cardinality)) {
    report(
      "SCHEMA_INVALID_CARDINALITY",
      `relation ${relation.name} 的 cardinality 不合法：${relation.cardinality}`,
      location,
    );
  }

  const sourceTable = index.tableById.get(relation.sourceTable);
  const targetTable = index.tableById.get(relation.targetTable);

  if (!sourceTable) {
    report(
      "SCHEMA_RELATION_SOURCE_NOT_FOUND",
      `relation ${relation.name} 的來源 Table 不存在：${relation.sourceTable}`,
      location,
    );
  }
  if (!targetTable) {
    report(
      "SCHEMA_RELATION_TARGET_NOT_FOUND",
      `relation ${relation.name} 的目標 Table 不存在：${relation.targetTable}`,
      location,
    );
  }

  if (relation.sourceColumns.length === 0 || relation.targetColumns.length === 0) {
    report("SCHEMA_INVALID_RELATION", `relation ${relation.name} 缺少欄位對應`, location);
    return;
  }

  if (relation.sourceColumns.length !== relation.targetColumns.length) {
    report(
      "SCHEMA_INVALID_COMPOSITE_RELATION",
      `relation ${relation.name} 兩端欄位數不一致：` +
        `${relation.sourceColumns.length} vs ${relation.targetColumns.length}`,
      location,
    );
  }

  if (sourceTable) {
    for (const column of relation.sourceColumns) {
      if (!index.columnByRef.has(columnRef(relation.sourceTable, column))) {
        report(
          "SCHEMA_UNKNOWN_COLUMN",
          `Unknown source:\n${relation.sourceTable}.${column}`,
          location,
        );
      }
    }
  }
  if (targetTable) {
    for (const column of relation.targetColumns) {
      if (!index.columnByRef.has(columnRef(relation.targetTable, column))) {
        report(
          "SCHEMA_UNKNOWN_COLUMN",
          `Unknown target:\n${relation.targetTable}.${column}`,
          location,
        );
      }
    }
  }

  // 自我參照（樹狀結構）合法，但來源與目標完全相同的欄位一定是打錯。
  if (relation.sourceTable === relation.targetTable) {
    const identical = relation.sourceColumns.every(
      (column, i) => column === relation.targetColumns[i],
    );
    if (identical) {
      report(
        "SCHEMA_INVALID_RELATION",
        `relation ${relation.name} 的來源與目標是同一組欄位`,
        location,
      );
    }
  }
}
