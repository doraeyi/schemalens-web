import type { Column, Table } from '@schemalens/schema-core';

export type SqlDialectId = 'mysql' | 'mssql' | 'sqlite' | 'postgresql';

export interface SqlDialectInfo {
	id: SqlDialectId;
	label: string;
}

/** 選單/檔名用的靜態清單，故意跟真正的轉換邏輯（dialects.ts）分開放，
 *  這樣工具列只需要載入這個小檔案，不用把整套 renderer 一起打進首頁 bundle。 */
export const SQL_DIALECTS: SqlDialectInfo[] = [
	{ id: 'mysql', label: 'MySQL' },
	{ id: 'mssql', label: 'SQL Server' },
	{ id: 'postgresql', label: 'PostgreSQL' },
	{ id: 'sqlite', label: 'SQLite' }
];

/**
 * 每個方言只描述「表面語法差異」：識別字怎麼包、型別怎麼對應、
 * 外鍵是 inline 寫在 CREATE TABLE 裡還是事後用 ALTER TABLE 補上。
 * 共用的組裝順序（欄位、PK、INDEX、FK 怎麼排）都在 render.ts，不重複寫。
 */
export interface SqlDialect {
	id: SqlDialectId;
	quoteIdentifier(name: string): string;
	/** DSL 的型別是自由文字，不是固定集合；對照不到的型別會 best-effort 直接照抄。 */
	renderType(column: Column): string;
	/** SQLite 不支援事後用 ALTER TABLE 加外鍵，只能寫在 CREATE TABLE 裡。 */
	inlineForeignKeys: boolean;
	qualifyTableName(table: Table): string;
}
