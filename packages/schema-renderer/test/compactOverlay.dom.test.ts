/**
 * 精簡模式（網頁版與 VS Code 插件共用）：依群組分區排版、分區外框、直角連線。
 */
import { describe, expect, it } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import {
  SchemaRenderer,
  clearCompactOverlay,
  createCompactLayoutEngine,
  syncCompactOverlay,
} from "@schemalens/schema-renderer";

const SOURCE = `group Identity "身分驗證"
group Sales

table Users in Identity {
  PK Id bigint not null
}

table Orders in Sales {
  PK Id     bigint not null
     UserId bigint not null
}

table Invoices in Sales {
  PK Id      bigint not null
     OrderId bigint not null
}

relation Orders_Users {
  Orders.UserId N -> 1 Users.Id
}

relation Invoices_Orders {
  Invoices.OrderId N -> 1 Orders.Id
}
`;

function renderCompact() {
  const host = document.createElement("div");
  document.body.append(host);
  const schema = parseSchema(SOURCE, "a.dbschema").schema;
  const renderer = new SchemaRenderer(host);
  renderer.setLayoutEngine(createCompactLayoutEngine(() => schema));
  renderer.setViewState({ detailLevel: "compact" });
  renderer.setSchema(schema);
  return { host, schema };
}

describe("精簡模式", () => {
  it("每個群組一個分區外框，標題由呼叫端決定（插件依語系傳入）", () => {
    const { host, schema } = renderCompact();
    syncCompactOverlay(host, schema, new Set(), (group, count) => `${group} (${count} tables)`);

    const titles = [...host.querySelectorAll(".sl-zone-title")].map((el) => el.textContent);
    expect(titles).toEqual(["Identity (1 tables)", "Sales (2 tables)"]);
    expect(host.querySelector(".sl-zone-desc")?.textContent).toBe("身分驗證");
    host.remove();
  });

  it("關聯改畫成直角連線（每個關聯一條線加一個箭頭），原本的曲線隱藏", () => {
    const { host, schema } = renderCompact();
    syncCompactOverlay(host, schema, new Set());

    expect(host.querySelectorAll(".sl-connector-path")).toHaveLength(2);
    expect(host.querySelectorAll(".sl-connector-arrowhead")).toHaveLength(2);
    expect(host.classList.contains("sl-compact-active")).toBe(true);
    expect(document.getElementById("dbs-compact-overlay-style")).not.toBeNull();
    host.remove();
  });

  it("群組依宣告順序由上往下排，不會互相重疊", () => {
    const { host, schema } = renderCompact();
    syncCompactOverlay(host, schema, new Set());
    const [identity, sales] = [...host.querySelectorAll<HTMLElement>(".sl-zone")].map((zone) => ({
      top: Number.parseFloat(zone.style.top),
      bottom: Number.parseFloat(zone.style.top) + Number.parseFloat(zone.style.height),
    }));
    expect(identity!.bottom).toBeLessThanOrEqual(sales!.top);
    host.remove();
  });

  it("切回完整模式時清乾淨", () => {
    const { host, schema } = renderCompact();
    syncCompactOverlay(host, schema, new Set());
    clearCompactOverlay(host);
    expect(host.querySelector(".sl-zone-layer")).toBeNull();
    expect(host.querySelector(".sl-connector-layer")).toBeNull();
    expect(host.classList.contains("sl-compact-active")).toBe(false);
    host.remove();
  });
});
