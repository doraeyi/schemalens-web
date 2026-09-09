import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import { buildGraph, columnNameOf, getRelatedColumns, tableIdOf } from "@schemalens/schema-graph";

function table(name: string, columns: string[]) {
  return {
    id: `dbo.${name}`,
    schema: "dbo",
    name,
    columns: columns.map((c) => ({
      name: c,
      type: "bigint",
      nullable: false,
      primaryKey: c === "Id",
      foreignKey: c.endsWith("Id") && c !== "Id",
      unique: false,
      indexed: false,
    })),
    indexes: [],
  };
}

/**
 * Users.Id 被 Orders.UserId 與 Comments.UserId 參照；
 * Orders.Id 又被 OrderItems.OrderId 參照。
 * Logs 完全無關。
 */
const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: [
    table("Users", ["Id", "Email"]),
    table("Orders", ["Id", "UserId", "Total"]),
    table("Comments", ["Id", "UserId", "Body"]),
    table("OrderItems", ["Id", "OrderId", "Qty"]),
    table("Logs", ["Id", "Message"]),
  ],
  relations: [
    { name: "FK_Orders_Users", sourceTable: "dbo.Orders", sourceColumns: ["UserId"], targetTable: "dbo.Users", targetColumns: ["Id"], cardinality: "N:1" },
    { name: "FK_Comments_Users", sourceTable: "dbo.Comments", sourceColumns: ["UserId"], targetTable: "dbo.Users", targetColumns: ["Id"], cardinality: "N:1" },
    { name: "FK_OrderItems_Orders", sourceTable: "dbo.OrderItems", sourceColumns: ["OrderId"], targetTable: "dbo.Orders", targetColumns: ["Id"], cardinality: "N:1" },
  ],
};

const graph = buildGraph(schema);

describe("getRelatedColumns", () => {
  it("點主鍵：找出所有參照它的 FK 欄位", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Users", "Id");
    expect([...result.columns].sort()).toEqual(
      ["dbo.Comments.UserId", "dbo.Orders.UserId", "dbo.Users.Id"].sort(),
    );
    expect([...result.relations].sort()).toEqual(["FK_Comments_Users", "FK_Orders_Users"]);
  });

  it("點 FK：找出它指向的主鍵，以及同樣指向該主鍵的其他欄位", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Orders", "UserId");
    expect(result.columns.has("dbo.Users.Id")).toBe(true);
    // 追到 Users.Id 之後，繼續找出其他指向它的欄位。
    expect(result.columns.has("dbo.Comments.UserId")).toBe(true);
  });

  it("會沿著 FK 鏈往下追（Orders.Id → OrderItems.OrderId）", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Orders", "Id");
    expect(result.columns.has("dbo.OrderItems.OrderId")).toBe(true);
  });

  it("depth 可以限制只看直接對應", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Orders", "UserId", { depth: 1 });
    expect(result.columns.has("dbo.Users.Id")).toBe(true);
    expect(result.columns.has("dbo.Comments.UserId")).toBe(false);
  });

  it("無關的欄位不會被納入", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Users", "Id");
    expect(result.columns.has("dbo.Users.Email")).toBe(false);
    expect(result.columns.has("dbo.Orders.Total")).toBe(false);
    expect(result.columns.has("dbo.Logs.Message")).toBe(false);
  });

  it("孤立欄位只回傳自己", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Users", "Email");
    expect([...result.columns]).toEqual(["dbo.Users.Email"]);
    expect(result.relations.size).toBe(0);
  });

  it("回報涉及哪些 table，方便同時做 table 級強調", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Users", "Id");
    expect([...result.tables].sort()).toEqual(["dbo.Comments", "dbo.Orders", "dbo.Users"]);
  });

  it("未知 table 回傳空集合而不是丟例外（US10）", () => {
    const result = getRelatedColumns(schema, graph, "dbo.Ghost", "Id");
    expect(result.columns.size).toBe(0);
  });

  it("composite FK 只串起同一個索引位置的欄位", () => {
    const composite: Schema = {
      version: SCHEMA_VERSION,
      metadata: { defaultSchema: "dbo" },
      tables: [table("Orders", ["Id", "TenantId"]), table("Lines", ["OrderId", "TenantId"])],
      relations: [
        {
          name: "FK_Lines_Orders",
          sourceTable: "dbo.Lines",
          sourceColumns: ["OrderId", "TenantId"],
          targetTable: "dbo.Orders",
          targetColumns: ["Id", "TenantId"],
          cardinality: "N:1",
        },
      ],
    };
    const result = getRelatedColumns(composite, buildGraph(composite), "dbo.Lines", "OrderId");
    expect(result.columns.has("dbo.Orders.Id")).toBe(true);
    // TenantId 對應的是 TenantId，不該被 OrderId 牽連進來。
    expect(result.columns.has("dbo.Orders.TenantId")).toBe(false);
  });

  it("欄位數不對等的 composite 只配對到較短的長度，不會越界", () => {
    const uneven: Schema = {
      version: SCHEMA_VERSION,
      metadata: { defaultSchema: "dbo" },
      tables: [table("A", ["X", "Y"]), table("B", ["Id"])],
      relations: [
        { name: "R", sourceTable: "dbo.A", sourceColumns: ["X", "Y"], targetTable: "dbo.B", targetColumns: ["Id"], cardinality: "N:1" },
      ],
    };
    const result = getRelatedColumns(uneven, buildGraph(uneven), "dbo.A", "Y");
    expect([...result.columns]).toEqual(["dbo.A.Y"]);
  });

  it("環狀 FK 不會無限迴圈", () => {
    const cyclic: Schema = {
      version: SCHEMA_VERSION,
      metadata: { defaultSchema: "dbo" },
      tables: [table("A", ["Id", "BId"]), table("B", ["Id", "AId"])],
      relations: [
        { name: "R1", sourceTable: "dbo.A", sourceColumns: ["BId"], targetTable: "dbo.B", targetColumns: ["Id"], cardinality: "N:1" },
        { name: "R2", sourceTable: "dbo.B", sourceColumns: ["AId"], targetTable: "dbo.A", targetColumns: ["Id"], cardinality: "N:1" },
      ],
    };
    const result = getRelatedColumns(cyclic, buildGraph(cyclic), "dbo.A", "Id");
    expect(result.columns.has("dbo.B.AId")).toBe(true);
  });
});

describe("ColumnRef 工具", () => {
  it("拆出 table 與 column", () => {
    expect(tableIdOf("dbo.Users.Id")).toBe("dbo.Users");
    expect(columnNameOf("dbo.Users.Id")).toBe("Id");
  });

  it("沒有點時原樣回傳，不會炸", () => {
    expect(tableIdOf("weird")).toBe("weird");
    expect(columnNameOf("weird")).toBe("weird");
  });
});
