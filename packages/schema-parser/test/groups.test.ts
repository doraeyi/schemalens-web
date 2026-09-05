import { describe, expect, it } from "vitest";
import { groupNames, tablesByGroup, validateSchema } from "@schemalens/schema-core";
import { parseSchema } from "@schemalens/schema-parser";

const SOURCE = `group Identity "身分與權限模組" {
  Users
  Roles
}

group Sales "訂單與金流"

table Users "系統使用者" {
  PK Id bigint not null
}

table Roles {
  PK Id bigint not null
}

table Orders in Sales {
  PK Id bigint not null
}

table Logs {
  PK Id bigint not null
}
`;

describe("群組宣告", () => {
  const { schema, diagnostics } = parseSchema(SOURCE, "database.dbschema");

  it("解析沒有診斷", () => {
    expect(diagnostics).toEqual([]);
  });

  it("group 區塊會把成員寫回 table.group", () => {
    expect(schema.tables.find((t) => t.name === "Users")!.group).toBe("Identity");
    expect(schema.tables.find((t) => t.name === "Roles")!.group).toBe("Identity");
  });

  it("table ... in X 也能標群組", () => {
    expect(schema.tables.find((t) => t.name === "Orders")!.group).toBe("Sales");
  });

  it("沒有分類的 table 維持沒有群組", () => {
    expect(schema.tables.find((t) => t.name === "Logs")!.group).toBeUndefined();
  });

  it("群組描述保存在宣告上，不會在每張表重複", () => {
    expect(schema.groups!).toEqual([
      expect.objectContaining({ name: "Identity", description: "身分與權限模組" }),
      expect.objectContaining({ name: "Sales", description: "訂單與金流" }),
    ]);
  });

  it("沒有區塊的 group 宣告也合法（成員用 in 標）", () => {
    expect(schema.groups!.find((g) => g.name === "Sales")!.description).toBe("訂單與金流");
  });

  it("tablesByGroup 依群組列出成員", () => {
    const grouped = tablesByGroup(schema);
    expect(grouped.get("Identity")!.map((t) => t.name)).toEqual(["Users", "Roles"]);
    expect(grouped.get("Sales")!.map((t) => t.name)).toEqual(["Orders"]);
  });

  it("groupNames 回傳排序後的群組名稱", () => {
    expect(groupNames(schema)).toEqual(["Identity", "Sales"]);
  });

  it("驗證沒有診斷", () => {
    expect(validateSchema(schema, { file: "database.dbschema" })).toEqual([]);
  });
});

describe("群組錯誤處理", () => {
  it("群組列出不存在的 Table 會回報", () => {
    const { diagnostics } = parseSchema(`group G {
  Ghost
}`);
    expect(diagnostics[0]!.code).toBe("SCHEMA_UNKNOWN_TABLE");
  });

  it("群組重複宣告會回報", () => {
    const { diagnostics } = parseSchema(`group G "一"
group G "二"`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_DUPLICATE_GROUP");
  });

  it("同一張表被指定到兩個群組會回報", () => {
    const { diagnostics } = parseSchema(`table Users in A {
  PK Id bigint not null
}
group B {
  Users
}`);
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_CONFLICTING_GROUP");
  });

  it("成員用逗號分隔也可以", () => {
    const { schema, diagnostics } = parseSchema(`table A {
  PK Id bigint not null
}
table B {
  PK Id bigint not null
}
group G {
  A, B
}`);
    expect(diagnostics).toEqual([]);
    expect(schema.tables.every((t) => t.group === "G")).toBe(true);
  });

  it("成員可以跨 schema", () => {
    const { schema, diagnostics } = parseSchema(`table sales.Orders {
  PK Id bigint not null
}
group G {
  sales.Orders
}`);
    expect(diagnostics).toEqual([]);
    expect(schema.tables[0]!.group).toBe("G");
  });

  it("group 是 soft keyword，不影響叫 Group 的欄位", () => {
    const { schema, diagnostics } = parseSchema(`table Users {
  PK Id bigint not null
  Group nvarchar(50) null "使用者群組"
}`);
    expect(diagnostics).toEqual([]);
    expect(schema.tables[0]!.columns.map((c) => c.name)).toEqual(["Id", "Group"]);
  });

  it("in 是 soft keyword，不影響叫 In 的欄位", () => {
    const { schema, diagnostics } = parseSchema(`table T {
  PK Id bigint not null
  In nvarchar(10) null
}`);
    expect(diagnostics).toEqual([]);
    expect(schema.tables[0]!.columns.map((c) => c.name)).toEqual(["Id", "In"]);
  });

  it("壞掉的群組宣告不影響其他語句", () => {
    const { schema, diagnostics } = parseSchema(`group {
table Good {
  PK Id bigint not null
}`);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(schema.tables.map((t) => t.name)).toEqual(["Good"]);
  });
});
