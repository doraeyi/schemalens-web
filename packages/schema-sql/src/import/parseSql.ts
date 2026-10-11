import { emptySchema, type Schema, type SchemaDiagnostic } from '@schemalens/schema-core';
import { astifySql } from './loadParser';
import { astToStatements } from './astToStatements';
import { sqlAstToSchema } from './sqlAstToSchema';
import type { SqlDialectId } from './types';

/**
 * DDL 沒寫 schema 時要歸到哪個 schema——照各資料庫自己的預設，不要一律套 SQL Server 的 dbo
 * （PostgreSQL 匯入後卡片上標著 dbo 很像匯錯方言）。MySQL 沒有 schema 層級，沿用 dbo 只是佔位。
 */
const DIALECT_DEFAULT_SCHEMA: Partial<Record<SqlDialectId, string>> = {
	postgresql: 'public',
	sqlite: 'main'
};

export interface ParseSqlResult {
	schema: Schema;
	diagnostics: SchemaDiagnostic[];
}

/**
 * 對外唯一入口，跟 @schemalens/schema-parser 的 parseSchema() 用同一個約定：
 * 永遠回傳一份（可能是部分的）Schema，不 throw。跟 parseSchema() 的唯一差異是
 * 這個是 async——因為要依使用者選的方言動態載入對應的 node-sql-parser 子模組。
 */
export async function parseSql(source: string, dialectId: SqlDialectId, file?: string): Promise<ParseSqlResult> {
	const { nodes, errors } = await astifySql(source, dialectId);

	const diagnostics: SchemaDiagnostic[] = errors.map((issue) => ({
		code: 'SCHEMA_PARSE_ERROR',
		// 有些敘述解析失敗、其餘照樣成功是常態（尤其 MSSQL 外鍵——見 loadParser.ts 註解），
		// 不代表整份匯入失敗，所以用 warning 而不是 error。
		severity: 'warning',
		message: issue.message,
		location: issue.location ? { ...issue.location, file } : undefined
	}));

	if (nodes.length === 0) {
		return { schema: emptySchema(file), diagnostics };
	}

	const statements = astToStatements(nodes);
	for (const statement of statements) {
		if (statement.kind === 'unsupported') {
			diagnostics.push({
				code: 'SCHEMA_PARSE_ERROR',
				severity: 'warning',
				message: `不支援的語句，已略過：${statement.statementType}`
			});
		}
	}

	const { schema, diagnostics: buildDiagnostics } = sqlAstToSchema(statements, {
		schemaName: file,
		file,
		defaultSchema: DIALECT_DEFAULT_SCHEMA[dialectId]
	});
	return { schema, diagnostics: [...diagnostics, ...buildDiagnostics] };
}
