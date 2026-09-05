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
