import { describe, expect, it } from "vitest";
import type { Schema } from "@schemalens/schema-core";
import { validateSchema } from "@schemalens/schema-core";
import { parseSchema } from "@schemalens/schema-parser";
import { generateSchema } from "@schemalens/schema-fixtures";
import { fromJson, toDsl, toJson } from "@schemalens/schema-serializer";

const SOURCE = `table Users "系統使用者" {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "文章" {
  PK Id       bigint        not null
  FK AuthorId bigint        not null "作者"
     Title    nvarchar(200) not null
     Price    decimal(18,2) null default 0
}

index IX_Posts_Author_CreatedAt on Posts(AuthorId, Title)
unique index UX_Users_Email on Users(Email)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
`;

const { schema: original } = parseSchema(SOURCE, "database.dbschema");

/** 比較語意，忽略 SourceLocation 與 table / relation 的排列順序。 */
function normalize(schema: Schema): unknown {
  return {
    tables: [...schema.tables]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((table) => ({
        id: table.id,
        comment: table.comment,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          length: column.length,
          precision: column.precision,
          scale: column.scale,
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          comment: column.comment,
          primaryKey: column.primaryKey,
          foreignKey: column.foreignKey,
          unique: column.unique,
          indexed: column.indexed,
        })),
        indexes: table.indexes.map((index) => ({
          name: index.name,
          columns: index.columns,
          unique: index.unique,
        })),
      })),
    relations: [...schema.relations]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((relation) => ({
        name: relation.name,
        sourceTable: relation.sourceTable,
        sourceColumns: relation.sourceColumns,
        targetTable: relation.targetTable,
        targetColumns: relation.targetColumns,
        cardinality: relation.cardinality,
      })),
  };
}

describe("toJson", () => {
  it("輸出可被 JSON.parse 且保留欄位語意", () => {
    const parsed = JSON.parse(toJson(original));
    expect(parsed.tables).toHaveLength(2);
    const users = parsed.tables.find((t: { name: string }) => t.name === "Users");
    expect(users.columns[1]).toMatchObject({ name: "Email", type: "nvarchar", length: 255, unique: true });
  });

  it("deterministic：同一份 Schema 永遠輸出同一段文字", () => {
    expect(toJson(original)).toBe(toJson(original));
  });

  it("table 依 id 排序、relation 依名稱排序，方便 git diff", () => {
    const parsed = JSON.parse(toJson(original));
    expect(parsed.tables.map((t: { id: string }) => t.id)).toEqual(["dbo.Posts", "dbo.Users"]);
  });

  it("欄位與 composite index 的順序不排序（有語意）", () => {
    const parsed = JSON.parse(toJson(original));
    const posts = parsed.tables.find((t: { name: string }) => t.name === "Posts");
    expect(posts.columns.map((c: { name: string }) => c.name)).toEqual(["Id", "AuthorId", "Title", "Price"]);
    expect(posts.indexes[0].columns).toEqual(["AuthorId", "Title"]);
  });

  it("預設不輸出 SourceLocation，可用 option 開啟", () => {
    expect(toJson(original)).not.toContain('"location"');
    expect(toJson(original, { includeLocations: true })).toContain('"location"');
  });
});

describe("fromJson", () => {
  it("JSON → Schema 語意與來源一致", () => {
    const { schema, diagnostics } = fromJson(toJson(original));
    expect(diagnostics).toEqual([]);
    expect(normalize(schema)).toEqual(normalize(original));
  });

  it("壞掉的 JSON 回傳空 Schema 與診斷，不丟例外（US10）", () => {
    const { schema, diagnostics } = fromJson("{ not json");
    expect(schema.tables).toEqual([]);
    expect(diagnostics[0]!.code).toBe("SCHEMA_PARSE_ERROR");
  });

  it("根節點不是物件也不會炸", () => {
    expect(fromJson("[]").diagnostics.length).toBe(1);
  });

  it("缺 name 的 table / column 會被跳過並回報", () => {
    const { schema, diagnostics } = fromJson(
      JSON.stringify({ tables: [{ name: "A", columns: [{ type: "bigint" }] }, { columns: [] }] }),
    );
    expect(schema.tables).toHaveLength(1);
    expect(schema.tables[0]!.columns).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
  });

  it("缺欄位時套用預設值（nullable 預設 true、type 預設 unknown）", () => {
    const { schema } = fromJson(JSON.stringify({ tables: [{ name: "A", columns: [{ name: "X" }] }] }));
    expect(schema.tables[0]!.columns[0]).toMatchObject({ type: "unknown", nullable: true });
  });

  it("不合法的 cardinality 退回 N:1 並回報", () => {
    const { schema, diagnostics } = fromJson(
      JSON.stringify({
        relations: [{ name: "R", sourceTable: "dbo.A", targetTable: "dbo.B", cardinality: "many" }],
      }),
    );
    expect(schema.relations[0]!.cardinality).toBe("N:1");
    expect(diagnostics.some((d) => d.message.includes("cardinality"))).toBe(true);
  });

  it("沒有 tables / relations 欄位時視為空 Schema", () => {
    const { schema, diagnostics } = fromJson("{}");
    expect(schema.tables).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});

describe("toDsl", () => {
  it("輸出可以被 Parser 重新解析且沒有診斷", () => {
    const text = toDsl(original);
    const reparsed = parseSchema(text, "round-trip.dbschema");
    expect(reparsed.diagnostics).toEqual([]);
    expect(validateSchema(reparsed.schema)).toEqual([]);
  });

  it("deterministic：同一份 Schema 永遠輸出同一段文字", () => {
    expect(toDsl(original)).toBe(toDsl(original));
  });

  it("欄位對齊成欄狀，可讀性優先", () => {
    const text = toDsl(original);
    expect(text).toContain('table dbo.Users "系統使用者" {');
    expect(text).toMatch(/PK\s+Id\s+bigint\s+not null "使用者 ID"/);
  });

  it("帶括號的預設值會加引號，重新解析才不會壞", () => {
    expect(toDsl(original)).toContain('default "sysutcdatetime()"');
  });

  it("數值預設值不加引號", () => {
    expect(toDsl(original)).toContain("default 0");
  });

  it("index 與 unique index 分別輸出", () => {
    const text = toDsl(original);
    expect(text).toContain("index IX_Posts_Author_CreatedAt on dbo.Posts(AuthorId, Title)");
    expect(text).toContain("unique index UX_Users_Email on dbo.Users(Email)");
  });

  it("relation 輸出欄位級對應與 cardinality", () => {
    expect(toDsl(original)).toContain("dbo.Posts.AuthorId N -> 1 dbo.Users.Id");
  });

  it("composite relation 用括號形式", () => {
    const { schema } = parseSchema(`table A {
  PK Id bigint not null
  X bigint not null
  Y bigint not null
}
table B {
  PK Id bigint not null
  Z bigint not null
}
relation R {
  A.(X, Y) N -> 1 B.(Id, Z)
}`);
    expect(toDsl(schema)).toContain("dbo.A.(X, Y) N -> 1 dbo.B.(Id, Z)");
  });

  it("N:M 以 N -> N 輸出，重新解析仍是 N:M", () => {
    const { schema } = parseSchema(`table A {
  PK Id bigint not null
}
table B {
  PK Id bigint not null
}
relation R {
  A.Id N -> M B.Id
}`);
    const text = toDsl(schema);
    expect(text).toContain("N -> N");
    expect(parseSchema(text).schema.relations[0]!.cardinality).toBe("N:M");
  });

  it("空 Schema 輸出空字串", () => {
    expect(toDsl({ version: "1", metadata: { defaultSchema: "dbo" }, tables: [], relations: [] })).toBe("");
  });
});

describe("Round Trip（AC-19 / plan §36）", () => {
  it("DSL → Schema → JSON → Schema → DSL 語意一致", () => {
    const json = toJson(original);
    const restored = fromJson(json).schema;
    const dsl = toDsl(restored);
    const final = parseSchema(dsl, "round-trip.dbschema").schema;

    expect(normalize(final)).toEqual(normalize(original));
  });

  it("再跑一輪 DSL 完全相同（收斂，不會每次都變）", () => {
    const first = toDsl(fromJson(toJson(original)).schema);
    const second = toDsl(fromJson(toJson(parseSchema(first).schema)).schema);
    expect(second).toBe(first);
  });

  it("JSON 也收斂：同一份 Schema 兩次輸出完全相同", () => {
    const first = toJson(original);
    const second = toJson(fromJson(first).schema);
    expect(second).toBe(first);
  });

  it("100 表的合成 Schema 也能完成 round trip", () => {
    const synthetic = generateSchema({ tableCount: 100 });
    const restored = fromJson(toJson(synthetic)).schema;
    const final = parseSchema(toDsl(restored)).schema;

    expect(final.tables).toHaveLength(synthetic.tables.length);
    expect(final.relations).toHaveLength(synthetic.relations.length);
    expect(normalize(final)).toEqual(normalize(synthetic));
  });
});

describe("群組 round trip", () => {
  const source = `group Identity "身分與權限模組"
group Sales "訂單與金流"

table Users "系統使用者" in Identity {
  PK Id bigint not null
}

table Orders in Sales {
  PK Id bigint not null
}

table Logs {
  PK Id bigint not null
}
`;
  const { schema: base } = parseSchema(source, "groups.dbschema");

  it("DSL 輸出保留群組宣告與成員關係", () => {
    const dsl = toDsl(base);
    expect(dsl).toContain('group Identity "身分與權限模組"');
    expect(dsl).toContain("table dbo.Users \"系統使用者\" in Identity {");
    expect(dsl).toContain("table dbo.Orders in Sales {");
    // 沒有群組的表不會被硬塞一個
    expect(dsl).toContain("table dbo.Logs {");
  });

  it("重新解析後群組完全一致", () => {
    const reparsed = parseSchema(toDsl(base), "round-trip.dbschema");
    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.schema.groups).toEqual(
      base.groups!.map((g) => expect.objectContaining({ name: g.name, description: g.description })),
    );
    expect(reparsed.schema.tables.map((t) => t.group)).toEqual(base.tables.map((t) => t.group));
  });

  it("JSON 保留群組，且依名稱排序", () => {
    const parsed = JSON.parse(toJson(base));
    expect(parsed.groups.map((g: { name: string }) => g.name)).toEqual(["Identity", "Sales"]);
    expect(parsed.tables.find((t: { name: string }) => t.name === "Users").group).toBe("Identity");
  });

  it("DSL → JSON → DSL 群組語意一致", () => {
    const restored = fromJson(toJson(base)).schema;
    const final = parseSchema(toDsl(restored), "round-trip.dbschema").schema;

    expect(final.groups).toEqual(base.groups!.map((g) => expect.objectContaining({ name: g.name })));
    const groupOf = (s: typeof final, name: string): string | undefined =>
      s.tables.find((t) => t.name === name)?.group;
    for (const name of ["Users", "Orders", "Logs"]) {
      expect(groupOf(final, name)).toBe(groupOf(base, name));
    }
  });

  it("舊版沒有 groups 欄位的 JSON 仍可匯入（向後相容）", () => {
    const legacy = JSON.parse(toJson(base));
    delete legacy.groups;
    for (const table of legacy.tables) delete table.group;

    const { schema, diagnostics } = fromJson(JSON.stringify(legacy));
    expect(diagnostics).toEqual([]);
    expect(schema.groups).toEqual([]);
    expect(schema.tables.every((t) => t.group === undefined)).toBe(true);
  });
});
