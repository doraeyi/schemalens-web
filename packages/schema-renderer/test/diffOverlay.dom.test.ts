/**
 * 比較模式的標記（網頁版的版本比較、插件的跟 git 比較共用）。
 */
import { describe, expect, it } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { buildMergedSchema, diffSchemas } from "@schemalens/schema-diff";
import { SchemaRenderer, applyDiffOverlay, clearDiffOverlay } from "@schemalens/schema-renderer";

const BASE = "table Users {\n  PK Id bigint not null\n     Nickname nvarchar(20) null\n}\n\ntable Legacy {\n  PK Id bigint not null\n}\n";
const NEXT = "table Users {\n  PK Id bigint not null\n     Email nvarchar(255) null\n}\n\ntable Orders {\n  PK Id bigint not null\n}\n";

describe("applyDiffOverlay", () => {
  it("合成圖裡新增、刪除、修改的表跟欄位各自標記；clear 後全部拿掉", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const base = parseSchema(BASE, "a.dbschema").schema;
    const next = parseSchema(NEXT, "a.dbschema").schema;

    new SchemaRenderer(host).setSchema(buildMergedSchema(base, next));
    applyDiffOverlay(host, diffSchemas(base, next));

    const card = (id: string) => host.querySelector<HTMLElement>(`.dbs-card[data-table-id="${id}"]`)!;
    const row = (id: string, column: string) => card(id).querySelector<HTMLElement>(`.dbs-row[data-column="${column}"]`)!;
    expect(card("dbo.Orders").classList.contains("sl-diff-added")).toBe(true);
    expect(card("dbo.Legacy").classList.contains("sl-diff-removed")).toBe(true);
    expect(card("dbo.Users").classList.contains("sl-diff-changed")).toBe(true);
    expect(row("dbo.Users", "Email").classList.contains("sl-diff-added")).toBe(true);
    expect(row("dbo.Users", "Nickname").classList.contains("sl-diff-removed")).toBe(true);
    expect(document.getElementById("dbs-diff-overlay-style")).not.toBeNull();

    clearDiffOverlay(host);
    expect(host.querySelectorAll('[class*="sl-diff-"]').length).toBe(0);
    host.remove();
  });
});
