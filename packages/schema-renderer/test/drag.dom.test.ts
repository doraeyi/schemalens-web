/**
 * 卡片拖曳：調整檢視版面，不會改動 Schema。
 *
 * jsdom 沒有真正的 PointerEvent 與 setPointerCapture，
 * 這裡用帶座標的 MouseEvent 模擬——renderer 只用到 clientX / clientY
 * 與 pointerId，且對 setPointerCapture 做了可選呼叫。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import { SchemaRenderer } from "@schemalens/schema-renderer";

const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: [
    {
      id: "dbo.Users",
      schema: "dbo",
      name: "Users",
      columns: [
        { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
      ],
      indexes: [],
    },
    {
      id: "dbo.Posts",
      schema: "dbo",
      name: "Posts",
      columns: [
        { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
        { name: "AuthorId", type: "bigint", nullable: false, primaryKey: false, foreignKey: true, unique: false, indexed: false },
      ],
      indexes: [],
    },
  ],
  relations: [
    {
      name: "FK_Posts_Users",
      sourceTable: "dbo.Posts",
      sourceColumns: ["AuthorId"],
      targetTable: "dbo.Users",
      targetColumns: ["Id"],
      cardinality: "N:1",
    },
  ],
};

function pointer(target: Element, type: string, x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

function mount(events = {}): { host: HTMLElement; renderer: SchemaRenderer } {
  const host = document.createElement("div");
  host.getBoundingClientRect = () =>
    ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(host);
  const renderer = new SchemaRenderer(host, { events });
  renderer.setSchema(schema);
  renderer.resetView(); // scale = 1，位移換算才好驗證
  return { host, renderer };
}

function card(host: HTMLElement, id: string): HTMLElement {
  return host.querySelector<HTMLElement>(`[data-table-id="${id}"]`)!;
}

beforeEach(() => document.body.replaceChildren());

describe("拖曳卡片", () => {
  it("拖曳會移動卡片位置", () => {
    const { host } = mount();
    const posts = card(host, "dbo.Posts");
    const startLeft = Number.parseFloat(posts.style.left);
    const startTop = Number.parseFloat(posts.style.top);

    pointer(posts.querySelector(".dbs-card-header")!, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 160, 140);
    pointer(posts, "pointerup", 160, 140);

    expect(Number.parseFloat(posts.style.left)).toBeCloseTo(startLeft + 60, 1);
    expect(Number.parseFloat(posts.style.top)).toBeCloseTo(startTop + 40, 1);
  });

  it("小於門檻的移動不算拖曳，仍然視為點擊", () => {
    const { host } = mount();
    const posts = card(host, "dbo.Posts");
    const startLeft = posts.style.left;

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 102, 101);
    pointer(posts, "pointerup", 102, 101);

    expect(posts.style.left).toBe(startLeft);
  });

  it("拖曳後不會誤觸 Focus", () => {
    const tableSelected = vi.fn();
    const { host } = mount({ tableSelected });
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 200);
    pointer(posts, "pointerup", 200, 200);
    posts.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(tableSelected).not.toHaveBeenCalled();
  });

  it("沒有拖曳時，點擊照常觸發 Focus", () => {
    const tableSelected = vi.fn();
    const { host } = mount({ tableSelected });
    const posts = card(host, "dbo.Posts");

    posts.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tableSelected).toHaveBeenCalledWith("dbo.Posts");
  });

  it("關聯線跟著卡片一起移動", () => {
    const { host } = mount();
    const posts = card(host, "dbo.Posts");
    const path = host.querySelector('[data-relation="FK_Posts_Users"] .dbs-edge-path')!;
    const before = path.getAttribute("d");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 300, 250);
    pointer(posts, "pointerup", 300, 250);

    expect(path.getAttribute("d")).not.toBe(before);
    // halo 必須同步，否則會露出兩條不重疊的線。
    expect(host.querySelector('[data-relation="FK_Posts_Users"] .dbs-edge-halo')!.getAttribute("d")).toBe(
      path.getAttribute("d"),
    );
  });

  it("拖曳中的卡片會被標記，放開後移除", () => {
    const { host } = mount();
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 200);
    expect(posts.classList.contains("is-dragging")).toBe(true);

    pointer(posts, "pointerup", 200, 200);
    expect(posts.classList.contains("is-dragging")).toBe(false);
  });

  it("拖曳會通知呼叫端版面已偏離 Auto Layout", () => {
    const layoutChanged = vi.fn();
    const { host } = mount({ layoutChanged });
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 200);
    pointer(posts, "pointerup", 200, 200);

    expect(layoutChanged).toHaveBeenCalledTimes(1);
  });

  it("摺疊鈕不會被當成拖曳起點", () => {
    const { host } = mount();
    const posts = card(host, "dbo.Posts");
    const startLeft = posts.style.left;

    pointer(posts.querySelector('[data-action="toggle-collapse"]')!, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 200);
    pointer(posts, "pointerup", 200, 200);

    expect(posts.style.left).toBe(startLeft);
  });
});

describe("手動位置與 Auto Layout 的關係", () => {
  it("切換檢視層級後仍保留手動位置", () => {
    const { host, renderer } = mount();
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 400, 300);
    pointer(posts, "pointerup", 400, 300);
    const dragged = card(host, "dbo.Posts").style.left;

    renderer.setViewState({ detailLevel: "keys" });
    expect(card(host, "dbo.Posts").style.left).toBe(dragged);
  });

  it("resetLayout 會回到 Auto Layout 的位置", () => {
    const { host, renderer } = mount();
    const before = card(host, "dbo.Posts").style.left;

    const posts = card(host, "dbo.Posts");
    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 400, 300);
    pointer(posts, "pointerup", 400, 300);
    expect(card(host, "dbo.Posts").style.left).not.toBe(before);

    renderer.resetLayout();
    expect(card(host, "dbo.Posts").style.left).toBe(before);
  });

  it("hasManualPositions 反映是否調整過", () => {
    const { host, renderer } = mount();
    expect(renderer.hasManualPositions()).toBe(false);

    const posts = card(host, "dbo.Posts");
    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 200);
    pointer(posts, "pointerup", 200, 200);

    expect(renderer.hasManualPositions()).toBe(true);
    renderer.resetLayout();
    expect(renderer.hasManualPositions()).toBe(false);
  });

  it("拖曳不會改動 Schema（不是 Schema Editor）", () => {
    const snapshot = JSON.stringify(schema);
    const { host } = mount();
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 400, 300);
    pointer(posts, "pointerup", 400, 300);

    expect(JSON.stringify(schema)).toBe(snapshot);
  });
});
