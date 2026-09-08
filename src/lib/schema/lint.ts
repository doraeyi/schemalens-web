import type { Schema, TableId } from '@schemalens/schema-core';

export interface LintWarning {
	code: 'LINT_NAMING' | 'LINT_FK_NO_INDEX' | 'LINT_NO_PK' | 'LINT_EMPTY_TABLE';
	severity: 'warning' | 'info';
	message: string;
	location?: { tableId: TableId; column?: string };
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
	return [...lintNaming(schema), ...lintForeignKeyIndex(schema), ...lintMissingPrimaryKey(schema), ...lintEmptyTable(schema)];
}
