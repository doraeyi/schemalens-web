import type { SourceLocation } from "./model.js";

/**
 * Error code 是穩定契約：VS Code Diagnostics、CLI、測試都靠它比對。
 * Stage 0 只先定義模型；Stage 4 Validator 會填滿使用端。
 */
export type SchemaErrorCode =
  | "SCHEMA_DUPLICATE_TABLE"
  | "SCHEMA_DUPLICATE_COLUMN"
  | "SCHEMA_DUPLICATE_INDEX"
  | "SCHEMA_UNKNOWN_TABLE"
  | "SCHEMA_UNKNOWN_COLUMN"
  | "SCHEMA_UNKNOWN_INDEX_COLUMN"
  | "SCHEMA_RELATION_SOURCE_NOT_FOUND"
  | "SCHEMA_RELATION_TARGET_NOT_FOUND"
  | "SCHEMA_INVALID_RELATION"
  | "SCHEMA_INVALID_CARDINALITY"
  | "SCHEMA_INVALID_COMPOSITE_RELATION"
  | "SCHEMA_PARSE_ERROR";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface SchemaDiagnostic {
  code: SchemaErrorCode;
  severity: DiagnosticSeverity;
  message: string;
  location?: SourceLocation;
}

export function formatDiagnostic(d: SchemaDiagnostic): string {
  const loc = d.location
    ? `${d.location.file ?? "<schema>"}:${d.location.line}:${d.location.column}`
    : "<schema>";
  return `${loc}\n\n${d.code}\n\n${d.message}`;
}
