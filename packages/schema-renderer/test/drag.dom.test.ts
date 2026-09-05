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

function mount(events = {}): {
  host: HTMLElement;
  renderer: SchemaRenderer;
  captures: number[];
} {
  const host = document.createElement("div");
  const captures: number[] = [];
  host.getBoundingClientRect = () =>
    ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(host);
  const renderer = new SchemaRenderer(host, { events });
  // jsdom 沒有 setPointerCapture，補上假的以觀察呼叫時機。
  const root = host.querySelector<HTMLElement>(".dbs-root")!;
  (root as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = (id) =>
    captures.push(id);
  (root as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture =
    () => {};
  renderer.setSchema(schema);
  renderer.resetView(); // scale = 1，位移換算才好驗證
  return { host, renderer, captures };
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

/**
 * 回歸測試。
 *
 * 指標被 setPointerCapture 捕捉後，瀏覽器會把後續的 click 重新指向捕捉元素，
 * 卡片就收不到 click，Focus / Dim / Hide 會整組失效。
 * 因此「按下卡片的當下」絕對不能捕捉，必須等真的開始拖曳。
 */
describe("點擊與拖曳不得互相干擾", () => {
  it("只是按下卡片時不捕捉指標，click 才不會被重新指向", () => {
    const { host, captures } = mount();
    pointer(card(host, "dbo.Posts"), "pointerdown", 100, 100);
    expect(captures).toEqual([]);
  });

  it("真的開始拖曳後才捕捉指標", () => {
    const { host, captures } = mount();
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 101, 101); // 未達門檻
    expect(captures).toEqual([]);

    pointer(posts, "pointermove", 200, 200); // 超過門檻
    expect(captures).toEqual([1]);
  });

  it("點卡片（沒拖曳）之後，Dim / Hide 仍然作用", () => {
    const { host, renderer } = mount();
    const posts = card(host, "dbo.Posts");

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointerup", 100, 100);
    posts.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Focus 成立：自己被選取。
    expect(card(host, "dbo.Posts").classList.contains("is-selected")).toBe(true);

    renderer.setViewState({ unrelated: "hide" });
    expect(renderer.getViewState().unrelated).toBe("hide");
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

/**
 * 聚焦後畫面上多數表都是淡化的背景資訊。
 * 在密集的畫面上很容易誤拉到它們，所以淡化的表不給拖——
 * 但點擊仍要有效，因為「點淡掉的表把焦點移過去」是正常的導覽方式。
 */
describe("淡化的表不可拖曳", () => {
  it("聚焦後，被淡化的表拖不動", () => {
    const { host, renderer } = mount();
    // Posts 參照 Users，所以從 Posts 看 downstream 是空的，Users 會被淡化。
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    const users = card(host, "dbo.Users");
    expect(users.classList.contains("is-dimmed")).toBe(true);
    const before = users.style.left;

    pointer(users, "pointerdown", 100, 100);
    pointer(users, "pointermove", 300, 300);
    pointer(users, "pointerup", 300, 300);

    expect(card(host, "dbo.Users").style.left).toBe(before);
    expect(renderer.hasManualPositions()).toBe(false);
  });

  it("同樣情境下，沒被淡化的表仍然拖得動", () => {
    const { host, renderer } = mount();
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    const posts = card(host, "dbo.Posts");
    expect(posts.classList.contains("is-dimmed")).toBe(false);
    const before = Number.parseFloat(posts.style.left);

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 100);
    pointer(posts, "pointerup", 200, 100);

    expect(Number.parseFloat(card(host, "dbo.Posts").style.left)).toBeCloseTo(before + 100, 1);
  });

  it("被群組篩掉的表拖不動", () => {
    const { host, renderer } = mount();
    renderer.setViewState({ groupFilter: "NotAGroup" });

    const posts = card(host, "dbo.Posts");
    expect(posts.classList.contains("is-filtered-out")).toBe(true);
    const before = posts.style.left;

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 300, 300);
    pointer(posts, "pointerup", 300, 300);

    expect(card(host, "dbo.Posts").style.left).toBe(before);
    expect(renderer.hasManualPositions()).toBe(false);
  });

  it("淡化的表仍然可以點擊，用來把焦點移過去", () => {
    const tableSelected = vi.fn();
    const { host, renderer } = mount({ tableSelected });
    renderer.setViewState({ groupFilter: "NotAGroup" });

    const posts = card(host, "dbo.Posts");
    posts.querySelector(".dbs-card-header")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tableSelected).toHaveBeenCalledWith("dbo.Posts");
  });

  it("沒有聚焦時所有表都拖得動", () => {
    const { host, renderer } = mount();
    const posts = card(host, "dbo.Posts");
    const before = Number.parseFloat(posts.style.left);

    pointer(posts, "pointerdown", 100, 100);
    pointer(posts, "pointermove", 200, 100);
    pointer(posts, "pointerup", 200, 100);

    expect(Number.parseFloat(card(host, "dbo.Posts").style.left)).toBeCloseTo(before + 100, 1);
    expect(renderer.hasManualPositions()).toBe(true);
  });

  it("游標樣式也要反映不可拖曳", () => {
    const { host } = mount();
    const css = host.querySelector("style")!.textContent!;
    expect(css).toContain(".dbs-card.is-dimmed .dbs-card-header");
    expect(css).toContain(".dbs-card.is-filtered-out .dbs-card-header");
  });
});

/**
 * 淡化的卡片在聚焦時佔了大半畫面。
 * 不給拖卡片是對的，但不能因此連視窗都平移不了——
 * 那一大片會變成完全動不了的死區。
 */
describe("從淡化的表也要能平移視窗", () => {
  const transform = (host: HTMLElement): string =>
    host.querySelector<HTMLElement>(".dbs-viewport")!.style.transform;

  it("在淡化的表上拖曳會平移視窗", () => {
    const { host, renderer } = mount();
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    const users = card(host, "dbo.Users");
    expect(users.classList.contains("is-dimmed")).toBe(true);
    const before = transform(host);

    pointer(users, "pointerdown", 100, 100);
    pointer(users, "pointermove", 220, 180);
    pointer(users, "pointerup", 220, 180);

    expect(transform(host)).not.toBe(before);
    // 平移不該把卡片本身移走。
    expect(renderer.hasManualPositions()).toBe(false);
  });

  it("平移後不會誤觸該表的 Focus", () => {
    const tableSelected = vi.fn();
    const { host, renderer } = mount({ tableSelected });
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    const users = card(host, "dbo.Users");
    pointer(users, "pointerdown", 100, 100);
    pointer(users, "pointermove", 260, 260);
    pointer(users, "pointerup", 260, 260);
    users.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(tableSelected).not.toHaveBeenCalled();
  });

  it("只是點一下（沒移動）仍然把焦點移過去", () => {
    const tableSelected = vi.fn();
    const { host, renderer } = mount({ tableSelected });
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    const users = card(host, "dbo.Users");
    pointer(users, "pointerdown", 100, 100);
    pointer(users, "pointerup", 100, 100);
    users.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(tableSelected).toHaveBeenCalledWith("dbo.Users");
  });

  it("在背景平移仍然正常", () => {
    const { host } = mount();
    const root = host.querySelector<HTMLElement>(".dbs-root")!;
    const before = transform(host);

    pointer(root, "pointerdown", 50, 50);
    pointer(root, "pointermove", 180, 120);
    pointer(root, "pointerup", 180, 120);

    expect(transform(host)).not.toBe(before);
  });

  it("平移不會立刻捕捉指標，點擊才不會被重新指向", () => {
    const { host, renderer, captures } = mount();
    renderer.focusTable("dbo.Posts", { direction: "downstream", depth: 1 });

    pointer(card(host, "dbo.Users"), "pointerdown", 100, 100);
    expect(captures).toEqual([]);
  });
});
