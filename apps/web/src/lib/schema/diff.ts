import type { Column, Relation, Schema, Table, TableId } from '@schemalens/schema-core';

// 故意不比 foreignKey——那是從 relations 算出來的 derived flag，relations 本身已經有自己的
// addedRelations/removedRelations 在追蹤，這裡再比一次只會出現重複/矛盾的訊號。indexed 則相反：
// 沒有其他地方在追蹤「這個欄位是不是被某個 index 涵蓋」的變化（例如使用者專門加了一個 index
// 來解 LINT_FK_NO_INDEX 這個警告），所以要比，不然「只加了 index」這種修正在 diff 裡完全看不出來。
const COLUMN_COMPARE_FIELDS: (keyof Column)[] = [
	'type',
	'length',
	'precision',
	'scale',
	'nullable',
	'defaultValue',
	'comment',
	'primaryKey',
	'unique',
	'indexed'
];

export interface ColumnDiff {
	name: string;
	before: Column;
	after: Column;
	changedFields: (keyof Column)[];
}

export interface TableDiff {
	tableId: TableId;
	addedColumns: Column[];
	removedColumns: Column[];
	changedColumns: ColumnDiff[];
}

export interface SchemaDiff {
	addedTables: Table[];
	removedTables: Table[];
	changedTables: TableDiff[];
	addedRelations: Relation[];
	removedRelations: Relation[];
}

function diffColumns(base: Table, next: Table): TableDiff | null {
	const baseByName = new Map(base.columns.map((c) => [c.name, c]));
	const nextByName = new Map(next.columns.map((c) => [c.name, c]));

	const addedColumns = next.columns.filter((c) => !baseByName.has(c.name));
	const removedColumns = base.columns.filter((c) => !nextByName.has(c.name));
	const changedColumns: ColumnDiff[] = [];

	for (const [name, before] of baseByName) {
		const after = nextByName.get(name);
		if (!after) continue;
		const changedFields = COLUMN_COMPARE_FIELDS.filter((field) => before[field] !== after[field]);
		if (changedFields.length > 0) changedColumns.push({ name, before, after, changedFields });
	}

	if (addedColumns.length === 0 && removedColumns.length === 0 && changedColumns.length === 0) return null;
	return { tableId: next.id, addedColumns, removedColumns, changedColumns };
}

/** 純比對，不改動任何一份 schema。table 用 id 配對、column 用 name 配對。 */
export function diffSchemas(base: Schema, next: Schema): SchemaDiff {
	const baseById = new Map(base.tables.map((t) => [t.id, t]));
	const nextById = new Map(next.tables.map((t) => [t.id, t]));

	const addedTables = next.tables.filter((t) => !baseById.has(t.id));
	const removedTables = base.tables.filter((t) => !nextById.has(t.id));

	const changedTables: TableDiff[] = [];
	for (const [id, baseTable] of baseById) {
		const nextTable = nextById.get(id);
		if (!nextTable) continue;
		const tableDiff = diffColumns(baseTable, nextTable);
		if (tableDiff) changedTables.push(tableDiff);
	}

	const baseRelByName = new Map(base.relations.map((r) => [r.name, r]));
	const nextRelByName = new Map(next.relations.map((r) => [r.name, r]));
	const addedRelations = next.relations.filter((r) => !baseRelByName.has(r.name));
	const removedRelations = base.relations.filter((r) => !nextRelByName.has(r.name));

	return { addedTables, removedTables, changedTables, addedRelations, removedRelations };
}

/**
 * 把兩份 schema 的 table/column/relation 聯集成一份「拿去渲染用」的合成 schema——
 * 目前畫布只會渲染 `next` 這一份資料，被刪除的表/欄位本來就不存在於 next 裡，沒有卡片/列
 * 可以標記，所以視覺化 diff 需要一份包含「已經被刪除的東西」的合成版本。這份合成 schema
 * 只拿來畫圖，不會拿去做任何 mutation 或存檔。
 */
export function buildMergedSchema(base: Schema, next: Schema): Schema {
	const baseById = new Map(base.tables.map((t) => [t.id, t]));
	const nextById = new Map(next.tables.map((t) => [t.id, t]));

	const mergedTables: Table[] = [];
	for (const table of next.tables) {
		const baseTable = baseById.get(table.id);
		if (!baseTable) {
			mergedTables.push(table);
			continue;
		}
		const nextColumnNames = new Set(table.columns.map((c) => c.name));
		const removedColumns = baseTable.columns.filter((c) => !nextColumnNames.has(c.name));
		mergedTables.push(removedColumns.length > 0 ? { ...table, columns: [...table.columns, ...removedColumns] } : table);
	}
	for (const table of base.tables) {
		if (!nextById.has(table.id)) mergedTables.push(table);
	}

	const nextRelNames = new Set(next.relations.map((r) => r.name));
	const mergedRelations = [...next.relations, ...base.relations.filter((r) => !nextRelNames.has(r.name))];

	return { ...next, tables: mergedTables, relations: mergedRelations };
}
