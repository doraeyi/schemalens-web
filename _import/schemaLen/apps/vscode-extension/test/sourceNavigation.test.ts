import { describe, expect, it } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { findRelationLocation, findSourceLocation } from "../src/preview/sourceNavigation.js";

const SOURCE = `table Orders "訂單" {
  PK Id bigint not null
  FK UserId bigint not null
}

table Users {
  PK Id bigint not null
}

relation FK_Orders_Users {
  Orders.UserId N -> 1 Users.Id
}`;

const { schema } = parseSchema(SOURCE, "database.dbschema");

describe("findSourceLocation", () => {
  it("點 Table 跳到 table 定義（US9）", () => {
    const location = findSourceLocation(schema, { tableId: "dbo.Orders" });
    expect(location).toMatchObject({ file: "database.dbschema", line: 1 });
  });

  it("點 Column 跳到該欄位那一行", () => {
    const location = findSourceLocation(schema, { tableId: "dbo.Orders", column: "UserId" });
    expect(location?.line).toBe(3);
    expect(location?.column).toBeGreaterThan(1);
  });

  it("欄位不存在時退回 Table 位置，而不是無聲失敗", () => {
    const location = findSourceLocation(schema, { tableId: "dbo.Orders", column: "Ghost" });
    expect(location?.line).toBe(1);
  });

  it("Table 不存在時回傳 undefined，由呼叫端提示使用者", () => {
    expect(findSourceLocation(schema, { tableId: "dbo.Ghost" })).toBeUndefined();
  });

  it("合成 Schema（沒有 location）不會拋錯", () => {
    const synthetic = {
      version: "1",
      metadata: { defaultSchema: "dbo" },
      tables: [{ id: "dbo.A", schema: "dbo", name: "A", columns: [], indexes: [] }],
      relations: [],
    };
    expect(findSourceLocation(synthetic, { tableId: "dbo.A" })).toBeUndefined();
  });
});

describe("findRelationLocation", () => {
  it("找得到 relation 的定義位置", () => {
    expect(findRelationLocation(schema, "FK_Orders_Users")?.line).toBe(10);
  });

  it("不存在的 relation 回傳 undefined", () => {
    expect(findRelationLocation(schema, "NOPE")).toBeUndefined();
  });
});
