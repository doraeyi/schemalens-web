import type { Column } from '@schemalens/schema-core';
import type { SqlDialect, SqlDialectId } from './types';

type TypeCategory =
	| 'tinyint'
	| 'smallint'
	| 'int'
	| 'bigint'
	| 'decimal'
	| 'float'
	| 'char'
	| 'varchar'
	| 'text'
	| 'binary'
	| 'varbinary'
	| 'blob'
	| 'boolean'
	| 'date'
	| 'time'
	| 'datetime'
	| 'timestamp'
	| 'uuid'
	| 'json';

/** DSL 型別是自由文字（parser 不限制固定集合），這裡只認最常見的別名。 */
const TYPE_ALIASES: Record<string, TypeCategory> = {
	tinyint: 'tinyint',
	smallint: 'smallint',
	int: 'int',
	integer: 'int',
	bigint: 'bigint',
	decimal: 'decimal',
	numeric: 'decimal',
	float: 'float',
	real: 'float',
	double: 'float',
	char: 'char',
	nchar: 'char',
	varchar: 'varchar',
	nvarchar: 'varchar',
	text: 'text',
	ntext: 'text',
	tinytext: 'text',
	mediumtext: 'text',
	longtext: 'text',
	binary: 'binary',
	varbinary: 'varbinary',
	blob: 'blob',
	image: 'blob',
	bit: 'boolean',
	boolean: 'boolean',
	bool: 'boolean',
	date: 'date',
	time: 'time',
	datetime: 'datetime',
	datetime2: 'datetime',
	smalldatetime: 'datetime',
	timestamp: 'timestamp',
	uniqueidentifier: 'uuid',
	uuid: 'uuid',
	guid: 'uuid',
	json: 'json'
};

function category(column: Column): TypeCategory | undefined {
	return TYPE_ALIASES[column.type.trim().toLowerCase()];
}

/** 對照表以外的型別：照抄使用者寫的名稱，盡量保留 length/precision/scale。 */
function passthroughType(column: Column): string {
	const name = column.type.trim().toUpperCase();
	if (column.precision !== undefined) {
		return `${name}(${column.precision}${column.scale !== undefined ? `,${column.scale}` : ''})`;
	}
	if (column.length !== undefined) return `${name}(${column.length})`;
	return name;
}

function decimalOf(column: Column): string {
	return `(${column.precision ?? 18}${column.scale !== undefined ? `,${column.scale}` : ',0'})`;
}

/** 用雙寫收尾字元的方式跳脫，例如 `` ` `` -> ` `` `，`]` -> `]]`，`"` -> `""`。 */
function quoteWith(open: string, close: string) {
	return (name: string) => open + name.split(close).join(close + close) + close;
}

export const mysqlDialect: SqlDialect = {
	id: 'mysql',
	quoteIdentifier: quoteWith('`', '`'),
	inlineForeignKeys: false,
	qualifyTableName(table) {
		return this.quoteIdentifier(table.name);
	},
	renderType(column) {
		const cat = category(column);
		if (!cat) return passthroughType(column);
		switch (cat) {
			case 'tinyint':
				return 'TINYINT';
			case 'smallint':
				return 'SMALLINT';
			case 'int':
				return 'INT';
			case 'bigint':
				return 'BIGINT';
			case 'decimal':
				return `DECIMAL${decimalOf(column)}`;
			case 'float':
				return 'DOUBLE';
			case 'char':
				return `CHAR(${column.length ?? 1})`;
			case 'varchar':
				return `VARCHAR(${column.length ?? 255})`;
			case 'text':
				return 'TEXT';
			case 'binary':
				return `BINARY(${column.length ?? 1})`;
			case 'varbinary':
				return `VARBINARY(${column.length ?? 255})`;
			case 'blob':
				return 'BLOB';
			case 'boolean':
				return 'BOOLEAN';
			case 'date':
				return 'DATE';
			case 'time':
				return 'TIME';
			case 'datetime':
				return 'DATETIME';
			case 'timestamp':
				return 'TIMESTAMP';
			case 'uuid':
				return 'CHAR(36)';
			case 'json':
				return 'JSON';
			default:
				return passthroughType(column);
		}
	}
};

export const mssqlDialect: SqlDialect = {
	id: 'mssql',
	quoteIdentifier: quoteWith('[', ']'),
	inlineForeignKeys: false,
	qualifyTableName(table) {
		return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
	},
	renderType(column) {
		const cat = category(column);
		if (!cat) return passthroughType(column);
		switch (cat) {
			case 'tinyint':
				return 'TINYINT';
			case 'smallint':
				return 'SMALLINT';
			case 'int':
				return 'INT';
			case 'bigint':
				return 'BIGINT';
			case 'decimal':
				return `DECIMAL${decimalOf(column)}`;
			case 'float':
				return 'FLOAT';
			case 'char':
				return `CHAR(${column.length ?? 1})`;
			case 'varchar':
				return `NVARCHAR(${column.length ?? 255})`;
			case 'text':
				return 'NVARCHAR(MAX)';
			case 'binary':
				return `BINARY(${column.length ?? 1})`;
			case 'varbinary':
				return `VARBINARY(${column.length ?? 255})`;
			case 'blob':
				return 'VARBINARY(MAX)';
			case 'boolean':
				return 'BIT';
			case 'date':
				return 'DATE';
			case 'time':
				return 'TIME';
			case 'datetime':
				return 'DATETIME2';
			case 'timestamp':
				return 'DATETIME2';
			case 'uuid':
				return 'UNIQUEIDENTIFIER';
			case 'json':
				return 'NVARCHAR(MAX)';
			default:
				return passthroughType(column);
		}
	}
};

export const sqliteDialect: SqlDialect = {
	id: 'sqlite',
	quoteIdentifier: quoteWith('"', '"'),
	inlineForeignKeys: true,
	qualifyTableName(table) {
		return this.quoteIdentifier(table.name);
	},
	renderType(column) {
		const cat = category(column);
		if (!cat) return passthroughType(column);
		switch (cat) {
			case 'tinyint':
			case 'smallint':
			case 'int':
			case 'bigint':
			case 'boolean':
				return 'INTEGER';
			case 'decimal':
				return `NUMERIC${decimalOf(column)}`;
			case 'float':
				return 'REAL';
			case 'char':
			case 'varchar':
			case 'text':
			case 'date':
			case 'time':
			case 'datetime':
			case 'timestamp':
			case 'uuid':
			case 'json':
				return 'TEXT';
			case 'binary':
			case 'varbinary':
			case 'blob':
				return 'BLOB';
			default:
				return passthroughType(column);
		}
	}
};

export const postgresqlDialect: SqlDialect = {
	id: 'postgresql',
	quoteIdentifier: quoteWith('"', '"'),
	inlineForeignKeys: false,
	qualifyTableName(table) {
		return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
	},
	renderType(column) {
		const cat = category(column);
		if (!cat) return passthroughType(column);
		switch (cat) {
			case 'tinyint':
			case 'smallint':
				return 'SMALLINT';
			case 'int':
				return 'INTEGER';
			case 'bigint':
				return 'BIGINT';
			case 'decimal':
				return `NUMERIC${decimalOf(column)}`;
			case 'float':
				return 'DOUBLE PRECISION';
			case 'char':
				return `CHAR(${column.length ?? 1})`;
			case 'varchar':
				return `VARCHAR(${column.length ?? 255})`;
			case 'text':
				return 'TEXT';
			case 'binary':
			case 'varbinary':
			case 'blob':
				return 'BYTEA';
			case 'boolean':
				return 'BOOLEAN';
			case 'date':
				return 'DATE';
			case 'time':
				return 'TIME';
			case 'datetime':
			case 'timestamp':
				return 'TIMESTAMP';
			case 'uuid':
				return 'UUID';
			case 'json':
				return 'JSONB';
			default:
				return passthroughType(column);
		}
	}
};

export const SQL_DIALECT_MAP: Record<SqlDialectId, SqlDialect> = {
	mysql: mysqlDialect,
	mssql: mssqlDialect,
	sqlite: sqliteDialect,
	postgresql: postgresqlDialect
};
