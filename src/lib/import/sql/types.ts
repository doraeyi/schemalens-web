import type { SourceLocation } from '@schemalens/schema-core';

export type { SqlDialectId, SqlDialectInfo } from '$lib/export/sql/types';
export { SQL_DIALECTS } from '$lib/export/sql/types';

/**
 * node-sql-parser 的原始 AST 沒有公開文件記載欄位長相，而且每個方言的欄位路徑
 * 略有差異（例如 MSSQL 的 table 名稱帶 db/schema，MySQL/SQLite 通常不帶）。
 * 這裡定義我們自己的中間表示，astToStatements.ts 負責把三個方言的原始 AST
 * 都收斂成這個統一格式，下游 sqlAstToSchema.ts 完全不用管是哪個方言解出來的。
 */
export interface SqlColumnDef {
	name: string;
	typeName: string;
	length?: number;
	precision?: number;
	scale?: number;
	nullable: boolean;
	defaultValue?: string;
	primaryKey: boolean;
	unique: boolean;
}

export interface SqlForeignKeyDef {
	constraintName?: string;
	sourceColumns: string[];
	targetSchema?: string;
	targetTable: string;
	targetColumns: string[];
}

export interface CreateTableStatement {
	kind: 'createTable';
	schema?: string;
	name: string;
	columns: SqlColumnDef[];
	tablePrimaryKey?: string[];
	tableUniques: { name?: string; columns: string[] }[];
	inlineForeignKeys: SqlForeignKeyDef[];
}

export interface AlterTableAddForeignKeyStatement {
	kind: 'alterAddForeignKey';
	schema?: string;
	table: string;
	foreignKey: SqlForeignKeyDef;
}

export interface CreateIndexStatement {
	kind: 'createIndex';
	name: string;
	schema?: string;
	table: string;
	columns: string[];
	unique: boolean;
}

export interface UnsupportedStatement {
	kind: 'unsupported';
	statementType: string;
}

export type SqlStatement =
	| CreateTableStatement
	| AlterTableAddForeignKeyStatement
	| CreateIndexStatement
	| UnsupportedStatement;

export interface SqlParseIssue {
	message: string;
	location?: SourceLocation;
}
