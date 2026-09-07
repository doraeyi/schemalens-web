import {
	DEFAULT_SCHEMA_NAME,
	deriveColumnFlags,
	makeTableId,
	type Column,
	type Schema,
	type Table,
	type TableId
} from '@schemalens/schema-core';

function uniqueTableName(schema: Schema, base: string): string {
	const existing = new Set(schema.tables.map((t) => t.name));
	if (!existing.has(base)) return base;
	let i = 2;
	while (existing.has(`${base}${i}`)) i++;
	return `${base}${i}`;
}

function uniqueColumnName(table: Table, base: string): string {
	const existing = new Set(table.columns.map((c) => c.name));
	if (!existing.has(base)) return base;
	let i = 2;
	while (existing.has(`${base}${i}`)) i++;
	return `${base}${i}`;
}

function withDerivedFlags(schema: Schema): Schema {
	// deriveColumnFlags mutates in place; it's only ever handed a schema we
	// just freshly built below, so this doesn't reach back into caller state.
	deriveColumnFlags(schema);
	return schema;
}

function replaceTable(schema: Schema, tableId: TableId, next: Table): Schema {
	return {
		...schema,
		tables: schema.tables.map((t) => (t.id === tableId ? next : t))
	};
}

function dropRelationsTouching(schema: Schema, tableId: TableId, columnName?: string): Schema {
	return {
		...schema,
		relations: schema.relations.filter((r) => {
			const touchesAsSource = r.sourceTable === tableId && (!columnName || r.sourceColumns.includes(columnName));
			const touchesAsTarget = r.targetTable === tableId && (!columnName || r.targetColumns.includes(columnName));
			return !(touchesAsSource || touchesAsTarget);
		})
	};
}

export function createTable(schema: Schema): Schema {
	const name = uniqueTableName(schema, 'NewTable');
	const table: Table = {
		id: makeTableId(DEFAULT_SCHEMA_NAME, name),
		schema: DEFAULT_SCHEMA_NAME,
		name,
		columns: [
			{
				name: 'id',
				type: 'integer',
				nullable: false,
				primaryKey: true,
				foreignKey: false,
				unique: false,
				indexed: false
			}
		],
		indexes: []
	};
	return withDerivedFlags({ ...schema, tables: [...schema.tables, table] });
}

export function duplicateTable(schema: Schema, tableId: TableId): Schema {
	const source = schema.tables.find((t) => t.id === tableId);
	if (!source) return schema;
	const name = uniqueTableName(schema, `${source.name}Copy`);
	const table: Table = {
		...source,
		id: makeTableId(source.schema, name),
		name,
		columns: source.columns.map((c) => ({ ...c })),
		indexes: source.indexes.map((i) => ({ ...i, columns: [...i.columns] }))
	};
	// Relations aren't duplicated — they'd need their own column remapping, out of scope for now.
	return withDerivedFlags({ ...schema, tables: [...schema.tables, table] });
}

export function renameTable(schema: Schema, tableId: TableId, name: string): Schema {
	const table = schema.tables.find((t) => t.id === tableId);
	const trimmed = name.trim();
	if (!table || !trimmed || trimmed === table.name) return schema;
	return withDerivedFlags(replaceTable(schema, tableId, { ...table, name: trimmed }));
}

export function deleteTable(schema: Schema, tableId: TableId): Schema {
	const withoutTable = { ...schema, tables: schema.tables.filter((t) => t.id !== tableId) };
	return withDerivedFlags(dropRelationsTouching(withoutTable, tableId));
}

export function addColumn(schema: Schema, tableId: TableId): Schema {
	const table = schema.tables.find((t) => t.id === tableId);
	if (!table) return schema;
	const column: Column = {
		name: uniqueColumnName(table, 'column'),
		type: 'varchar',
		nullable: true,
		primaryKey: false,
		foreignKey: false,
		unique: false,
		indexed: false
	};
	return withDerivedFlags(replaceTable(schema, tableId, { ...table, columns: [...table.columns, column] }));
}

export function updateColumn(
	schema: Schema,
	tableId: TableId,
	columnName: string,
	patch: Partial<Column>
): Schema {
	const table = schema.tables.find((t) => t.id === tableId);
	if (!table) return schema;
	const columns = table.columns.map((c) => (c.name === columnName ? { ...c, ...patch } : c));
	return withDerivedFlags(replaceTable(schema, tableId, { ...table, columns }));
}

export function deleteColumn(schema: Schema, tableId: TableId, columnName: string): Schema {
	const table = schema.tables.find((t) => t.id === tableId);
	if (!table) return schema;
	const next = replaceTable(schema, tableId, {
		...table,
		columns: table.columns.filter((c) => c.name !== columnName),
		indexes: table.indexes.filter((i) => !i.columns.includes(columnName))
	});
	return withDerivedFlags(dropRelationsTouching(next, tableId, columnName));
}
