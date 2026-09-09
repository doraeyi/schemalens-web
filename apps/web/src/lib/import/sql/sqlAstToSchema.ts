import {
	DEFAULT_SCHEMA_NAME,
	SCHEMA_VERSION,
	deriveColumnFlags,
	makeTableId,
	type Cardinality,
	type Column,
	type Index,
	type Relation,
	type Schema,
	type SchemaDiagnostic,
	type Table
} from '@schemalens/schema-core';
import type { CreateTableStatement, SqlForeignKeyDef, SqlStatement } from './types';

export interface SqlAstToSchemaOptions {
	defaultSchema?: string;
	schemaName?: string;
	file?: string;
}

export interface SqlAstToSchemaResult {
	schema: Schema;
	diagnostics: SchemaDiagnostic[];
}

function toColumn(def: CreateTableStatement['columns'][number]): Column {
	return {
		name: def.name,
		type: def.typeName,
		length: def.length,
		precision: def.precision,
		scale: def.scale,
		nullable: def.nullable,
		defaultValue: def.defaultValue,
		primaryKey: def.primaryKey,
		foreignKey: false,
		unique: def.unique,
		indexed: false
	};
}

function uniqueName(base: string, used: Set<string>): string {
	let candidate = base;
	let n = 2;
	while (used.has(candidate)) {
		candidate = `${base}_${n}`;
		n++;
	}
	used.add(candidate);
	return candidate;
}

/**
 * SQL AST → Schema domain model。跟 packages/schema-parser/src/astToSchema.ts
 * 是同一套慣例：先把「結構上無法同時存在」的問題（重複表名/欄名）在這裡擋掉，
 * 參照類的問題（relation 指向不存在的表）留給呼叫端的 validateSchema()。
 *
 * 分三個 pass：(1) 先把所有 CREATE TABLE 收斂成 tableById，讓後面兩個 pass
 * 不用擔心正向引用（後面才宣告的表）；(2) 外鍵（inline + ALTER TABLE 補的）；
 * (3) INDEX 與 pass 1 暫存的 composite UNIQUE。
 */
export function sqlAstToSchema(statements: SqlStatement[], options: SqlAstToSchemaOptions = {}): SqlAstToSchemaResult {
	const defaultSchema = options.defaultSchema ?? DEFAULT_SCHEMA_NAME;
	const diagnostics: SchemaDiagnostic[] = [];
	const tables: Table[] = [];
	const tableById = new Map<string, Table>();
	const pendingCompositeUniques: { tableId: string; name?: string; columns: string[] }[] = [];
	const pendingForeignKeys: { sourceTableId: string; fk: SqlForeignKeyDef }[] = [];

	// Pass 1 — CREATE TABLE
	for (const statement of statements) {
		if (statement.kind !== 'createTable') continue;

		const id = makeTableId(statement.schema ?? defaultSchema, statement.name);
		if (tableById.has(id)) {
			diagnostics.push({ code: 'SCHEMA_DUPLICATE_TABLE', severity: 'error', message: `Table 重複定義：${id}` });
			continue;
		}

		const columns: Column[] = [];
		const seenColumns = new Set<string>();
		for (const def of statement.columns) {
			if (seenColumns.has(def.name)) {
				diagnostics.push({ code: 'SCHEMA_DUPLICATE_COLUMN', severity: 'error', message: `Column 重複定義：${id}.${def.name}` });
				continue;
			}
			seenColumns.add(def.name);
			columns.push(toColumn(def));
		}

		if (statement.tablePrimaryKey) {
			const pk = new Set(statement.tablePrimaryKey);
			for (const column of columns) if (pk.has(column.name)) column.primaryKey = true;
		}
		for (const unique of statement.tableUniques) {
			if (unique.columns.length === 1) {
				const column = columns.find((c) => c.name === unique.columns[0]);
				if (column) column.unique = true;
			} else {
				pendingCompositeUniques.push({ tableId: id, name: unique.name, columns: unique.columns });
			}
		}

		const table: Table = { id, schema: statement.schema ?? defaultSchema, name: statement.name, columns, indexes: [] };
		tables.push(table);
		tableById.set(id, table);

		for (const fk of statement.inlineForeignKeys) pendingForeignKeys.push({ sourceTableId: id, fk });
	}

	// Pass 2 — 外鍵（inline + ALTER TABLE ADD CONSTRAINT），此時所有表都已存在。
	for (const statement of statements) {
		if (statement.kind !== 'alterAddForeignKey') continue;
		const sourceTableId = makeTableId(statement.schema ?? defaultSchema, statement.table);
		if (!tableById.has(sourceTableId)) {
			diagnostics.push({ code: 'SCHEMA_UNKNOWN_TABLE', severity: 'error', message: `外鍵指向不存在的表：${sourceTableId}` });
			continue;
		}
		pendingForeignKeys.push({ sourceTableId, fk: statement.foreignKey });
	}

	const relations: Relation[] = [];
	const usedRelationNames = new Set<string>();
	// 具名外鍵先搶名字，撞名代表原始 SQL 本身有問題（同一個 CONSTRAINT 名字用了兩次）——
	// 出診斷之後仍然幫它合成一個新名字，不能讓兩個 relation 真的共用同一個 name。
	// 沒名字的外鍵一律合成，這是我們自己的實作細節，不代表使用者的 SQL 有問題，不出診斷。
	for (const { sourceTableId, fk } of pendingForeignKeys) {
		const sourceTable = tableById.get(sourceTableId);
		if (!sourceTable) continue;
		const targetTableId = makeTableId(fk.targetSchema ?? defaultSchema, fk.targetTable);

		let name: string;
		if (fk.constraintName && !usedRelationNames.has(fk.constraintName)) {
			name = fk.constraintName;
			usedRelationNames.add(name);
		} else {
			if (fk.constraintName) {
				diagnostics.push({ code: 'SCHEMA_INVALID_RELATION', severity: 'error', message: `Relation 名稱重複：${fk.constraintName}` });
			}
			name = uniqueName(`fk_${sourceTable.name}_${fk.sourceColumns.join('_')}_${fk.targetTable}`, usedRelationNames);
		}

		const sourceKeySet = fk.sourceColumns.slice().sort().join(',');
		const pkSet = sourceTable.columns
			.filter((c) => c.primaryKey)
			.map((c) => c.name)
			.sort()
			.join(',');
		const cardinality: Cardinality = sourceKeySet !== '' && sourceKeySet === pkSet ? '1:1' : 'N:1';

		relations.push({
			name,
			sourceTable: sourceTableId,
			sourceColumns: fk.sourceColumns,
			targetTable: targetTableId,
			targetColumns: fk.targetColumns,
			cardinality
		});
	}

	// Pass 3 — CREATE INDEX + pass 1 暫存的 composite UNIQUE
	const usedIndexNamesByTable = new Map<string, Set<string>>();
	const indexNamesFor = (tableId: string): Set<string> => {
		let set = usedIndexNamesByTable.get(tableId);
		if (!set) {
			set = new Set();
			usedIndexNamesByTable.set(tableId, set);
		}
		return set;
	};

	for (const statement of statements) {
		if (statement.kind !== 'createIndex') continue;
		const tableId = makeTableId(statement.schema ?? defaultSchema, statement.table);
		const table = tableById.get(tableId);
		if (!table) {
			diagnostics.push({ code: 'SCHEMA_UNKNOWN_TABLE', severity: 'error', message: `Index 指向不存在的表：${tableId}` });
			continue;
		}
		const used = indexNamesFor(tableId);
		if (used.has(statement.name)) {
			diagnostics.push({ code: 'SCHEMA_DUPLICATE_INDEX', severity: 'error', message: `Index 名稱重複：${tableId}.${statement.name}` });
			continue;
		}
		used.add(statement.name);
		const index: Index = { name: statement.name, columns: statement.columns, unique: statement.unique };
		table.indexes.push(index);
	}

	for (const pending of pendingCompositeUniques) {
		const table = tableById.get(pending.tableId);
		if (!table) continue;
		const used = indexNamesFor(pending.tableId);
		const name = pending.name && !used.has(pending.name) ? pending.name : uniqueName(`uq_${table.name}_${pending.columns.join('_')}`, used);
		used.add(name);
		const index: Index = { name, columns: pending.columns, unique: true };
		table.indexes.push(index);
	}

	const schema: Schema = {
		version: SCHEMA_VERSION,
		metadata: { name: options.schemaName, defaultSchema },
		tables,
		relations,
		groups: []
	};
	deriveColumnFlags(schema);

	return { schema, diagnostics };
}
