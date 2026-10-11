/**
 * 鍵盤操作：卡片可以用 Tab 走到、Enter／空白鍵聚焦（再按一次取消）、Shift+Enter 跳回定義。
 * 網頁版跟 VS Code 插件共用這一層，兩邊都靠這裡才有鍵盤路徑。
 */
import { describe, expect, it, vi } from "vitest";
import { generateSchema } from "@schemalens/schema-fixtures";
import { SchemaRenderer } from "@schemalens/schema-renderer";

function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  const openSource = vi.fn();
  const tableSelected = vi.fn();
  const renderer = new SchemaRenderer(host, { locale: "en", events: { openSource, tableSelected } });
  const schema = generateSchema({ tableCount: 4, seed: 7 });
  renderer.setSchema(schema);
  const card = host.querySelector<HTMLElement>(".dbs-card")!;
  return { renderer, card, openSource, tableSelected };
}

function press(target: HTMLElement, key: string, shiftKey = false): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
}

describe("keyboard access to table cards", () => {
  it("makes every card focusable with an accessible name", () => {
    const { card } = setup();
    expect(card.tabIndex).toBe(0);
    expect(card.getAttribute("role")).toBe("button");
    expect(card.getAttribute("aria-label")).toMatch(/^Table .+, \d+ columns?$/);
  });

  it("Enter focuses the table and Enter again clears it", () => {
    const { renderer, card, tableSelected } = setup();
    const tableId = card.dataset.tableId!;

    press(card, "Enter");
    expect(renderer.getViewState().focus.tableId).toBe(tableId);
    expect(tableSelected).toHaveBeenCalledWith(tableId);
    expect(card.getAttribute("aria-pressed")).toBe("true");

    press(card, "Enter");
    expect(renderer.getViewState().focus.tableId).toBeNull();
  });

  it("Space behaves like Enter", () => {
    const { renderer, card } = setup();
    press(card, " ");
    expect(renderer.getViewState().focus.tableId).toBe(card.dataset.tableId);
  });

  it("Shift+Enter jumps to the source definition", () => {
    const { renderer, card, openSource } = setup();
    press(card, "Enter", true);
    expect(openSource).toHaveBeenCalledWith({ tableId: card.dataset.tableId });
    expect(renderer.getViewState().focus.tableId).toBeNull();
  });
});
