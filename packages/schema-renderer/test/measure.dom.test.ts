/**
 * 卡片寬度量測。
 *
 * jsdom 不做版面計算，offsetWidth 恆為 0，因此這裡用 getter 模擬量測結果：
 * 帶 is-measuring-essential 時回「不含備註的必要寬度」，否則回「自然寬度」。
 * 這正是 renderer 量測時的兩個階段。
 */
import { afterEach, describe, expect, it } from "vitest";
import { CARD_METRICS, SchemaRenderer } from "@schemalens/schema-renderer";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";

const schema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: [
    {
      id: "dbo.Comments",
      schema: "dbo",
      name: "Comments",
      comment: "留言",
      columns: [
        { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false, comment: "留言 ID" },
        { name: "PostId", type: "bigint", nullable: false, primaryKey: false, foreignKey: true, unique: false, indexed: false, comment: "所屬文章" },
      ],
      indexes: [],
    },
  ],
  relations: [],
};

const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

/** 讓 .dbs-card 在兩個量測階段回傳不同寬度。 */
function stubMeasurement(essential: number, natural: number): void {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList?.contains("dbs-card")) return 0;
      return this.classList.contains("is-measuring-essential") ? essential : natural;
    },
  });
}

function mount(): { host: HTMLElement; renderer: SchemaRenderer } {
  const host = document.createElement("div");
  host.getBoundingClientRect = () =>
    ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(host);
  return { host, renderer: new SchemaRenderer(host) };
}

function cardWidth(host: HTMLElement): number {
  return Number.parseFloat(host.querySelector<HTMLElement>(".dbs-card")!.style.width);
}

afterEach(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, "offsetWidth", original);
  document.body.replaceChildren();
});

describe("依實際渲染寬度自動調整卡片", () => {
  it("套用量到的自然寬度，而不是估算值", () => {
    stubMeasurement(300, 460);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBe(460);
  });

  it("自然寬度超過上限時截到上限（備註可以被截斷）", () => {
    stubMeasurement(300, 2000);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBe(CARD_METRICS.maxWidth);
  });

  it("欄位名稱與型別永遠不被截斷：必要寬度超過上限時，卡片跟著變寬", () => {
    const essential = CARD_METRICS.maxWidth + 240;
    stubMeasurement(essential, essential + 500);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBe(essential);
  });

  it("不會窄於 minWidth", () => {
    stubMeasurement(40, 60);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBe(CARD_METRICS.minWidth);
  });

  it("量測結果會回饋給 layout，卡片位置依新寬度重排", () => {
    stubMeasurement(300, 640);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    // 重排後仍有明確的座標，而不是停留在量測用的 max-content。
    const card = host.querySelector<HTMLElement>(".dbs-card")!;
    expect(card.style.left).toMatch(/px$/);
    expect(card.style.width).toBe("640px");
  });

  it("量測階段的暫時性 class 不會留在畫面上", () => {
    stubMeasurement(300, 460);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(host.querySelectorAll(".is-measuring-essential")).toHaveLength(0);
  });

  it("量不到寬度的環境（offsetWidth 為 0）維持估算值，不會把卡片壓成 0", () => {
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBeGreaterThanOrEqual(CARD_METRICS.minWidth);
  });

  it("切換檢視層級後會重新量測", () => {
    stubMeasurement(300, 460);
    const { host, renderer } = mount();
    renderer.setSchema(schema);
    expect(cardWidth(host)).toBe(460);

    stubMeasurement(200, 260);
    renderer.setViewState({ detailLevel: "keys" });
    expect(cardWidth(host)).toBe(260);
  });
});
