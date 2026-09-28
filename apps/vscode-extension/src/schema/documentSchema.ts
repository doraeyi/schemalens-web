import * as vscode from "vscode";
import { validateSchema, type Schema, type SchemaDiagnostic, type SourceLocation } from "@schemalens/schema-core";
import { lintSchema } from "@schemalens/schema-lint";
import { parseMarkdownSchema, parseSchema } from "@schemalens/schema-parser";
import { fromJson } from "@schemalens/schema-serializer";

export interface LoadedSchema {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
}

/**
 * Problems Panel 要顯示的一筆問題。比 SchemaDiagnostic 寬鬆：lint 的 code
 * （LINT_*）不在 schema-core 那個封閉的 SchemaErrorCode 裡。
 */
export interface DisplayDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  location?: SourceLocation;
}

/**
 * 跟網頁版同一套最佳實踐檢查（@schemalens/schema-lint）。lint 只知道「哪張表、哪個欄位」，
 * 這裡對回 DSL 的行號，Problems Panel 才能點過去；對不到（例如 JSON 來源沒有位置）就標在檔案開頭。
 */
export function lintDiagnostics(schema: Schema): DisplayDiagnostic[] {
  const tableById = new Map(schema.tables.map((table) => [table.id, table]));
  return lintSchema(schema).map((warning) => {
    const table = warning.location ? tableById.get(warning.location.tableId) : undefined;
    const column = warning.location?.column ? table?.columns.find((c) => c.name === warning.location?.column) : undefined;
    const location = column?.location ?? headerLine(table?.location);
    return { code: warning.code, severity: warning.severity, message: warning.message, ...(location ? { location } : {}) };
  });
}

/** 表的 location 涵蓋整個區塊，波浪線只標表頭那一行就好。 */
function headerLine(location: SourceLocation | undefined): SourceLocation | undefined {
  if (!location) return undefined;
  return { ...location, endLine: location.line, endColumn: undefined };
}

/** `database.schema.json` 這種檔名視為 Schema JSON（plan §35）。 */
export function isSchemaJson(fsPath: string): boolean {
  return /\.schema\.json$/i.test(fsPath);
}

/** `database.schema.md` 視為內嵌 DSL 的 Markdown（plan §37 第二優先）。 */
export function isSchemaMarkdown(fsPath: string): boolean {
  return /\.schema\.md$/i.test(fsPath);
}

/** Preview / Diagnostics 支援的三種輸入。 */
export function isSupportedSchemaFile(fsPath: string): boolean {
  return /\.dbschema$/i.test(fsPath) || isSchemaJson(fsPath) || isSchemaMarkdown(fsPath);
}

/**
 * 依副檔名決定入口：
 *   `.dbschema`      → DSL Parser（第一優先）
 *   `*.schema.json`  → JSON Import
 *   `*.schema.md`    → 取出 ```dbschema 區塊後解析
 *
 * 三條路徑都保證回傳 Schema + 診斷，不丟例外（US10）。
 */
export function loadSchemaFromText(text: string, fsPath: string): LoadedSchema {
  if (isSchemaMarkdown(fsPath)) {
    const parsed = parseMarkdownSchema(text, fsPath);
    return {
      schema: parsed.schema,
      diagnostics: [...parsed.diagnostics, ...validateSchema(parsed.schema, { file: fsPath })],
    };
  }
  if (isSchemaJson(fsPath)) {
    const imported = fromJson(text, fsPath);
    return {
      schema: imported.schema,
      diagnostics: [...imported.diagnostics, ...validateSchema(imported.schema, { file: fsPath })],
    };
  }
  const parsed = parseSchema(text, fsPath);
  return {
    schema: parsed.schema,
    diagnostics: [...parsed.diagnostics, ...validateSchema(parsed.schema, { file: fsPath })],
  };
}

export function loadSchemaFromDocument(document: vscode.TextDocument): LoadedSchema {
  return loadSchemaFromText(document.getText(), document.uri.fsPath);
}

/** `orders.dbschema` → `orders.schema.json`，符合 plan §35 的命名建議。 */
export function jsonExportUri(source: vscode.Uri): vscode.Uri {
  const path = source.fsPath
    .replace(/\.dbschema$/i, "")
    .replace(/\.schema\.md$/i, "")
    .replace(/\.schema\.json$/i, "");
  return vscode.Uri.file(`${path}.schema.json`);
}
