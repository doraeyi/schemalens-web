/**
 * 欄位聚焦：點某個欄位，只亮它與透過 FK 對應的欄位，其餘視為雜訊。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import { SchemaRenderer } from "@schemalens/schema-renderer";

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

const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: [
    table("Users", ["Id", "Email"]),
    table("Orders", ["Id", "UserId", "Total"]),
    table("Comments", ["Id", "UserId", "Body"]),
  ],
  relations: [
    { name: "FK_Orders_Users", sourceTable: "dbo.Orders", sourceColumns: ["UserId"], targetTable: "dbo.Users", targetColumns: ["Id"], cardinality: "N:1" },
    { name: "FK_Comments_Users", sourceTable: "dbo.Comments", sourceColumns: ["UserId"], targetTable: "dbo.Users", targetColumns: ["Id"], cardinality: "N:1" },
  ],
};

function mount(events = {}): { host: HTMLElement; renderer: SchemaRenderer } {
  const host = document.createElement("div");
  host.getBoundingClientRect = () =>
    ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(host);
  const renderer = new SchemaRenderer(host, { events });
  renderer.setSchema(schema);
  return { host, renderer };
}

const row = (host: HTMLElement, tableName: string, column: string): HTMLElement =>
  host.querySelector<HTMLElement>(`[data-table-id="dbo.${tableName}"] [data-column="${column}"]`)!;

beforeEach(() => document.body.replaceChildren());

describe("點欄位聚焦", () => {
  it("起點欄位標為 focus，對應欄位標為 related", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");

    expect(row(host, "Users", "Id").classList.contains("is-column-focus")).toBe(true);
    expect(row(host, "Orders", "UserId").classList.contains("is-column-related")).toBe(true);
    expect(row(host, "Comments", "UserId").classList.contains("is-column-related")).toBe(true);
  });

  it("其餘欄位一律標為雜訊", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");

    expect(row(host, "Users", "Email").classList.contains("is-column-muted")).toBe(true);
    expect(row(host, "Orders", "Total").classList.contains("is-column-muted")).toBe(true);
    expect(row(host, "Orders", "Id").classList.contains("is-column-muted")).toBe(true);
  });

  it("亮起的欄位用的是與高亮關聯線同一個色系，兩者對得起來", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    const css = host.querySelector("style")!.textContent!;
    const block = (selector: string): string => {
      const at = css.indexOf(`${selector} {`);
      return css.slice(at, css.indexOf("}", at));
    };
    // 先前用 list-activeSelectionBackground，在深色主題下與卡片底色幾乎同色。
    expect(block(".dbs-row.is-column-focus")).not.toContain("list-activeSelectionBackground");
    expect(block(".dbs-row.is-column-focus")).toContain("charts-blue");
    expect(block(".dbs-edge.is-highlight .dbs-edge-path")).toContain("charts-blue");
  });

  it("亮起的欄位有明確的視覺標記，不只是別人變暗", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    const css = host.querySelector("style")!.textContent!;
    const at = css.indexOf(".dbs-row.is-column-focus {");
    const block = css.slice(at, css.indexOf("}", at));
    expect(block).toContain("box-shadow");
    expect(block).toContain("font-weight");
  });

  it("含有亮起欄位的卡片會被標出來，大型 schema 才找得到", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");

    const participants = [...host.querySelectorAll(".dbs-card.is-column-participant")].map((el) =>
      el.getAttribute("data-table-id"),
    );
    expect(participants.sort()).toEqual(["dbo.Comments", "dbo.Orders", "dbo.Users"]);
  });

  it("取消聚焦後卡片標記也移除", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    renderer.clearColumnFocus();
    expect(host.querySelectorAll(".is-column-participant")).toHaveLength(0);
  });

  it("雜訊欄位是降低透明度而不是隱藏，使用者才不會以為欄位不存在", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    const css = host.querySelector("style")!.textContent!;
    const block = css.slice(css.indexOf(".dbs-row.is-column-muted"));
    expect(block).toContain("opacity");
    expect(block.slice(0, 60)).not.toContain("display: none");
  });

  it("只有參與的關聯線 highlight，其餘降噪", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Orders", "UserId");

    const orders = host.querySelector('[data-relation="FK_Orders_Users"]')!;
    expect(orders.classList.contains("is-highlight")).toBe(true);
  });

  it("與焦點欄位無關的線被 dim", () => {
    const isolated: Schema = {
      ...schema,
      relations: [
        ...schema.relations,
        { name: "FK_Self", sourceTable: "dbo.Orders", sourceColumns: ["Total"], targetTable: "dbo.Comments", targetColumns: ["Body"], cardinality: "N:1" },
      ],
    };
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.getBoundingClientRect = () =>
      ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.append(host);
    const renderer = new SchemaRenderer(host);
    renderer.setSchema(isolated);
    renderer.focusColumn("dbo.Users", "Id");

    expect(host.querySelector('[data-relation="FK_Self"]')!.classList.contains("is-dimmed")).toBe(true);
  });

  it("點欄位會觸發 columnSelected，而不是 tableSelected", () => {
    const columnSelected = vi.fn();
    const tableSelected = vi.fn();
    const { host } = mount({ columnSelected, tableSelected });

    row(host, "Orders", "UserId").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(columnSelected).toHaveBeenCalledWith({ tableId: "dbo.Orders", column: "UserId" });
    expect(tableSelected).not.toHaveBeenCalled();
  });

  it("再點同一個欄位會取消聚焦", () => {
    const columnSelected = vi.fn();
    const { host, renderer } = mount({ columnSelected });
    const target = row(host, "Orders", "UserId");

    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renderer.getViewState().columnFocus).toEqual({ tableId: "dbo.Orders", column: "UserId" });

    row(host, "Orders", "UserId").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renderer.getViewState().columnFocus).toBeNull();
    expect(columnSelected).toHaveBeenLastCalledWith(null);
  });

  it("點標題列做的是 table 聚焦，並清掉欄位聚焦", () => {
    const tableSelected = vi.fn();
    const { host, renderer } = mount({ tableSelected });
    renderer.focusColumn("dbo.Users", "Id");

    host
      .querySelector('[data-table-id="dbo.Orders"] .dbs-card-header')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(renderer.getViewState().columnFocus).toBeNull();
    expect(tableSelected).toHaveBeenCalledWith("dbo.Orders");
  });

  it("沒有聚焦時不會留下任何欄位狀態 class", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    renderer.clearColumnFocus();

    expect(host.querySelectorAll(".is-column-focus, .is-column-related, .is-column-muted")).toHaveLength(0);
  });

  it("getFocusedColumns 回傳完整的關聯欄位集合", () => {
    const { renderer } = mount();
    renderer.focusColumn("dbo.Users", "Id");
    expect([...renderer.getFocusedColumns()].sort()).toEqual(
      ["dbo.Comments.UserId", "dbo.Orders.UserId", "dbo.Users.Id"].sort(),
    );
  });

  it("聚焦孤立欄位時只有它自己是焦點，其餘全是雜訊", () => {
    const { host, renderer } = mount();
    renderer.focusColumn("dbo.Users", "Email");

    expect(row(host, "Users", "Email").classList.contains("is-column-focus")).toBe(true);
    expect(host.querySelectorAll(".is-column-related")).toHaveLength(0);
    expect(row(host, "Orders", "UserId").classList.contains("is-column-muted")).toBe(true);
  });

  it("欄位聚焦與 table Focus 可以並存", () => {
    const { host, renderer } = mount();
    renderer.focusTable("dbo.Users");
    renderer.focusColumn("dbo.Users", "Id");

    expect(host.querySelector('[data-table-id="dbo.Users"]')!.classList.contains("is-selected")).toBe(true);
    expect(row(host, "Users", "Id").classList.contains("is-column-focus")).toBe(true);
  });
});
