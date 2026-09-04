import { describe, expect, it } from "vitest";
import { formatDiagnostic, validateSchema, type Schema } from "@schemalens/schema-core";
import { parseSchema } from "@schemalens/schema-parser";

function validateSource(source: string, file = "database.dbschema"): ReturnType<typeof validateSchema> {
  const { schema } = parseSchema(source, file);
  return validateSchema(schema, { file });
}

const VALID = `table Users {
  PK Id bigint not null
  UQ Email nvarchar(255) not null
}

table Posts {
  PK Id bigint not null
  FK AuthorId bigint not null
  CreatedAt datetime2 not null
}

index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}`;

describe("validateSchema", () => {
  it("合法 schema 沒有診斷", () => {
    expect(validateSource(VALID)).toEqual([]);
  });

  it("relation 指向不存在的 Table（plan §15 範例）", () => {
    const diagnostics = validateSource(`table Posts {
  PK Id bigint not null
  FK AuthorId bigint not null
}

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Unknown.Id
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_RELATION_TARGET_NOT_FOUND");
  });

  it("relation 指向不存在的欄位", () => {
    const diagnostics = validateSource(`table Users {
  PK Id bigint not null
}
table Posts {
  PK Id bigint not null
}
relation FK_Posts_Users {
  Posts.Ghost N -> 1 Users.Id
}`);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("SCHEMA_UNKNOWN_COLUMN");
    expect(diagnostics.find((d) => d.code === "SCHEMA_UNKNOWN_COLUMN")!.message).toContain("dbo.Posts.Ghost");
  });

  it("來源 Table 不存在", () => {
    const diagnostics = validateSource(`table Users {
  PK Id bigint not null
}
relation R {
  Ghost.Id N -> 1 Users.Id
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_RELATION_SOURCE_NOT_FOUND");
  });

  it("composite relation 兩端欄位數不一致", () => {
    const diagnostics = validateSource(`table A {
  PK Id bigint not null
  X bigint not null
  Y bigint not null
}
table B {
  PK Id bigint not null
}
relation R {
  A.(X, Y) N -> 1 B.(Id)
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_INVALID_COMPOSITE_RELATION");
  });

  it("index 參照不存在的欄位", () => {
    const diagnostics = validateSource(`table A {
  PK Id bigint not null
}
index IX_A on A(Ghost)`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_UNKNOWN_INDEX_COLUMN");
  });

  it("index 內欄位重複", () => {
    const diagnostics = validateSource(`table A {
  PK Id bigint not null
  X bigint not null
}
index IX_A on A(X, X)`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_DUPLICATE_INDEX");
  });

  it("自我參照到完全相同的欄位視為錯誤", () => {
    const diagnostics = validateSource(`table Nodes {
  PK Id bigint not null
}
relation R {
  Nodes.Id N -> 1 Nodes.Id
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_INVALID_RELATION");
  });

  it("樹狀自我參照（不同欄位）是合法的", () => {
    const diagnostics = validateSource(`table Nodes {
  PK Id bigint not null
  FK ParentId bigint null
}
relation FK_Nodes_Parent {
  Nodes.ParentId N -> 1 Nodes.Id
}`);
    expect(diagnostics).toEqual([]);
  });

  it("cardinality 不合法會被擋下（來自 JSON import 的髒資料）", () => {
    const schema: Schema = {
      version: "1",
      metadata: { defaultSchema: "dbo" },
      tables: [
        {
          id: "dbo.A",
          schema: "dbo",
          name: "A",
          columns: [
            { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
          ],
          indexes: [],
        },
      ],
      relations: [
        {
          name: "R",
          sourceTable: "dbo.A",
          sourceColumns: ["Id"],
          targetTable: "dbo.A",
          targetColumns: ["Id"],
          // 蓄意的髒資料
          cardinality: "many-to-some" as never,
        },
      ],
    };
    expect(validateSchema(schema).map((d) => d.code)).toContain("SCHEMA_INVALID_CARDINALITY");
  });

  it("診斷帶 file / line / column（AC-04 需要）", () => {
    const diagnostics = validateSource(`table Posts {
  PK Id bigint not null
}
relation FK_Posts_Users {
  Posts.Id N -> 1 Unknown.Id
}`);
    const first = diagnostics[0]!;
    expect(first.location?.file).toBe("database.dbschema");
    expect(first.location?.line).toBe(4);
  });

  it("formatDiagnostic 產出 plan §15 的顯示格式", () => {
    const text = formatDiagnostic({
      code: "SCHEMA_RELATION_TARGET_NOT_FOUND",
      severity: "error",
      message: "Unknown target:\ndbo.Users.Id",
      location: { file: "database.dbschema", line: 42, column: 18 },
    });
    expect(text).toBe("database.dbschema:42:18\n\nSCHEMA_RELATION_TARGET_NOT_FOUND\n\nUnknown target:\ndbo.Users.Id");
  });

  it("空 schema 不會產生診斷", () => {
    expect(validateSchema({ version: "1", metadata: { defaultSchema: "dbo" }, tables: [], relations: [] })).toEqual([]);
  });
});
