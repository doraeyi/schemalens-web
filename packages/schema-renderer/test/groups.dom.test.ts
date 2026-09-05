/**
 * 群組（功能模組）在 Preview 的呈現與篩選。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import { DEFAULT_VIEW_STATE, SchemaRenderer, groupColor, groupHue, resolveVisibility } from "@schemalens/schema-renderer";
import { buildGraph } from "@schemalens/schema-graph";

function table(name: string, group?: string) {
  return {
    id: `dbo.${name}`,
    schema: "dbo",
    name,
    group,
    columns: [
      { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
    ],
    indexes: [],
  };
}

const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  groups: [
    { name: "Identity", description: "身分與權限" },
    { name: "Sales", description: "訂單與金流" },
  ],
  tables: [table("Users", "Identity"), table("Orders", "Sales"), table("Logs")],
  relations: [
    {
      name: "FK_Orders_Users",
      sourceTable: "dbo.Orders",
      sourceColumns: ["Id"],
      targetTable: "dbo.Users",
      targetColumns: ["Id"],
      cardinality: "N:1",
    },
  ],
};

function mount(): { host: HTMLElement; renderer: SchemaRenderer } {
  const host = document.createElement("div");
  host.getBoundingClientRect = () =>
    ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(host);
  const renderer = new SchemaRenderer(host);
  renderer.setSchema(schema);
  return { host, renderer };
}

beforeEach(() => document.body.replaceChildren());

describe("群組配色", () => {
  it("同一個名稱永遠得到同一個顏色", () => {
    expect(groupColor("Identity")).toBe(groupColor("Identity"));
    expect(groupHue("Identity")).toBe(groupHue("Identity"));
  });

  it("不同名稱通常得到不同色相", () => {
    expect(groupHue("Identity")).not.toBe(groupHue("Sales"));
  });

  it("色相落在 0–360", () => {
    for (const name of ["A", "Identity", "訂單", "very-long-group-name"]) {
      expect(groupHue(name)).toBeGreaterThanOrEqual(0);
      expect(groupHue(name)).toBeLessThan(360);
    }
  });
});

describe("卡片上的群組", () => {
  it("有群組的卡片帶群組標籤與 data 屬性", () => {
    const { host } = mount();
    const users = host.querySelector('[data-table-id="dbo.Users"]')!;
    expect(users.getAttribute("data-group")).toBe("Identity");
    expect(users.querySelector(".dbs-card-group")?.textContent).toBe("Identity");
    expect(users.classList.contains("has-group")).toBe(true);
  });

  it("沒有群組的卡片不會多出標籤", () => {
    const { host } = mount();
    const logs = host.querySelector('[data-table-id="dbo.Logs"]')!;
    expect(logs.querySelector(".dbs-card-group")).toBeNull();
    expect(logs.classList.contains("has-group")).toBe(false);
  });

  it("同群組的卡片色條相同、不同群組不同", () => {
    const { host } = mount();
    const users = host.querySelector<HTMLElement>('[data-table-id="dbo.Users"]')!;
    const orders = host.querySelector<HTMLElement>('[data-table-id="dbo.Orders"]')!;
    expect(users.style.borderLeftColor).not.toBe("");
    expect(users.style.borderLeftColor).not.toBe(orders.style.borderLeftColor);
  });
});

describe("群組篩選", () => {
  const graph = buildGraph(schema);
  const state = (patch = {}) => ({ ...DEFAULT_VIEW_STATE, ...patch });

  it("不篩選時全部 active", () => {
    const result = resolveVisibility(graph, state(), schema);
    expect([...result.tables.values()].every((v) => v === "active")).toBe(true);
  });

  it("篩選後只有該群組是 active，其餘標為 filtered", () => {
    const result = resolveVisibility(graph, state({ groupFilter: "Identity" }), schema);
    expect(result.tables.get("dbo.Users")).toBe("active");
    expect(result.tables.get("dbo.Orders")).toBe("filtered");
    expect(result.tables.get("dbo.Logs")).toBe("filtered");
  });

  it("跨群組的關聯線也會被標為 filtered", () => {
    const result = resolveVisibility(graph, state({ groupFilter: "Identity" }), schema);
    expect(result.edges.get("FK_Orders_Users")).toBe("filtered");
  });

  it("群組篩選優先於 Focus：不在群組內的表不會因為相鄰就亮起來", () => {
    const result = resolveVisibility(
      graph,
      state({ groupFilter: "Identity", focus: { tableId: "dbo.Users", depth: 1, direction: "all" } }),
      schema,
    );
    expect(result.tables.get("dbo.Users")).toBe("selected");
    // Orders 與 Users 相鄰，但不屬於 Identity。
    expect(result.tables.get("dbo.Orders")).toBe("filtered");
  });

  it("relatedCount 只算篩選後的表", () => {
    const result = resolveVisibility(graph, state({ groupFilter: "Identity" }), schema);
    expect(result.relatedCount).toBe(1);
  });

  it("沒有傳 schema 時不做篩選，不會整片變空", () => {
    const result = resolveVisibility(graph, state({ groupFilter: "Identity" }));
    expect([...result.tables.values()].every((v) => v === "active")).toBe(true);
  });

  it("DOM 上套用 is-filtered-out", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ groupFilter: "Identity" });
    expect(host.querySelector('[data-table-id="dbo.Users"]')!.classList.contains("is-filtered-out")).toBe(false);
    expect(host.querySelector('[data-table-id="dbo.Orders"]')!.classList.contains("is-filtered-out")).toBe(true);
  });

  it("取消篩選後恢復", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ groupFilter: "Identity" });
    renderer.setViewState({ groupFilter: null });
    expect(host.querySelectorAll(".is-filtered-out")).toHaveLength(0);
  });
});
