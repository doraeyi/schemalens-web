/**
 * DBSchema Domain Model.
 *
 * 這一層是整個產品的中心，MUST NOT 依賴 VS Code / Webview / Renderer / Layout。
 * 任何 UI 狀態（focus、zoom、node position）都不屬於這裡。
 */

/** DSL 原始位置，供 Diagnostics 與 Preview → Source Navigation 使用。 */
export interface SourceLocation {
  /** 來源檔案（未知時可為 undefined，例如 JSON import）。 */
  file?: string;
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
  /** 1-based，結束行（單行時等於 line）。 */
  endLine?: number;
  /** 1-based，結束欄。 */
  endColumn?: number;
}

export type Cardinality = "1:1" | "1:N" | "N:1" | "N:M";

/** `schema.table`，例如 `dbo.Users`。 */
export type TableId = string;

export interface Column {
  name: string;
  /** 已正規化的型別名稱，例如 `nvarchar`。 */
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  comment?: string;
  primaryKey: boolean;
  foreignKey: boolean;
  unique: boolean;
  /** 是否被任一 index 涵蓋（由 schema 推導，不是 DSL 直接欄位）。 */
  indexed: boolean;
  location?: SourceLocation;
}

export interface Index {
  name: string;
  /** Composite index 必須保留順序。 */
  columns: string[];
  unique: boolean;
  location?: SourceLocation;
}

export interface Table {
  /** `schema.name` */
  id: TableId;
  schema: string;
  name: string;
  comment?: string;
  columns: Column[];
  indexes: Index[];
  location?: SourceLocation;
}

export interface Relation {
  name: string;
  sourceTable: TableId;
  /** Composite FK 依序對應 targetColumns。 */
  sourceColumns: string[];
  targetTable: TableId;
  targetColumns: string[];
  cardinality: Cardinality;
  location?: SourceLocation;
}

export interface SchemaMetadata {
  name?: string;
  defaultSchema: string;
  [key: string]: unknown;
}

export interface Schema {
  /** Domain model 版本，用於 JSON round-trip 相容性。 */
  version: string;
  metadata: SchemaMetadata;
  tables: Table[];
  relations: Relation[];
}

export const SCHEMA_VERSION = "1";
export const DEFAULT_SCHEMA_NAME = "dbo";
