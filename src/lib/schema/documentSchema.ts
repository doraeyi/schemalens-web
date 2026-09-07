import { validateSchema, type Schema, type SchemaDiagnostic } from '@schemalens/schema-core';
import { parseMarkdownSchema, parseSchema } from '@schemalens/schema-parser';
import { fromJson } from '@schemalens/schema-serializer';

export interface LoadedSchema {
	schema: Schema;
	diagnostics: SchemaDiagnostic[];
}

/** `*.schema.json` is treated as Schema JSON. */
export function isSchemaJson(fileName: string): boolean {
	return /\.schema\.json$/i.test(fileName);
}

/** `*.schema.md` is treated as Markdown with embedded ```dbschema blocks. */
export function isSchemaMarkdown(fileName: string): boolean {
	return /\.schema\.md$/i.test(fileName);
}

export function isSupportedSchemaFile(fileName: string): boolean {
	return /\.dbschema$/i.test(fileName) || isSchemaJson(fileName) || isSchemaMarkdown(fileName);
}

/**
 * Same three-way dispatch as the VS Code extension's `documentSchema.ts`:
 *   `.dbschema`      -> DSL parser (default when the name doesn't match the others)
 *   `*.schema.json`  -> JSON import
 *   `*.schema.md`    -> extract ```dbschema blocks then parse
 *
 * Always returns a schema + diagnostics, never throws.
 */
export function loadSchemaFromText(text: string, fileName: string): LoadedSchema {
	if (isSchemaMarkdown(fileName)) {
		const parsed = parseMarkdownSchema(text, fileName);
		return {
			schema: parsed.schema,
			diagnostics: [...parsed.diagnostics, ...validateSchema(parsed.schema, { file: fileName })]
		};
	}
	if (isSchemaJson(fileName)) {
		const imported = fromJson(text, fileName);
		return {
			schema: imported.schema,
			diagnostics: [...imported.diagnostics, ...validateSchema(imported.schema, { file: fileName })]
		};
	}
	const parsed = parseSchema(text, fileName);
	return {
		schema: parsed.schema,
		diagnostics: [...parsed.diagnostics, ...validateSchema(parsed.schema, { file: fileName })]
	};
}

/**
 * 匯入任意手寫 SQL DDL（MySQL / SQL Server / SQLite）。跟上面三種格式不同，這條路徑
 * 是 async 的——`$lib/import/sql` 內部要依使用者選的方言動態載入對應的 node-sql-parser
 * 子模組，使用者沒有實際匯入 SQL 之前不會把這段程式碼載進 bundle。刻意獨立成一個函式，
 * 不動 loadSchemaFromText 本身，其餘三種格式的呼叫端完全不受影響。
 */
export async function loadSchemaFromSql(
	text: string,
	fileName: string,
	dialect: import('$lib/import/sql').SqlDialectId
): Promise<LoadedSchema> {
	const { parseSql } = await import('$lib/import/sql');
	const parsed = await parseSql(text, dialect, fileName);
	return {
		schema: parsed.schema,
		diagnostics: [...parsed.diagnostics, ...validateSchema(parsed.schema, { file: fileName })]
	};
}
