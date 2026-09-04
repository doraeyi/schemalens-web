import type { SchemaDiagnostic, SourceLocation } from "@schemalens/schema-core";
import type {
  ColumnNode,
  ColumnRefNode,
  IndexNode,
  MappingNode,
  QualifiedNameNode,
  RelationNode,
  SchemaFileNode,
  StatementNode,
  TableNode,
  TypeRefNode,
} from "./ast.js";
import { tokenize } from "./lexer.js";
import type { Token } from "./tokens.js";

export interface ParseResult {
  ast: SchemaFileNode;
  diagnostics: SchemaDiagnostic[];
}

/** 內部用的中止訊號；一定會在語句層被攔下來，不會外洩。 */
class ParseError extends Error {}

const STATEMENT_STARTERS = new Set(["table", "index", "relation", "unique"]);
const COLUMN_FLAGS = new Set(["pk", "fk", "uq", "idx"]);

/**
 * DSL Parser。
 *
 * 設計重點是**錯誤復原**：任何一個語句解析失敗，只會讓那個語句被丟掉，
 * 其餘語句照常產出 AST（US10：DSL 有錯不得讓 Preview 變白）。
 */
class Parser {
  private index = 0;
  private readonly diagnostics: SchemaDiagnostic[] = [];

  constructor(
    private readonly tokens: Token[],
    private readonly file?: string,
  ) {}

  parseFile(): ParseResult {
    const statements: StatementNode[] = [];
    this.skipNewlines();

    while (!this.atEnd()) {
      const start = this.index;
      try {
        const statement = this.parseStatement();
        if (statement) statements.push(statement);
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        this.recover();
      }
      // 保險：語句解析若沒有前進，強制前進一個 token，避免無限迴圈。
      if (this.index === start) this.advance();
      this.skipNewlines();
    }

    return { ast: { file: this.file, statements }, diagnostics: this.diagnostics };
  }

  // ------------------------------------------------------------- 語句

  private parseStatement(): StatementNode | null {
    const token = this.peek();
    const word = token.value.toLowerCase();
    if (token.type === "keyword" && (word === "unique" || word === "index")) return this.parseIndex();
    if (token.type === "keyword" && word === "table") return this.parseTable();
    if (token.type === "keyword" && word === "relation") return this.parseRelation();

    this.error(token.location, `預期 table / index / relation，卻讀到 '${token.value || "檔案結尾"}'`);
    throw new ParseError();
  }

  private parseTable(): TableNode {
    const start = this.expectKeyword("table");
    const name = this.parseQualifiedName();
    const comment = this.check("string") ? this.advance().value : undefined;
    this.expectPunct("{");
    this.skipNewlines();

    const columns: ColumnNode[] = [];
    while (!this.atEnd() && !this.checkPunct("}")) {
      const before = this.index;
      try {
        columns.push(this.parseColumn());
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        // 單一欄位壞掉只跳過那一行，同一張表的其他欄位仍然保留。
        this.skipToLineEnd();
      }
      if (this.index === before) this.advance();
      this.skipNewlines();
    }
    const end = this.expectPunct("}");

    return { kind: "table", name, comment, columns, location: span(start.location, end.location) };
  }

  private parseColumn(): ColumnNode {
    const flags: ColumnNode["flags"] = [];
    let start: Token | undefined;

    while (this.peek().type === "keyword" && COLUMN_FLAGS.has(this.peek().value.toLowerCase())) {
      const token = this.advance();
      start ??= token;
      flags.push(token.value.toUpperCase() as ColumnNode["flags"][number]);
    }

    const nameToken = this.expect("identifier", "預期欄位名稱");
    start ??= nameToken;
    const type = this.parseTypeRef();

    let nullable: boolean | undefined;
    if (this.checkKeyword("not")) {
      this.advance();
      this.expectKeyword("null");
      nullable = false;
    } else if (this.checkKeyword("null")) {
      this.advance();
      nullable = true;
    }

    let defaultValue: string | undefined;
    if (this.checkKeyword("default")) {
      this.advance();
      const token = this.peek();
      if (token.type === "number" || token.type === "string" || token.type === "identifier") {
        defaultValue = this.advance().value;
      } else {
        this.error(token.location, "default 後面需要數值、字串或識別字");
        throw new ParseError();
      }
    }

    const comment = this.check("string") ? this.advance().value : undefined;
    const end = this.previous();
    this.expectLineEnd();

    return {
      name: nameToken.value,
      type,
      flags,
      nullable,
      defaultValue,
      comment,
      location: span(start.location, end.location),
    };
  }

  private parseTypeRef(): TypeRefNode {
    const nameToken = this.expect("identifier", "預期欄位型別");
    const args: number[] = [];
    let end = nameToken;

    if (this.checkPunct("(")) {
      this.advance();
      while (!this.checkPunct(")") && !this.atEnd()) {
        const token = this.expect("number", "型別參數必須是數值");
        args.push(Number(token.value));
        if (this.checkPunct(",")) this.advance();
        else break;
      }
      end = this.expectPunct(")");
    }

    return { name: nameToken.value, args, location: span(nameToken.location, end.location) };
  }

  private parseIndex(): IndexNode {
    let unique = false;
    let start = this.peek();
    if (this.checkKeyword("unique")) {
      unique = true;
      start = this.advance();
    }
    const indexToken = this.expectKeyword("index");
    if (!unique) start = indexToken;

    const nameToken = this.expect("identifier", "預期 index 名稱");
    this.expectKeyword("on");
    const table = this.parseQualifiedName();
    this.expectPunct("(");
    const columns = this.parseColumnList();
    const end = this.expectPunct(")");
    this.expectLineEnd();

    return {
      kind: "index",
      name: nameToken.value,
      table,
      columns,
      unique,
      location: span(start.location, end.location),
    };
  }

  private parseRelation(): RelationNode {
    const start = this.expectKeyword("relation");
    const nameToken = this.expect("identifier", "預期 relation 名稱");
    this.expectPunct("{");
    this.skipNewlines();

    const mappings: MappingNode[] = [];
    while (!this.atEnd() && !this.checkPunct("}")) {
      const before = this.index;
      try {
        mappings.push(this.parseMapping());
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        this.skipToLineEnd();
      }
      if (this.index === before) this.advance();
      this.skipNewlines();
    }
    const end = this.expectPunct("}");

    if (mappings.length === 0) {
      this.error(span(start.location, end.location), "relation 至少需要一組欄位對應");
    }

    return {
      kind: "relation",
      name: nameToken.value,
      mappings,
      location: span(start.location, end.location),
    };
  }

  private parseMapping(): MappingNode {
    const source = this.parseColumnRef();
    const sourceCardinality = this.parseCardinality();
    this.expectPunct("->");
    const targetCardinality = this.parseCardinality();
    const target = this.parseColumnRef();
    this.expectLineEnd();

    return {
      source,
      target,
      sourceCardinality,
      targetCardinality,
      location: span(source.location, target.location),
    };
  }

  /** `Posts.AuthorId`、`Posts.(A, B)` 或 `sales.Orders.Id` */
  private parseColumnRef(): ColumnRefNode {
    const first = this.expect("identifier", "預期 Table 名稱");
    this.expectPunct(".");

    let schema: string | undefined;
    let tableName = first.value;
    let tableEnd = first;

    // 三段式 `schema.table.column`：第二段後面還有 '.' 才代表第一段是 schema。
    if (this.check("identifier") && this.peekAt(1).type === "punct" && this.peekAt(1).value === ".") {
      schema = first.value;
      tableName = this.advance().value;
      tableEnd = this.previous();
      this.expectPunct(".");
    }

    const table: QualifiedNameNode = {
      schema,
      name: tableName,
      location: span(first.location, tableEnd.location),
    };

    if (this.checkPunct("(")) {
      this.advance();
      const columns = this.parseColumnList();
      const end = this.expectPunct(")");
      return { table, columns, location: span(first.location, end.location) };
    }

    const columnToken = this.expect("identifier", "預期欄位名稱");
    return {
      table,
      columns: [columnToken.value],
      location: span(first.location, columnToken.location),
    };
  }

  private parseCardinality(): string {
    const token = this.peek();
    const value = token.value.toUpperCase();
    const isOne = token.type === "number" && value === "1";
    const isMany = token.type === "identifier" && (value === "N" || value === "M");
    if (isOne || isMany) {
      this.advance();
      return value;
    }
    this.error(token.location, `cardinality 只能是 1 / N / M，卻讀到 '${token.value}'`);
    throw new ParseError();
  }

  private parseColumnList(): string[] {
    const columns: string[] = [];
    while (!this.checkPunct(")") && !this.atEnd()) {
      columns.push(this.expect("identifier", "預期欄位名稱").value);
      if (this.checkPunct(",")) this.advance();
      else break;
    }
    return columns;
  }

  private parseQualifiedName(): QualifiedNameNode {
    const first = this.expect("identifier", "預期名稱");
    if (this.checkPunct(".")) {
      this.advance();
      const second = this.expect("identifier", "預期名稱");
      return {
        schema: first.value,
        name: second.value,
        location: span(first.location, second.location),
      };
    }
    return { name: first.value, location: first.location };
  }

  // ------------------------------------------------------------- 游標

  private peek(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!;
  }

  private peekAt(offset: number): Token {
    return this.tokens[this.index + offset] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)]!;
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== "eof") this.index++;
    return token;
  }

  private atEnd(): boolean {
    return this.peek().type === "eof";
  }

  private check(type: Token["type"]): boolean {
    return this.peek().type === type;
  }

  private checkPunct(value: string): boolean {
    return this.peek().type === "punct" && this.peek().value === value;
  }

  private checkKeyword(word: string): boolean {
    return this.peek().type === "keyword" && this.peek().value.toLowerCase() === word;
  }

  private expect(type: Token["type"], message: string): Token {
    if (!this.check(type)) {
      this.error(this.peek().location, `${message}，卻讀到 '${this.peek().value || "換行"}'`);
      throw new ParseError();
    }
    return this.advance();
  }

  private expectPunct(value: string): Token {
    if (!this.checkPunct(value)) {
      this.error(this.peek().location, `預期 '${value}'，卻讀到 '${this.peek().value || "換行"}'`);
      throw new ParseError();
    }
    return this.advance();
  }

  private expectKeyword(word: string): Token {
    if (!this.checkKeyword(word)) {
      this.error(this.peek().location, `預期關鍵字 '${word}'，卻讀到 '${this.peek().value || "換行"}'`);
      throw new ParseError();
    }
    return this.advance();
  }

  /** 語句必須以換行（或 `}` / EOF）結束，避免一行塞兩個定義。 */
  private expectLineEnd(): void {
    if (this.check("newline")) {
      this.advance();
      return;
    }
    if (this.atEnd() || this.checkPunct("}")) return;
    this.error(this.peek().location, `這一行多了 '${this.peek().value}'`);
    throw new ParseError();
  }

  private skipNewlines(): void {
    while (this.check("newline")) this.advance();
  }

  private skipToLineEnd(): void {
    while (!this.atEnd() && !this.check("newline") && !this.checkPunct("}")) this.advance();
    if (this.check("newline")) this.advance();
  }

  /** 跳到下一個語句起點，讓後面的內容還有機會被解析。 */
  private recover(): void {
    while (!this.atEnd()) {
      if (this.checkPunct("}")) {
        this.advance();
        return;
      }
      if (this.peek().type === "keyword" && STATEMENT_STARTERS.has(this.peek().value.toLowerCase())) {
        return;
      }
      this.advance();
    }
  }

  private error(location: SourceLocation, message: string): void {
    // 同一個位置只留第一則診斷，避免連鎖錯誤洗版 Problems Panel。
    const duplicate = this.diagnostics.some(
      (d) => d.location?.line === location.line && d.location?.column === location.column,
    );
    if (duplicate) return;
    this.diagnostics.push({ code: "SCHEMA_PARSE_ERROR", severity: "error", message, location });
  }
}

function span(start: SourceLocation, end: SourceLocation): SourceLocation {
  return {
    file: start.file,
    line: start.line,
    column: start.column,
    endLine: end.endLine ?? end.line,
    endColumn: end.endColumn ?? end.column,
  };
}

export function parse(source: string, file?: string): ParseResult {
  const { tokens, diagnostics } = tokenize(source, file);
  const result = new Parser(tokens, file).parseFile();
  return { ast: result.ast, diagnostics: [...diagnostics, ...result.diagnostics] };
}
