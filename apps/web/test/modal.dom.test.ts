/**
 * 對話框的鍵盤行為（$lib/actions/modal.ts）：之前每個對話框都只能點 ✕，按 Esc 完全沒反應。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { modal } from "../src/lib/actions/modal";

function mount() {
  const opener = document.createElement("button");
  opener.textContent = "open";
  document.body.append(opener);
  opener.focus();

  const overlay = document.createElement("div");
  overlay.innerHTML = `
    <div>
      <h2>匯入 Schema</h2>
      <button id="first">取消</button>
      <textarea data-autofocus></textarea>
      <button id="last">匯入</button>
    </div>`;
  document.body.append(overlay);
  const onClose = vi.fn();
  const action = modal(overlay, onClose)!;
  mounted.push(action);
  const panel = overlay.firstElementChild as HTMLElement;
  return { opener, overlay, panel, onClose, action };
}

const mounted: Array<{ destroy?: () => void }> = [];

afterEach(() => {
  for (const action of mounted.splice(0)) action.destroy?.();
  document.body.innerHTML = "";
});

describe("modal action", () => {
  it("marks the panel as a labelled modal dialog", () => {
    const { panel } = mount();
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    const heading = panel.querySelector("h2")!;
    expect(panel.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("moves focus to the [data-autofocus] element", () => {
    const { panel } = mount();
    expect(document.activeElement).toBe(panel.querySelector("textarea"));
  });

  it("closes on Escape, even when focus is outside the dialog", () => {
    const { onClose } = mount();
    document.body.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops Escape from reaching other window listeners (e.g. clearing the canvas focus)", () => {
    const { onClose } = mount();
    const other = vi.fn();
    window.addEventListener("keydown", other);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.removeEventListener("keydown", other);
    expect(onClose).toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
  });

  it("closes when the backdrop itself is pressed, not the panel", () => {
    const { overlay, panel, onClose } = mount();
    panel.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets only the topmost of two stacked dialogs handle Escape", () => {
    const first = mount();
    const second = mount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
    expect(first.onClose).not.toHaveBeenCalled();
  });

  it("returns focus to the opener when destroyed", () => {
    const { opener, action } = mount();
    action.destroy?.();
    mounted.splice(mounted.indexOf(action), 1);
    expect(document.activeElement).toBe(opener);
  });
});
