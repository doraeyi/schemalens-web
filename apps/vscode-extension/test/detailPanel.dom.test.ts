import { describe, expect, it, vi } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { renderDetailPanel } from "../src/webview/detailPanel.js";

const TABLE = parseSchema(
  `table Users "使用者" {
  PK Id    bigint        not null
  UQ Email nvarchar(255) not null "登入用"
     Score decimal(10,2) null     default "0"
}
`,
  "a.dbschema",
).schema.tables[0]!;

describe("精簡模式的表格詳情面板", () => {
  it("列出每個欄位的標記、名稱、型別、可否為空、預設值跟備註", () => {
    const panel = document.createElement("div");
    renderDetailPanel(panel, TABLE, "zh-hant", { close: () => {}, openSource: () => {} });

    expect(panel.querySelector(".dbs-detail-title")?.textContent).toBe("dbo.Users");
    expect(panel.querySelector(".dbs-detail-sub")?.textContent).toBe("使用者 · 3 個欄位");
    const rows = [...panel.querySelectorAll(".dbs-detail-row")].map((row) => row.textContent);
    expect(rows[0]).toBe("PKIdNOT NULLbigint");
    expect(rows[1]).toBe("UQEmailNOT NULLnvarchar(255)登入用");
    expect(rows[2]).toBe("ScoreNULLdecimal(10,2)預設 0");
  });

  it("雙擊欄位跳到定義，關閉鈕取消聚焦", () => {
    const panel = document.createElement("div");
    const openSource = vi.fn();
    const close = vi.fn();
    renderDetailPanel(panel, TABLE, "en", { close, openSource });

    panel.querySelectorAll(".dbs-detail-row")[1]!.dispatchEvent(new MouseEvent("dblclick"));
    panel.querySelector(".dbs-detail-title")!.dispatchEvent(new MouseEvent("dblclick"));
    panel.querySelector<HTMLButtonElement>(".dbs-detail-close")!.click();

    expect(openSource.mock.calls).toEqual([["Email"], []]);
    expect(close).toHaveBeenCalledOnce();
    expect(panel.querySelector(".dbs-detail-close")?.textContent).toBe("Close");
  });
});
