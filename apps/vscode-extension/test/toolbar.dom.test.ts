/**
 * Toolbar 的語系切換。
 *
 * 這是使用者實際看得到、按得到的入口——設定頁太深，
 * 所以切換鈕本身必須被測試守住。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stringsFor, type Locale } from "@schemalens/schema-renderer";
import { Toolbar, type ToolbarHandlers } from "../src/webview/toolbar.js";

function makeToolbar(locale: Locale = "en"): {
  toolbar: Toolbar;
  onLocale: ReturnType<typeof vi.fn>;
} {
  const onLocale = vi.fn();
  const handlers: ToolbarHandlers = {
    onDetailLevel: vi.fn(),
    onDepth: vi.fn(),
    onDirection: vi.fn(),
    onUnrelated: vi.fn(),
    onResetFocus: vi.fn(),
    onFitView: vi.fn(),
    onResetLayout: vi.fn(),
    onComments: vi.fn(),
    onPickHit: vi.fn(),
    onSearchResults: vi.fn(),
    onLocale,
  };
  const toolbar = new Toolbar(handlers, stringsFor(locale));
  document.body.append(toolbar.element);
  return { toolbar, onLocale };
}

function buttons(toolbar: Toolbar): HTMLButtonElement[] {
  return [...toolbar.element.querySelectorAll("button")];
}

beforeEach(() => document.body.replaceChildren());

describe("語系切換鈕", () => {
  it("Toolbar 上有 EN 與 中文 兩顆按鈕", () => {
    const { toolbar } = makeToolbar();
    const labels = buttons(toolbar).map((b) => b.textContent);
    expect(labels).toContain("EN");
    expect(labels).toContain("中文");
  });

  it("按鈕標籤永遠是該語言本身，切到看不懂的語言也找得回來", () => {
    for (const locale of ["en", "zh-hant"] as const) {
      document.body.replaceChildren();
      const { toolbar } = makeToolbar(locale);
      const labels = buttons(toolbar).map((b) => b.textContent);
      expect(labels).toContain("EN");
      expect(labels).toContain("中文");
    }
  });

  it("點中文會回報 zh-hant", () => {
    const { toolbar, onLocale } = makeToolbar();
    buttons(toolbar).find((b) => b.textContent === "中文")!.click();
    expect(onLocale).toHaveBeenCalledWith("zh-hant");
  });

  it("點 EN 會回報 en", () => {
    const { toolbar, onLocale } = makeToolbar("zh-hant");
    buttons(toolbar).find((b) => b.textContent === "EN")!.click();
    expect(onLocale).toHaveBeenCalledWith("en");
  });

  it("setActive 會標示目前語系", () => {
    const { toolbar } = makeToolbar();
    toolbar.setActive({
      detailLevel: "full",
      depth: 1,
      direction: "all",
      unrelated: "dim",
      expandComments: false,
      locale: "zh-hant",
    });
    const active = buttons(toolbar).filter((b) => b.classList.contains("is-active"));
    expect(active.map((b) => b.textContent)).toContain("中文");
    expect(active.map((b) => b.textContent)).not.toContain("EN");
  });
});

describe("備註切換", () => {
  it("提供截斷與完整兩個選項", () => {
    const { toolbar } = makeToolbar();
    const labels = buttons(toolbar).map((b) => b.textContent);
    expect(labels).toContain("Truncate");
    expect(labels).toContain("Full");
  });

  it("中文標籤是截斷 / 完整", () => {
    const { toolbar } = makeToolbar("zh-hant");
    const labels = buttons(toolbar).map((b) => b.textContent);
    expect(labels).toContain("截斷");
    expect(labels).toContain("完整");
  });

  it("setActive 標示目前是截斷還是完整", () => {
    const { toolbar } = makeToolbar("zh-hant");
    toolbar.setActive({
      detailLevel: "full",
      depth: 1,
      direction: "all",
      unrelated: "dim",
      expandComments: true,
      locale: "zh-hant",
    });
    const active = buttons(toolbar)
      .filter((b) => b.classList.contains("is-active"))
      .map((b) => b.textContent);
    expect(active).toContain("完整");
    expect(active).not.toContain("截斷");
  });
});

describe("還原版面按鈕", () => {
  it("預設隱藏，沒拖曳過就不佔空間", () => {
    const { toolbar } = makeToolbar();
    const button = buttons(toolbar).find((b) => b.textContent === "Reset Layout")!;
    expect(button.hidden).toBe(true);
  });

  it("setLayoutDirty(true) 後才顯示", () => {
    const { toolbar } = makeToolbar();
    toolbar.setLayoutDirty(true);
    expect(buttons(toolbar).find((b) => b.textContent === "Reset Layout")!.hidden).toBe(false);
    toolbar.setLayoutDirty(false);
    expect(buttons(toolbar).find((b) => b.textContent === "Reset Layout")!.hidden).toBe(true);
  });

  it("中文時標籤是還原版面", () => {
    const { toolbar } = makeToolbar("zh-hant");
    expect(buttons(toolbar).map((b) => b.textContent)).toContain("還原版面");
  });
});

describe("Toolbar 語系", () => {
  it("英文時 Toolbar 標籤是英文", () => {
    const { toolbar } = makeToolbar("en");
    const labels = buttons(toolbar).map((b) => b.textContent);
    expect(labels).toContain("Overview");
    expect(labels).toContain("Reset Focus");
  });

  it("中文時 Toolbar 標籤是中文", () => {
    const { toolbar } = makeToolbar("zh-hant");
    const labels = buttons(toolbar).map((b) => b.textContent);
    expect(labels).toContain("總覽");
    expect(labels).toContain("取消聚焦");
  });

  it("搜尋框的提示文字跟著語系走", () => {
    const { toolbar } = makeToolbar("zh-hant");
    const input = toolbar.element.querySelector("input")!;
    expect(input.placeholder).toBe(stringsFor("zh-hant").searchPlaceholder);
  });
});
