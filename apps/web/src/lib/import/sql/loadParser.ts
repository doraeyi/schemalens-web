import type { SourceLocation } from '@schemalens/schema-core';
import type { SqlDialectId } from './types';
import type { SqlParseIssue } from './types';
import { splitSqlStatements } from './statementSplitter';

const DATABASE_OPTION: Record<SqlDialectId, string> = {
	mysql: 'MySQL',
	mssql: 'transactsql',
	sqlite: 'sqlite',
	postgresql: 'PostgresQL'
};

interface NodeSqlParser {
	astify(sql: string, options: { database: string }): unknown;
}

interface RawParseError {
	message?: string;
	location?: { start?: { line?: number; column?: number } };
}

async function loadDialectParser(dialectId: SqlDialectId): Promise<NodeSqlParser> {
	// 每個方言各自的 build 只有 ~150KB，動態載入使用者選的那一個就好，
	// 不要把三個方言的文法一次全打進 bundle。
	switch (dialectId) {
		case 'mysql': {
			const mod: any = await import('node-sql-parser/build/mysql.js');
			const Ctor = mod.Parser ?? mod.default?.Parser;
			return new Ctor();
		}
		case 'mssql': {
			const mod: any = await import('node-sql-parser/build/transactsql.js');
			const Ctor = mod.Parser ?? mod.default?.Parser;
			return new Ctor();
		}
		case 'sqlite': {
			const mod: any = await import('node-sql-parser/build/sqlite.js');
			const Ctor = mod.Parser ?? mod.default?.Parser;
			return new Ctor();
		}
		case 'postgresql': {
			const mod: any = await import('node-sql-parser/build/postgresql.js');
			const Ctor = mod.Parser ?? mod.default?.Parser;
			return new Ctor();
		}
	}
}

export interface AstifyResult {
	nodes: unknown[];
	errors: SqlParseIssue[];
}

/** 見 statementSplitter.ts 開頭註解：先切成一條條敘述，個別解析、個別失敗。 */
export async function astifySql(source: string, dialectId: SqlDialectId): Promise<AstifyResult> {
	const parser = await loadDialectParser(dialectId);
	const database = DATABASE_OPTION[dialectId];
	const statements = splitSqlStatements(source);

	const nodes: unknown[] = [];
	const errors: SqlParseIssue[] = [];

	for (const statement of statements) {
		try {
			const result = parser.astify(statement.text, { database });
			const asArray = Array.isArray(result) ? result : [result];
			nodes.push(...asArray);
		} catch (e) {
			const err = e as RawParseError;
			const relativeLine = err.location?.start?.line ?? 1;
			const location: SourceLocation = {
				line: statement.startLine + relativeLine - 1,
				column: err.location?.start?.column ?? 1
			};
			errors.push({ message: err.message ?? 'SQL 語法錯誤', location });
		}
	}

	return { nodes, errors };
}
