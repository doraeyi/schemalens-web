import type { SourceLocation } from "@schemalens/schema-core";

/**
 * AST 保留原始寫法（含 schema 是否省略、cardinality 原始 token），
 * 讓 Serializer 之後能做到穩定的 DSL round-trip。
 */
export interface QualifiedNameNode {
  schema?: string;
  name: string;
  location: SourceLocation;
}

export interface TypeRefNode {
  name: string;
  args: number[];
  location: SourceLocation;
}

export interface ColumnNode {
  name: string;
  type: TypeRefNode;
  flags: Array<"PK" | "FK" | "UQ" | "IDX">;
  /** 未寫 nullability 時為 undefined，語意由 astToSchema 決定。 */
  nullable?: boolean;
  defaultValue?: string;
  comment?: string;
  location: SourceLocation;
}

export interface TableNode {
  kind: "table";
  name: QualifiedNameNode;
  comment?: string;
  /** `table X ... in Identity { }` 的群組名稱。 */
  group?: string;
  columns: ColumnNode[];
  location: SourceLocation;
}

export interface GroupNode {
  kind: "group";
  name: string;
  description?: string;
  /** 區塊形式列出的成員；沒有區塊時為空陣列。 */
  members: QualifiedNameNode[];
  location: SourceLocation;
}

export interface IndexNode {
  kind: "index";
  name: string;
  table: QualifiedNameNode;
  columns: string[];
  unique: boolean;
  location: SourceLocation;
}

export interface ColumnRefNode {
  table: QualifiedNameNode;
  columns: string[];
  location: SourceLocation;
}

export interface MappingNode {
  source: ColumnRefNode;
  target: ColumnRefNode;
  sourceCardinality: string;
  targetCardinality: string;
  location: SourceLocation;
}

export interface RelationNode {
  kind: "relation";
  name: string;
  mappings: MappingNode[];
  location: SourceLocation;
}

export type StatementNode = TableNode | IndexNode | RelationNode | GroupNode;

export interface SchemaFileNode {
  file?: string;
  statements: StatementNode[];
}
