import type {
	AlterTableAddForeignKeyStatement,
	CreateIndexStatement,
	CreateTableStatement,
	SqlColumnDef,
	SqlForeignKeyDef,
	SqlStatement,
	UnsupportedStatement
} from './types';

/**
 * node-sql-parser 沒有公開文件記載這些欄位長相，以下型別是實際跑過
 * mysql/transactsql/sqlite 三個 build、印出真實 astify() 輸出後對照出來的，
 * 只寫我們實際會用到的欄位，其餘用 unknown 兜底。
 */
interface RawTableRef {
	db?: string | null;
	table: string;
}
/**
 * 欄位參照在不同方言長得不一樣：MySQL/T-SQL/SQLite 是 `{type:'column_ref', column: 'X'}`，
 * `column` 直接是字串。PostgreSQL 對雙引號包起來的識別字多包一層，
 * `column` 變成 `{expr: {type:'double_quote_string', value:'X'}}`。
 * 另外還有 SQLite 少數情況會整個解析成字串字面值節點 `{type:'double_quote_string', value:'X'}`
 * （我們自己匯出的 SQLite SQL 就是這種寫法，「匯出成 SQLite 再匯入回來」這條路徑會踩到）——
 * 用同一個 helper 把三種都接住。
 */
interface RawColumnRef {
	column?: string | { expr?: { value?: string } };
	value?: string;
}
function columnRefName(ref: RawColumnRef): string {
	if (typeof ref.column === 'string') return ref.column;
	if (ref.column?.expr?.value !== undefined) return ref.column.expr.value;
	return ref.value ?? '';
}

/** CREATE INDEX 的索引名稱：MySQL/T-SQL 是純字串，SQLite 是 `{schema, name}`。 */
type RawIndexName = string | { name: string };
function indexRefName(index: RawIndexName): string {
	return typeof index === 'string' ? index : index.name;
}
interface RawTypeDef {
	dataType: string;
	length?: number;
	scale?: number;
}
interface RawDefaultVal {
	value?: { type?: string; value?: unknown; name?: { name?: { value?: string }[] } };
}
interface RawColumnDefinition {
	resource: 'column';
	column: RawColumnRef;
	definition: RawTypeDef;
	nullable?: { type?: string };
	default_val?: RawDefaultVal;
	unique?: unknown;
	primary_key?: unknown;
	/** 欄位層級的 `REFERENCES t(col)`（PostgreSQL / SQLite / MySQL 都允許），跟表層級 FOREIGN KEY 同一個形狀。 */
	reference_definition?: RawReferenceDefinition;
}
interface RawReferenceDefinition {
	table: RawTableRef[];
	definition: RawColumnRef[];
}
interface RawConstraintDefinition {
	resource: 'constraint';
	constraint?: string | null;
	/** 內嵌的單純 KEY/INDEX（例如 `KEY idx_x (col)`）沒有這個欄位——實測跑出來的，不是文件記載的。 */
	constraint_type?: string;
	definition: RawColumnRef[];
	reference_definition?: RawReferenceDefinition;
}
type RawCreateDefinition = RawColumnDefinition | RawConstraintDefinition;

interface RawCreateTableNode {
	type: 'create';
	keyword: 'table';
	table: RawTableRef[];
	create_definitions: RawCreateDefinition[] | null;
}
interface RawCreateIndexNode {
	type: 'create';
	keyword: 'index';
	index: RawIndexName;
	index_type?: string | null;
	table: RawTableRef;
	index_columns: RawColumnRef[];
}
interface RawAlterExprAddConstraint {
	action: 'add';
	resource: 'constraint';
	create_definitions: RawConstraintDefinition;
}
interface RawAlterNode {
	type: 'alter';
	table: RawTableRef[];
	expr: unknown[];
}
interface RawGenericNode {
	type?: string;
	keyword?: string;
}

function renderDefaultValue(raw: RawDefaultVal | undefined): string | undefined {
	const value = raw?.value;
	if (!value) return undefined;
	if (value.type === 'function') {
		const fnName = value.name?.name?.[0]?.value;
		return fnName ? `${fnName}()` : undefined;
	}
	if (value.value === null || value.value === undefined) return undefined;
	return String(value.value);
}

function toColumnDef(raw: RawColumnDefinition): SqlColumnDef {
	const nullableType = raw.nullable?.type;
	return {
		name: columnRefName(raw.column),
		// 型別一律小寫，跟手寫的 DSL 一致（node-sql-parser 給的是大寫 BIGINT / TEXT）。
		typeName: raw.definition.dataType.toLowerCase(),
		length: raw.definition.scale === undefined ? raw.definition.length : undefined,
		precision: raw.definition.scale === undefined ? undefined : raw.definition.length,
		scale: raw.definition.scale,
		// 主鍵一定是 NOT NULL，就算 DDL 沒有明寫（`id bigint primary key`）也一樣。
		nullable: nullableType !== 'not null' && raw.primary_key === undefined,
		defaultValue: renderDefaultValue(raw.default_val),
		primaryKey: raw.primary_key !== undefined,
		unique: raw.unique !== undefined
	};
}

function toForeignKeyDef(raw: RawConstraintDefinition): SqlForeignKeyDef | undefined {
	const ref = raw.reference_definition;
	if (!ref) return undefined;
	const targetRef = ref.table[0];
	if (!targetRef) return undefined;
	return {
		constraintName: raw.constraint ?? undefined,
		sourceColumns: raw.definition.map(columnRefName),
		targetSchema: targetRef.db ?? undefined,
		targetTable: targetRef.table,
		targetColumns: ref.definition.map(columnRefName)
	};
}

function statementLabel(node: RawGenericNode): string {
	if (node.type === 'create' && node.keyword) return `CREATE ${node.keyword.toUpperCase()}`;
	if (node.type) return node.type.toUpperCase();
	return '未知語句';
}

function convertCreateTable(node: RawCreateTableNode): CreateTableStatement | UnsupportedStatement {
	const tableRef = node.table[0];
	if (!tableRef) return { kind: 'unsupported', statementType: 'CREATE TABLE（缺少表名）' };

	const columns: SqlColumnDef[] = [];
	let tablePrimaryKey: string[] | undefined;
	const tableUniques: { name?: string; columns: string[] }[] = [];
	const inlineForeignKeys: SqlForeignKeyDef[] = [];

	for (const def of node.create_definitions ?? []) {
		if (def.resource === 'column') {
			const column = toColumnDef(def);
			columns.push(column);
			// 欄位層級的 inline `REFERENCES users(id)`——之前直接被丟掉，匯入後關聯數是 0 卻沒有任何提示。
			const targetRef = def.reference_definition?.table[0];
			if (targetRef) {
				inlineForeignKeys.push({
					sourceColumns: [column.name],
					targetSchema: targetRef.db ?? undefined,
					targetTable: targetRef.table,
					targetColumns: def.reference_definition!.definition.map(columnRefName)
				});
			}
			continue;
		}
		// resource === 'constraint'——內嵌的單純 KEY/INDEX（非具名 constraint，例如
		// `KEY idx_x (col)`）沒有 constraint_type，安靜略過，跟其餘不支援的 constraint_type 一致。
		const type = def.constraint_type?.toLowerCase();
		if (type === undefined) {
			continue;
		} else if (type === 'primary key') {
			tablePrimaryKey = def.definition.map(columnRefName);
		} else if (type === 'unique') {
			tableUniques.push({ name: def.constraint ?? undefined, columns: def.definition.map(columnRefName) });
		} else if (type === 'foreign key') {
			const fk = toForeignKeyDef(def);
			if (fk) inlineForeignKeys.push(fk);
		}
		// 其餘 constraint_type（CHECK 等）目前不支援，安靜略過——欄位本身仍然保留。
	}

	return {
		kind: 'createTable',
		schema: tableRef.db ?? undefined,
		name: tableRef.table,
		columns,
		tablePrimaryKey,
		tableUniques,
		inlineForeignKeys
	};
}

function convertCreateIndex(node: RawCreateIndexNode): CreateIndexStatement {
	return {
		kind: 'createIndex',
		name: indexRefName(node.index),
		schema: node.table.db ?? undefined,
		table: node.table.table,
		columns: node.index_columns.map(columnRefName),
		unique: (node.index_type ?? '').toLowerCase() === 'unique'
	};
}

function convertAlter(node: RawAlterNode): AlterTableAddForeignKeyStatement | UnsupportedStatement {
	const tableRef = node.table[0];
	const addConstraint = (node.expr as RawAlterExprAddConstraint[]).find(
		(e) => e.action === 'add' && e.resource === 'constraint' && e.create_definitions?.constraint_type?.toLowerCase() === 'foreign key'
	);
	if (!tableRef || !addConstraint) return { kind: 'unsupported', statementType: 'ALTER TABLE（非新增外鍵約束）' };
	const fk = toForeignKeyDef(addConstraint.create_definitions);
	if (!fk) return { kind: 'unsupported', statementType: 'ALTER TABLE ADD CONSTRAINT（缺少參照目標）' };
	return { kind: 'alterAddForeignKey', schema: tableRef.db ?? undefined, table: tableRef.table, foreignKey: fk };
}

export function astToStatements(rawNodes: unknown[]): SqlStatement[] {
	return rawNodes.map((raw) => {
		const node = raw as RawGenericNode;
		if (node.type === 'create' && node.keyword === 'table') {
			return convertCreateTable(raw as RawCreateTableNode);
		}
		if (node.type === 'create' && node.keyword === 'index') {
			return convertCreateIndex(raw as RawCreateIndexNode);
		}
		if (node.type === 'alter') {
			return convertAlter(raw as RawAlterNode);
		}
		return { kind: 'unsupported', statementType: statementLabel(node) };
	});
}
