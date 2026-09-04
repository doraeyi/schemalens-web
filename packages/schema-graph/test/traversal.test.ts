import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEMA_NAME,
  SCHEMA_VERSION,
  makeTableId,
  type Cardinality,
  type Relation,
  type Schema,
  type Table,
} from "@schemalens/schema-core";
import { buildGraph, getRelatedTables } from "@schemalens/schema-graph";

function table(name: string): Table {
  return {
    id: makeTableId(DEFAULT_SCHEMA_NAME, name),
    schema: DEFAULT_SCHEMA_NAME,
    name,
    columns: [
      {
        name: "Id",
        type: "bigint",
        nullable: false,
        primaryKey: true,
        foreignKey: false,
        unique: false,
        indexed: false,
      },
    ],
    indexes: [],
  };
}

function relation(source: string, target: string, cardinality: Cardinality = "N:1"): Relation {
  return {
    name: `FK_${source}_${target}`,
    sourceTable: makeTableId(DEFAULT_SCHEMA_NAME, source),
    sourceColumns: [`${target}Id`],
    targetTable: makeTableId(DEFAULT_SCHEMA_NAME, target),
    targetColumns: ["Id"],
    cardinality,
  };
}

/**
 * 這份 fixture 對應 User Story 4 / 5：
 *   Orders 依賴 Users、Addresses（upstream）
 *   OrderItems、Payments 依賴 Orders（downstream）
 *   OrderItems 再依賴 Products（第二層）
 *   Logs 完全不相關
 */
function makeSchema(): Schema {
  const tables = ["Users", "Addresses", "Orders", "OrderItems", "Payments", "Products", "Logs"].map(table);
  return {
    version: SCHEMA_VERSION,
    metadata: { defaultSchema: DEFAULT_SCHEMA_NAME },
    tables,
    relations: [
      relation("Orders", "Users"),
      relation("Orders", "Addresses"),
      relation("OrderItems", "Orders"),
      relation("Payments", "Orders"),
      relation("OrderItems", "Products"),
    ],
  };
}

const id = (name: string): string => makeTableId(DEFAULT_SCHEMA_NAME, name);

describe("getRelatedTables", () => {
  const graph = buildGraph(makeSchema());

  it("1-Hop / all 只取直接相鄰的 table", () => {
    const result = getRelatedTables(graph, id("Orders"), { depth: 1, direction: "all" });
    expect([...result.tables].sort()).toEqual(
      [id("Orders"), id("Users"), id("Addresses"), id("OrderItems"), id("Payments")].sort(),
    );
    expect(result.tables.has(id("Products"))).toBe(false);
    expect(result.tables.has(id("Logs"))).toBe(false);
  });

  it("2-Hop 會納入第二層（Orders → OrderItems → Products）", () => {
    const result = getRelatedTables(graph, id("Orders"), { depth: 2, direction: "all" });
    expect(result.tables.has(id("Products"))).toBe(true);
    expect(result.distance.get(id("Products"))).toBe(2);
    expect(result.tables.has(id("Logs"))).toBe(false);
  });

  it("upstream 只回傳 Orders 依賴的 table（US4）", () => {
    const result = getRelatedTables(graph, id("Orders"), { depth: 1, direction: "upstream" });
    expect([...result.tables].sort()).toEqual([id("Orders"), id("Users"), id("Addresses")].sort());
  });

  it("downstream 只回傳依賴 Orders 的 table（US5）", () => {
    const result = getRelatedTables(graph, id("Orders"), { depth: 1, direction: "downstream" });
    expect([...result.tables].sort()).toEqual(
      [id("Orders"), id("OrderItems"), id("Payments")].sort(),
    );
  });

  it("孤立 table 只回傳自己", () => {
    const result = getRelatedTables(graph, id("Logs"), { depth: 2, direction: "all" });
    expect([...result.tables]).toEqual([id("Logs")]);
    expect(result.relations.size).toBe(0);
  });

  it("未知 table 回傳空集合而不是丟例外（US10：不得讓 Preview crash）", () => {
    const result = getRelatedTables(graph, id("DoesNotExist"), { depth: 1 });
    expect(result.tables.size).toBe(0);
  });

  it("補齊兩端都在集合內的 edge，避免顯示了 table 卻沒有線", () => {
    // 1-Hop 的 BFS 不會走 OrderItems→Products，但 Products 不在集合內，
    // 而 Users/Addresses 之間沒有邊；改用 Orders 的 2-Hop 檢查 OrderItems→Products。
    const result = getRelatedTables(graph, id("Orders"), { depth: 2, direction: "all" });
    expect(result.relations.has("FK_OrderItems_Products")).toBe(true);
  });

  it("depth 給很大時不會無限迴圈（環狀 relation）", () => {
    const cyclic = makeSchema();
    cyclic.relations.push(relation("Users", "Orders"));
    const cyclicGraph = buildGraph(cyclic);
    const result = getRelatedTables(cyclicGraph, id("Orders"), { depth: 999, direction: "all" });
    expect(result.tables.size).toBe(6);
  });
});
