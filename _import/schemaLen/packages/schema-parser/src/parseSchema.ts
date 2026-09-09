import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import { astToSchema, type AstToSchemaOptions } from "./astToSchema.js";
import { parse } from "./parser.js";

export interface ParseSchemaResult {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
}

/**
 * DSL Source → Schema Domain Model 的單一入口。
 *
 * 永遠回傳一份 Schema（可能是部分結果），呼叫端不需要 try/catch，
 * 這是 Preview 在 DSL 有錯時仍能顯示內容的前提（US10）。
 */
export function parseSchema(
  source: string,
  file?: string,
  options: AstToSchemaOptions = {},
): ParseSchemaResult {
  const parsed = parse(source, file);
  const converted = astToSchema(parsed.ast, options);
  return {
    schema: converted.schema,
    diagnostics: [...parsed.diagnostics, ...converted.diagnostics],
  };
}
