import type { Schema, TableId } from '@schemalens/schema-core';

export interface LintWarning {
	code: 'LINT_NAMING' | 'LINT_FK_NO_INDEX' | 'LINT_NO_PK' | 'LINT_EMPTY_TABLE' | 'LINT_TYPE_SUFFIX';
	severity: 'warning' | 'info';
	message: string;
	location?: { tableId: TableId; column?: string };
}

// 從舊系統自由文字轉換過來的欄位名，常見失誤是型別關鍵字沒跟欄位名隔開，
// 直接黏在字尾（例如 CLIENT_ID + INT 漏了空白變成 CLIENT_IDint）。由長到短排序，
// 讓比對優先吃到最長的關鍵字（例如 "bigint" 而不是被 "int" 搶先命中）。
const TYPE_SUFFIX_KEYWORDS = [
	'bigserial', 'smallserial', 'varbinary', 'datetime2', 'nvarchar',
	'smallint', 'boolean', 'decimal', 'numeric', 'tinyint', 'varchar',
	'double', 'binary', 'bigint', 'serial', 'nchar', 'float', 'money', 'jsonb',
	'json', 'text', 'time', 'date', 'bool', 'char', 'uuid', 'guid', 'blob', 'enum',
	'bit', 'xml', 'int'
].sort((a, b) => b.length - a.length);

/** 找出「型別關鍵字直接黏在字尾、中間沒有底線或大小寫延續」的欄位名，回傳命中的關鍵字。 */
function findGluedTypeSuffix(name: string): string | null {
	for (const keyword of TYPE_SUFFIX_KEYWORDS) {
		if (name.length <= keyword.length || !name.endsWith(keyword)) continue;
		const before = name[name.length - keyword.length - 1];
		// 前一個字元是底線（有意的分隔）或小寫（本來就是同一個自然單字，例如 "point"）就不算誤黏。
		if (before === '_' || /[a-z]/.test(before)) continue;
		return keyword;
	}
	return null;
}

function lintTypeSuffix(schema: Schema): LintWarning[] {
	const warnings: LintWarning[] = [];
	for (const table of schema.tables) {
		for (const column of table.columns) {
			const keyword = findGluedTypeSuffix(column.name);
			if (!keyword) continue;
			const guessed = column.name.slice(0, -keyword.length);
			warnings.push({
				code: 'LINT_TYPE_SUFFIX',
				severity: 'warning',
				message: `欄位 ${table.id}.${column.name} 字尾「${keyword}」疑似型別關鍵字誤黏進欄位名（來源轉換時可能漏了分隔），確認是否應為 ${guessed}`,
				location: { tableId: table.id, column: column.name }
			});
		}
	}
	return warnings;
}

type NamingStyle = 'snake_case' | 'PascalCase' | 'camelCase' | 'other';

function namingStyle(name: string): NamingStyle {
	if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) return 'snake_case';
	if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
	if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
	return 'other';
}

function lintNaming(schema: Schema): LintWarning[] {
	const names: { tableId: TableId; column?: string; name: string; style: NamingStyle }[] = [];
	for (const table of schema.tables) {
		names.push({ tableId: table.id, name: table.name, style: namingStyle(table.name) });
		for (const column of table.columns) {
			names.push({ tableId: table.id, column: column.name, name: column.name, style: namingStyle(column.name) });
		}
	}

	const counts = new Map<NamingStyle, number>();
	for (const n of names) counts.set(n.style, (counts.get(n.style) ?? 0) + 1);
	let dominant: NamingStyle = 'other';
	let dominantCount = -1;
	for (const [style, count] of counts) {
		if (style !== 'other' && count > dominantCount) {
			dominant = style;
			dominantCount = count;
		}
	}
	if (dominantCount <= 0) return [];

	const warnings: LintWarning[] = [];
	for (const n of names) {
		if (n.style === 'other' || n.style === dominant) continue;
		const what = n.column ? `欄位 ${n.tableId}.${n.column}` : `資料表 ${n.tableId}`;
		warnings.push({
			code: 'LINT_NAMING',
			severity: 'info',
			message: `${what} 的命名風格（${n.style}）跟schema裡主流的 ${dominant} 不一致`,
			location: { tableId: n.tableId, column: n.column }
		});
	}
	return warnings;
}

function lintForeignKeyIndex(schema: Schema): LintWarning[] {
	const warnings: LintWarning[] = [];
	for (const table of schema.tables) {
		const indexedColumns = new Set<string>();
		for (const index of table.indexes) for (const c of index.columns) indexedColumns.add(c);
		for (const column of table.columns) {
			if (!column.foreignKey || column.primaryKey || indexedColumns.has(column.name)) continue;
			warnings.push({
				code: 'LINT_FK_NO_INDEX',
				severity: 'warning',
				message: `外鍵欄位 ${table.id}.${column.name} 沒有建立 index，查詢/JOIN 效能可能受影響`,
				location: { tableId: table.id, column: column.name }
			});
		}
	}
	return warnings;
}

function lintMissingPrimaryKey(schema: Schema): LintWarning[] {
	const warnings: LintWarning[] = [];
	for (const table of schema.tables) {
		if (table.columns.length > 0 && table.columns.every((c) => !c.primaryKey)) {
			warnings.push({
				code: 'LINT_NO_PK',
				severity: 'warning',
				message: `資料表 ${table.id} 沒有設定 Primary Key`,
				location: { tableId: table.id }
			});
		}
	}
	return warnings;
}

function lintEmptyTable(schema: Schema): LintWarning[] {
	const warnings: LintWarning[] = [];
	for (const table of schema.tables) {
		if (table.columns.length === 0) {
			warnings.push({
				code: 'LINT_EMPTY_TABLE',
				severity: 'warning',
				message: `資料表 ${table.id} 沒有任何欄位`,
				location: { tableId: table.id }
			});
		}
	}
	return warnings;
}

/**
 * 純風格/最佳實踐檢查，跟 @schemalens/schema-core 的 validateSchema()（結構/參照正確性）
 * 是不同層級——這裡的警告全部是「語法上合法，但可能是失誤或不良實踐」，故意不放進
 * vendor package 的封閉 SchemaErrorCode，避免跟 VS Code 插件那邊的診斷代碼混在一起。
 */
export function lintSchema(schema: Schema): LintWarning[] {
	return [
		...lintNaming(schema),
		...lintForeignKeyIndex(schema),
		...lintMissingPrimaryKey(schema),
		...lintEmptyTable(schema),
		...lintTypeSuffix(schema)
	];
}
