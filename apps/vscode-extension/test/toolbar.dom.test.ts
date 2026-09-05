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
    onGroupFilter: vi.fn(),
    onClearColumnFocus: vi.fn(),
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
      groupFilter: null,
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
      groupFilter: null,
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

describe("群組篩選下拉", () => {
  const schemaWithGroups = {
    version: "1",
    metadata: { defaultSchema: "dbo" },
    groups: [
      { name: "Identity", description: "身分與權限" },
      { name: "Sales" },
    ],
    tables: [
      { id: "dbo.Users", schema: "dbo", name: "Users", group: "Identity", columns: [], indexes: [] },
      { id: "dbo.Orders", schema: "dbo", name: "Orders", group: "Sales", columns: [], indexes: [] },
    ],
    relations: [],
  };

  function select(toolbar: Toolbar): HTMLSelectElement {
    return toolbar.element.querySelector("select")!;
  }

  it("沒有群組時整組隱藏，不佔 Toolbar 空間", () => {
    const { toolbar } = makeToolbar();
    toolbar.setSchema({
      version: "1",
      metadata: { defaultSchema: "dbo" },
      tables: [],
      relations: [],
    });
    expect(select(toolbar).parentElement!.hidden).toBe(true);
  });

  it("列出全部群組，並附上描述", () => {
    const { toolbar } = makeToolbar();
    toolbar.setSchema(schemaWithGroups);
    const options = [...select(toolbar).options].map((o) => o.textContent);
    expect(options[0]).toBe("All groups");
    expect(options).toContain("Identity — 身分與權限");
    // 沒有描述的群組只顯示名稱
    expect(options).toContain("Sales");
  });

  it("選擇群組會回報名稱", () => {
    const onGroupFilter = vi.fn();
    const handlers: ToolbarHandlers = {
      onDetailLevel: vi.fn(), onDepth: vi.fn(), onDirection: vi.fn(), onUnrelated: vi.fn(),
      onResetFocus: vi.fn(), onFitView: vi.fn(), onResetLayout: vi.fn(), onComments: vi.fn(),
      onPickHit: vi.fn(), onSearchResults: vi.fn(), onLocale: vi.fn(), onGroupFilter,
      onClearColumnFocus: vi.fn(),
    };
    const toolbar = new Toolbar(handlers, stringsFor("en"));
    document.body.append(toolbar.element);
    toolbar.setSchema(schemaWithGroups);

    const el = select(toolbar);
    el.value = "Identity";
    el.dispatchEvent(new Event("change"));
    expect(onGroupFilter).toHaveBeenCalledWith("Identity");
  });

  it("選回全部時回報 null", () => {
    const onGroupFilter = vi.fn();
    const handlers: ToolbarHandlers = {
      onDetailLevel: vi.fn(), onDepth: vi.fn(), onDirection: vi.fn(), onUnrelated: vi.fn(),
      onResetFocus: vi.fn(), onFitView: vi.fn(), onResetLayout: vi.fn(), onComments: vi.fn(),
      onPickHit: vi.fn(), onSearchResults: vi.fn(), onLocale: vi.fn(), onGroupFilter,
      onClearColumnFocus: vi.fn(),
    };
    const toolbar = new Toolbar(handlers, stringsFor("en"));
    document.body.append(toolbar.element);
    toolbar.setSchema(schemaWithGroups);

    const el = select(toolbar);
    el.value = "";
    el.dispatchEvent(new Event("change"));
    expect(onGroupFilter).toHaveBeenCalledWith(null);
  });

  it("setActive 會同步目前選到的群組", () => {
    const { toolbar } = makeToolbar();
    toolbar.setSchema(schemaWithGroups);
    toolbar.setActive({
      detailLevel: "full", depth: 1, direction: "all", unrelated: "dim",
      expandComments: false, groupFilter: "Sales", locale: "en",
    });
    expect(select(toolbar).value).toBe("Sales");
  });
});

describe("欄位聚焦狀態", () => {
  it("預設隱藏", () => {
    const { toolbar } = makeToolbar();
    expect(toolbar.element.querySelector<HTMLElement>(".dbs-column-focus")!.hidden).toBe(true);
  });

  it("設定後顯示欄位全名，讓使用者知道畫面為什麼變暗", () => {
    const { toolbar } = makeToolbar();
    toolbar.setColumnFocus("dbo.Orders.UserId");
    const chip = toolbar.element.querySelector<HTMLElement>(".dbs-column-focus")!;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("dbo.Orders.UserId");
  });

  it("中文語系用中文標籤", () => {
    const { toolbar } = makeToolbar("zh-hant");
    toolbar.setColumnFocus("dbo.Orders.UserId");
    expect(toolbar.element.querySelector(".dbs-column-focus")!.textContent).toContain("欄位聚焦");
  });

  it("點它會要求取消聚焦", () => {
    const onClearColumnFocus = vi.fn();
    const handlers: ToolbarHandlers = {
      onDetailLevel: vi.fn(), onDepth: vi.fn(), onDirection: vi.fn(), onUnrelated: vi.fn(),
      onResetFocus: vi.fn(), onFitView: vi.fn(), onResetLayout: vi.fn(), onComments: vi.fn(),
      onPickHit: vi.fn(), onSearchResults: vi.fn(), onLocale: vi.fn(), onGroupFilter: vi.fn(),
      onClearColumnFocus,
    };
    const toolbar = new Toolbar(handlers, stringsFor("en"));
    document.body.append(toolbar.element);
    toolbar.setColumnFocus("dbo.Orders.UserId");
    toolbar.element.querySelector<HTMLElement>(".dbs-column-focus")!.click();
    expect(onClearColumnFocus).toHaveBeenCalled();
  });

  it("設回 null 後隱藏", () => {
    const { toolbar } = makeToolbar();
    toolbar.setColumnFocus("dbo.Orders.UserId");
    toolbar.setColumnFocus(null);
    expect(toolbar.element.querySelector<HTMLElement>(".dbs-column-focus")!.hidden).toBe(true);
  });
});
