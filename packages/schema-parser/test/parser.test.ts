import { describe, expect, it } from "vitest";
import { parse, parseSchema, tokenize } from "@schemalens/schema-parser";

const BLOG = `// 部落格系統
table Users "系統使用者" {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "文章" {
  PK Id        bigint         not null
  FK AuthorId  bigint         not null "作者"
     Title     nvarchar(200)  not null
     Price     decimal(18,2)  null default 0
}

index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)
unique index UX_Users_Email on Users(Email)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
`;

describe("tokenize", () => {
  it("換行是有意義的 token", () => {
    const { tokens } = tokenize("table A {\n}\n");
    expect(tokens.filter((t) => t.type === "newline")).toHaveLength(2);
  });

  it("// 註解不會吃掉換行", () => {
    const { tokens } = tokenize("// 註解\ntable A {}");
    expect(tokens[0]!.type).toBe("newline");
  });

  it("字串保留中文並解逸出雙引號", () => {
    const { tokens } = tokenize('"系統\\"使用者"');
    expect(tokens[0]!.value).toBe('系統"使用者');
  });

  it("未結束的字串回報診斷但不中止", () => {
    const { tokens, diagnostics } = tokenize('table A "沒收尾\n');
    expect(diagnostics[0]!.code).toBe("SCHEMA_PARSE_ERROR");
    expect(tokens.some((t) => t.type === "eof")).toBe(true);
  });

  it("-> 併成單一 token", () => {
    const { tokens } = tokenize("A.b N -> 1 C.d");
    expect(tokens.some((t) => t.value === "->")).toBe(true);
  });

  it("位置是 1-based 的行與欄", () => {
    const { tokens } = tokenize("table\n  Users");
    const users = tokens.find((t) => t.value === "Users")!;
    expect(users.location.line).toBe(2);
    expect(users.location.column).toBe(3);
  });
});

describe("parse", () => {
  it("完整範例沒有診斷", () => {
    const { ast, diagnostics } = parse(BLOG, "database.dbschema");
    expect(diagnostics).toEqual([]);
    expect(ast.statements).toHaveLength(5);
  });

  it("解析 table 與欄位旗標、型別參數、註解", () => {
    const { ast } = parse(BLOG);
    const users = ast.statements.find((s) => s.kind === "table" && s.name.name === "Users");
    expect(users?.kind).toBe("table");
    if (users?.kind !== "table") return;

    expect(users.comment).toBe("系統使用者");
    expect(users.columns).toHaveLength(4);
    expect(users.columns[0]!.flags).toEqual(["PK"]);
    expect(users.columns[1]!.type).toMatchObject({ name: "nvarchar", args: [255] });
    expect(users.columns[1]!.comment).toBe("登入 Email");
    expect(users.columns[3]!.defaultValue).toBe("sysutcdatetime()");
  });

  it("decimal(18,2) 保留兩個參數", () => {
    const { ast } = parse(BLOG);
    const posts = ast.statements.find((s) => s.kind === "table" && s.name.name === "Posts");
    if (posts?.kind !== "table") throw new Error("missing");
    expect(posts.columns[3]!.type.args).toEqual([18, 2]);
  });

  it("解析 index 與 unique index", () => {
    const { ast } = parse(BLOG);
    const indexes = ast.statements.filter((s) => s.kind === "index");
    expect(indexes).toHaveLength(2);
    expect(indexes[0]).toMatchObject({ name: "IX_Posts_Author_CreatedAt", columns: ["AuthorId", "CreatedAt"], unique: false });
    expect(indexes[1]).toMatchObject({ name: "UX_Users_Email", unique: true });
  });

  it("解析 relation 的欄位對應與 cardinality", () => {
    const { ast } = parse(BLOG);
    const relation = ast.statements.find((s) => s.kind === "relation");
    if (relation?.kind !== "relation") throw new Error("missing");
    expect(relation.mappings[0]).toMatchObject({
      sourceCardinality: "N",
      targetCardinality: "1",
    });
    expect(relation.mappings[0]!.source.columns).toEqual(["AuthorId"]);
    expect(relation.mappings[0]!.target.columns).toEqual(["Id"]);
  });

  it("解析 composite relation", () => {
    const { ast, diagnostics } = parse(`relation R {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}`);
    expect(diagnostics).toEqual([]);
    const relation = ast.statements[0];
    if (relation?.kind !== "relation") throw new Error("missing");
    expect(relation.mappings[0]!.source.columns).toEqual(["OrderId", "TenantId"]);
  });

  it("解析 schema.table 三段式欄位參照", () => {
    const { ast, diagnostics } = parse(`relation R {
  sales.Orders.UserId N -> 1 dbo.Users.Id
}`);
    expect(diagnostics).toEqual([]);
    const relation = ast.statements[0];
    if (relation?.kind !== "relation") throw new Error("missing");
    expect(relation.mappings[0]!.source.table).toMatchObject({ schema: "sales", name: "Orders" });
    expect(relation.mappings[0]!.target.table).toMatchObject({ schema: "dbo", name: "Users" });
  });

  it("關鍵字不分大小寫", () => {
    const { diagnostics } = parse("TABLE A {\n  PK Id BIGINT NOT NULL\n}");
    expect(diagnostics).toEqual([]);
  });
});

describe("錯誤復原（US10）", () => {
  it("壞掉的欄位只影響那一行，同表其他欄位仍保留", () => {
    const { ast, diagnostics } = parse(`table A {
  PK Id bigint not null
  Broken ???
  Name nvarchar(50) null
}`);
    expect(diagnostics.length).toBeGreaterThan(0);
    const table = ast.statements[0];
    if (table?.kind !== "table") throw new Error("missing");
    expect(table.columns.map((c) => c.name)).toEqual(["Id", "Name"]);
  });

  it("壞掉的語句不影響後面的 table", () => {
    const { ast, diagnostics } = parse(`nonsense here
table Good {
  PK Id bigint not null
}`);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(ast.statements.filter((s) => s.kind === "table")).toHaveLength(1);
  });

  it("缺少右大括號不會無限迴圈", () => {
    const { diagnostics } = parse("table A {\n  PK Id bigint not null\n");
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it("cardinality 寫錯會回報並跳過該行", () => {
    const { diagnostics } = parse(`relation R {
  A.b X -> 1 C.d
}`);
    expect(diagnostics.some((d) => d.message.includes("cardinality"))).toBe(true);
  });

  it("同一個位置不會重複回報", () => {
    const { diagnostics } = parse("table {");
    const keys = diagnostics.map((d) => `${d.location?.line}:${d.location?.column}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("診斷帶著 file / line / column（plan §15）", () => {
    const { diagnostics } = parse("table A {\n  Broken ???\n}", "database.dbschema");
    const first = diagnostics[0]!;
    expect(first.location?.file).toBe("database.dbschema");
    expect(first.location?.line).toBe(2);
    expect(first.location?.column).toBeGreaterThan(0);
  });
});

describe("parseSchema", () => {
  it("產出 Domain Model：id、型別、nullable、comment", () => {
    const { schema, diagnostics } = parseSchema(BLOG, "database.dbschema");
    expect(diagnostics).toEqual([]);
    expect(schema.tables.map((t) => t.id)).toEqual(["dbo.Users", "dbo.Posts"]);

    const email = schema.tables[0]!.columns[1]!;
    expect(email).toMatchObject({ type: "nvarchar", length: 255, nullable: false, unique: true });

    const price = schema.tables[1]!.columns[3]!;
    expect(price).toMatchObject({ type: "decimal", precision: 18, scale: 2, nullable: true, defaultValue: "0" });
  });

  it("PK 隱含 not null，未標示的欄位預設可為空", () => {
    const { schema } = parseSchema("table A {\n  PK Id bigint\n  Name nvarchar(50)\n}");
    expect(schema.tables[0]!.columns[0]!.nullable).toBe(false);
    expect(schema.tables[0]!.columns[1]!.nullable).toBe(true);
  });

  it("index 掛到對應的 table 上並保留欄位順序", () => {
    const { schema } = parseSchema(BLOG);
    const posts = schema.tables.find((t) => t.name === "Posts")!;
    expect(posts.indexes[0]).toMatchObject({
      name: "IX_Posts_Author_CreatedAt",
      columns: ["AuthorId", "CreatedAt"],
      unique: false,
    });
  });

  it("relation 帶出 cardinality 與欄位對應", () => {
    const { schema } = parseSchema(BLOG);
    expect(schema.relations[0]).toMatchObject({
      name: "FK_Posts_Users",
      sourceTable: "dbo.Posts",
      sourceColumns: ["AuthorId"],
      targetTable: "dbo.Users",
      targetColumns: ["Id"],
      cardinality: "N:1",
    });
  });

  it("cardinality 四種組合都對", () => {
    const cases: Array<[string, string]> = [
      ["N -> 1", "N:1"],
      ["1 -> N", "1:N"],
      ["1 -> 1", "1:1"],
      ["N -> M", "N:M"],
    ];
    for (const [written, expected] of cases) {
      const { schema } = parseSchema(`relation R {\n  A.b ${written} C.d\n}`);
      expect(schema.relations[0]!.cardinality).toBe(expected);
    }
  });

  it("relation 的來源欄位會被標成 FK，index 欄位標成 indexed", () => {
    const { schema } = parseSchema(BLOG);
    const posts = schema.tables.find((t) => t.name === "Posts")!;
    expect(posts.columns.find((c) => c.name === "AuthorId")!.foreignKey).toBe(true);
    expect(posts.columns.find((c) => c.name === "AuthorId")!.indexed).toBe(true);
  });

  it("每個 table / column 都帶 SourceLocation（Stage 9 需要）", () => {
    const { schema } = parseSchema(BLOG, "database.dbschema");
    expect(schema.tables[0]!.location).toMatchObject({ file: "database.dbschema", line: 2 });
    expect(schema.tables[0]!.columns[0]!.location?.line).toBe(3);
  });

  it("重複的 Table / Column 會回報且只保留第一個", () => {
    const { schema, diagnostics } = parseSchema(`table A {
  PK Id bigint not null
  Id nvarchar(10) null
}
table A {
  PK Id bigint not null
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_DUPLICATE_COLUMN");
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_DUPLICATE_TABLE");
    expect(schema.tables).toHaveLength(1);
    expect(schema.tables[0]!.columns).toHaveLength(1);
  });

  it("index 掛在不存在的 table 會回報", () => {
    const { diagnostics } = parseSchema("index IX_X on Ghost(Id)");
    expect(diagnostics[0]!.code).toBe("SCHEMA_UNKNOWN_TABLE");
  });

  it("composite relation 混到不同 table 會回報", () => {
    const { diagnostics } = parseSchema(`relation R {
  A.x N -> 1 B.y
  C.x N -> 1 B.y
}`);
    expect(diagnostics[0]!.code).toBe("SCHEMA_INVALID_COMPOSITE_RELATION");
  });

  it("預設 schema 可覆寫", () => {
    const { schema } = parseSchema("table A {\n  PK Id bigint\n}", undefined, { defaultSchema: "sales" });
    expect(schema.tables[0]!.id).toBe("sales.A");
  });

  it("空檔案產出空 Schema 而不是丟錯", () => {
    const { schema, diagnostics } = parseSchema("");
    expect(schema.tables).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});
