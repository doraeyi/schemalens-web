import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, makeTableId, type Relation, type Schema, type Table } from "@schemalens/schema-core";
import { buildGraph } from "@schemalens/schema-graph";
import { DEFAULT_VIEW_STATE, resolveVisibility, type ViewState } from "@schemalens/schema-renderer";

function table(name: string): Table {
  return {
    id: makeTableId("dbo", name),
    schema: "dbo",
    name,
    columns: [
      { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
    ],
    indexes: [],
  };
}

function relation(source: string, target: string): Relation {
  return {
    name: `FK_${source}_${target}`,
    sourceTable: makeTableId("dbo", source),
    sourceColumns: [`${target}Id`],
    targetTable: makeTableId("dbo", target),
    targetColumns: ["Id"],
    cardinality: "N:1",
  };
}

const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: ["Orders", "Users", "OrderItems", "Products", "Logs"].map(table),
  relations: [relation("Orders", "Users"), relation("OrderItems", "Orders"), relation("OrderItems", "Products")],
};

const graph = buildGraph(schema);
const id = (name: string): string => makeTableId("dbo", name);
const state = (patch: Partial<ViewState> = {}): ViewState => ({ ...DEFAULT_VIEW_STATE, ...patch });

describe("resolveVisibility", () => {
  it("沒有 focus 時全部 active（打開就看得到整份 schema）", () => {
    const result = resolveVisibility(graph, state());
    expect([...result.tables.values()].every((v) => v === "active")).toBe(true);
    expect([...result.edges.values()].every((v) => v === "normal")).toBe(true);
  });

  it("focus 後：自己 selected、相關 related、其餘 dimmed（plan §22）", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Orders"), depth: 1, direction: "all" } }),
    );
    expect(result.tables.get(id("Orders"))).toBe("selected");
    // related 而不是 active：相關表要有正向標示，
    // 否則畫面上只有「其他變暗」，看不出誰被點亮。
    expect(result.tables.get(id("Users"))).toBe("related");
    expect(result.tables.get(id("OrderItems"))).toBe("related");
    expect(result.tables.get(id("Products"))).toBe("dimmed");
    expect(result.tables.get(id("Logs"))).toBe("dimmed");
  });

  it("Hide 模式把不相關的表與線都藏起來", () => {
    const result = resolveVisibility(
      graph,
      state({ unrelated: "hide", focus: { tableId: id("Orders"), depth: 1, direction: "all" } }),
    );
    expect(result.tables.get(id("Logs"))).toBe("hidden");
    expect(result.edges.get("FK_OrderItems_Products")).toBe("hidden");
  });

  it("直接接在焦點上的線 highlight，其餘相關線維持 normal（plan §27）", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Orders"), depth: 2, direction: "all" } }),
    );
    expect(result.edges.get("FK_Orders_Users")).toBe("highlight");
    expect(result.edges.get("FK_OrderItems_Orders")).toBe("highlight");
    expect(result.edges.get("FK_OrderItems_Products")).toBe("normal");
  });

  it("upstream 只留 Orders 依賴的表（US4）", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Orders"), depth: 1, direction: "upstream" } }),
    );
    expect(result.tables.get(id("Users"))).toBe("related");
    expect(result.tables.get(id("OrderItems"))).toBe("dimmed");
  });

  it("downstream 只留依賴 Orders 的表（US5）", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Orders"), depth: 1, direction: "downstream" } }),
    );
    expect(result.tables.get(id("OrderItems"))).toBe("related");
    expect(result.tables.get(id("Users"))).toBe("dimmed");
  });

  it("depth = null 代表 All，整個連通元件都算相關", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Orders"), depth: null, direction: "all" } }),
    );
    expect(result.tables.get(id("Products"))).toBe("related");
    expect(result.tables.get(id("Logs"))).toBe("dimmed");
  });

  it("focus 指向不存在的 table 時退回全顯示，不 crash（US10）", () => {
    const result = resolveVisibility(
      graph,
      state({ focus: { tableId: id("Ghost"), depth: 1, direction: "all" } }),
    );
    expect(result.tables.get(id("Orders"))).toBe("active");
  });
});

/**
 * 欄位聚焦啟用時，強調完全由欄位決定。
 *
 * 否則焦點表在表層級的鄰居會跟著亮起來，但那些表與剛點的欄位毫無關係——
 * 畫面說「這些有關」，其實沒有。
 */
describe("欄位聚焦覆寫表層級的強調", () => {
  const columnState = (patch: Partial<ViewState> = {}): ViewState => ({
    ...DEFAULT_VIEW_STATE,
    focus: { tableId: id("Orders"), depth: 1, direction: "all" },
    ...patch,
  });

  it("只有與該欄位有 FK 對應的表會亮起", () => {
    // OrderItems.OrderId → Orders.Id
    const result = resolveVisibility(
      graph,
      columnState({ columnFocus: { tableId: id("Orders"), column: "Id" } }),
      schema,
    );

    expect(result.tables.get(id("Orders"))).toBe("selected");
    expect(result.tables.get(id("OrderItems"))).toBe("related");
    // Users 在表層級與 Orders 相鄰，但與 Orders.Id 這個欄位無關。
    expect(result.tables.get(id("Users"))).toBe("dimmed");
  });

  it("欄位沒有任何對應時，只有自己是 selected", () => {
    const result = resolveVisibility(
      graph,
      columnState({ columnFocus: { tableId: id("Orders"), column: "Id" } }),
      schema,
    );
    const lit = [...result.tables.entries()].filter(([, v]) => v === "related");
    expect(lit.length).toBeGreaterThan(0);

    const none = resolveVisibility(
      graph,
      columnState({ columnFocus: { tableId: id("Logs"), column: "Id" } }),
      schema,
    );
    expect([...none.tables.values()].filter((v) => v === "related")).toHaveLength(0);
    expect(none.tables.get(id("Logs"))).toBe("selected");
  });

  it("只有參與該欄位的線 highlight", () => {
    const result = resolveVisibility(
      graph,
      columnState({ columnFocus: { tableId: id("Orders"), column: "Id" } }),
      schema,
    );
    expect(result.edges.get("FK_OrderItems_Orders")).toBe("highlight");
    expect(result.edges.get("FK_Orders_Users")).toBe("dimmed");
  });

  it("Hide 模式下，無關的表與線直接隱藏", () => {
    const result = resolveVisibility(
      graph,
      columnState({
        unrelated: "hide",
        columnFocus: { tableId: id("Orders"), column: "Id" },
      }),
      schema,
    );
    expect(result.tables.get(id("Users"))).toBe("hidden");
    expect(result.edges.get("FK_Orders_Users")).toBe("hidden");
  });

  it("群組篩選仍然優先——它是使用者設的硬性範圍", () => {
    const result = resolveVisibility(
      graph,
      columnState({
        groupFilter: "NotAGroup",
        columnFocus: { tableId: id("Orders"), column: "Id" },
      }),
      schema,
    );
    expect(result.tables.get(id("OrderItems"))).toBe("filtered");
  });

  it("沒有 schema 時退回表層級判斷，不會整片變空", () => {
    const result = resolveVisibility(
      graph,
      columnState({ columnFocus: { tableId: id("Orders"), column: "Id" } }),
    );
    expect(result.tables.get(id("Users"))).toBe("related");
  });
});
