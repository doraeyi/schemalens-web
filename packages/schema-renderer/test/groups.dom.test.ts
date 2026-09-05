/**
 * 群組（功能模組）在 Preview 的呈現與篩選。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import {
  DEFAULT_VIEW_STATE,
  SchemaRenderer,
  groupBorderColor,
  groupColor,
  groupHue,
  groupTintColor,
  resolveVisibility,
} from "@schemalens/schema-renderer";
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

  it("底色、邊框與標籤共用同一個色相", () => {
    const hueOf = (color: string): string => /hsla?\((\d+)/.exec(color)![1]!;
    for (const name of ["Identity", "Sales"]) {
      expect(hueOf(groupTintColor(name))).toBe(hueOf(groupBorderColor(name)));
      expect(hueOf(groupTintColor(name))).toBe(hueOf(groupColor(name)));
    }
  });

  it("底色的透明度遠低於邊框，只在卡片縫隙間透出來", () => {
    const alphaOf = (color: string): number =>
      Number.parseFloat(/,\s*([\d.]+)\s*\)$/.exec(color)![1]!);
    expect(alphaOf(groupTintColor("Identity"))).toBeLessThan(alphaOf(groupBorderColor("Identity")));
    expect(alphaOf(groupTintColor("Identity"))).toBeLessThanOrEqual(0.15);
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

describe("群組外框", () => {
  const box = (host: HTMLElement, group: string): HTMLElement =>
    host.querySelector<HTMLElement>(`.dbs-group-box[data-group="${group}"]`)!;

  it("每個群組畫出一個外框", () => {
    const { host } = mount();
    expect(host.querySelectorAll(".dbs-group-box")).toHaveLength(2);
    expect(box(host, "Identity")).not.toBeNull();
    expect(box(host, "Sales")).not.toBeNull();
  });

  it("外框帶群組名稱與描述", () => {
    const { host } = mount();
    const label = box(host, "Identity").querySelector(".dbs-group-box-label")!;
    expect(label.textContent).toContain("Identity");
    expect(label.textContent).toContain("身分與權限");
  });

  it("不同群組的邊框顏色不同", () => {
    const { host } = mount();
    expect(box(host, "Identity").style.borderColor).not.toBe("");
    expect(box(host, "Identity").style.borderColor).not.toBe(box(host, "Sales").style.borderColor);
  });

  it("有底色，且透明度低到不會壓掉卡片對比", () => {
    const { host } = mount();
    // jsdom 會把 hsla() 正規化成 rgba()，所以這裡只驗實際生效的性質。
    const color = box(host, "Identity").style.backgroundColor;
    expect(color).not.toBe("");

    const alpha = Number.parseFloat(/,\s*([\d.]+)\s*\)$/.exec(color)![1]!);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(0.15);
  });

  it("不同群組的底色不同", () => {
    const { host } = mount();
    expect(box(host, "Identity").style.backgroundColor).not.toBe(
      box(host, "Sales").style.backgroundColor,
    );
  });

  it("不使用點陣底紋——群組一多會讓整片畫面變吵", () => {
    const { host } = mount();
    expect(box(host, "Identity").style.backgroundImage).toBe("");
  });

  it("外框有明確的位置與尺寸", () => {
    const { host } = mount();
    const el = box(host, "Identity");
    expect(el.style.width).toMatch(/px$/);
    expect(el.style.height).toMatch(/px$/);
    expect(el.style.left).toMatch(/px$/);
  });

  it("沒有群組的表不會產生外框", () => {
    const { host } = mount();
    expect(host.querySelector('.dbs-group-box[data-group="Logs"]')).toBeNull();
  });

  it("外框在卡片之下，不會擋住互動", () => {
    const { host } = mount();
    const viewport = host.querySelector(".dbs-viewport")!;
    const order = [...viewport.children].map((n) => n.getAttribute("class"));
    expect(order.indexOf("dbs-groups")).toBeLessThan(order.indexOf("dbs-nodes"));

    const css = host.querySelector("style")!.textContent!;
    const block = css.slice(css.indexOf(".dbs-groups {"), css.indexOf("}", css.indexOf(".dbs-groups {")));
    expect(block).toContain("z-index: 0");
    expect(block).toContain("pointer-events: none");
  });

  it("群組篩選時，非目標群組的外框跟著淡化", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ groupFilter: "Identity" });
    expect(box(host, "Identity").classList.contains("is-filtered-out")).toBe(false);
    expect(box(host, "Sales").classList.contains("is-filtered-out")).toBe(true);
  });

  it("同群組的卡片被排在自己的外框內", () => {
    const { host } = mount();
    const el = box(host, "Identity");
    const rect = {
      x: Number.parseFloat(el.style.left),
      y: Number.parseFloat(el.style.top),
      w: Number.parseFloat(el.style.width),
      h: Number.parseFloat(el.style.height),
    };
    const card = host.querySelector<HTMLElement>('[data-table-id="dbo.Users"]')!;
    const x = Number.parseFloat(card.style.left);
    const y = Number.parseFloat(card.style.top);

    expect(x).toBeGreaterThanOrEqual(rect.x);
    expect(y).toBeGreaterThanOrEqual(rect.y);
    expect(x).toBeLessThanOrEqual(rect.x + rect.w);
    expect(y).toBeLessThanOrEqual(rect.y + rect.h);
  });
});

describe("排版依據", () => {
  it("預設依群組聚攏，並畫出外框", () => {
    const { host, renderer } = mount();
    expect(renderer.getViewState().layoutMode).toBe("group");
    expect(host.querySelectorAll(".dbs-group-box").length).toBeGreaterThan(0);
  });

  it("切成依關聯後不畫外框——成員散開時外框沒有意義", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ layoutMode: "relation" });
    expect(host.querySelectorAll(".dbs-group-box")).toHaveLength(0);
  });

  it("依關聯排版時，卡片仍保留群組標籤與色條", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ layoutMode: "relation" });
    const users = host.querySelector<HTMLElement>('[data-table-id="dbo.Users"]')!;
    expect(users.querySelector(".dbs-card-group")?.textContent).toBe("Identity");
    expect(users.style.borderLeftColor).not.toBe("");
  });

  it("兩種模式的卡片座標不同（確實重新排過）", () => {
    const { host, renderer } = mount();
    const left = () =>
      host.querySelector<HTMLElement>('[data-table-id="dbo.Orders"]')!.style.left;
    const grouped = left();
    renderer.setViewState({ layoutMode: "relation" });
    expect(left()).not.toBe(grouped);
  });

  it("切回依群組會重新出現外框", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ layoutMode: "relation" });
    renderer.setViewState({ layoutMode: "group" });
    expect(host.querySelectorAll(".dbs-group-box").length).toBeGreaterThan(0);
  });

  it("換排版會清掉手動拖曳的位置", () => {
    const { host, renderer } = mount();
    const card = host.querySelector<HTMLElement>('[data-table-id="dbo.Orders"]')!;

    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, button: 0 });
    Object.defineProperty(down, "pointerId", { value: 1 });
    card.dispatchEvent(down);
    const move = new MouseEvent("pointermove", { bubbles: true, clientX: 200, clientY: 200 });
    Object.defineProperty(move, "pointerId", { value: 1 });
    card.dispatchEvent(move);
    const up = new MouseEvent("pointerup", { bubbles: true, clientX: 200, clientY: 200 });
    Object.defineProperty(up, "pointerId", { value: 1 });
    card.dispatchEvent(up);
    expect(renderer.hasManualPositions()).toBe(true);

    renderer.setViewState({ layoutMode: "relation" });
    expect(renderer.hasManualPositions()).toBe(false);
  });
});
