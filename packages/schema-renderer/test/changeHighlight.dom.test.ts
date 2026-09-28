/**
 * 檔案被外部改寫後，Preview 短暫標出新增／修改的表跟欄位。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { diffSchemas } from "@schemalens/schema-diff";
import { SchemaRenderer, highlightChanges } from "@schemalens/schema-renderer";

const BEFORE = "table Users {\n  PK Id bigint not null\n     Name nvarchar(50) null\n}\n";
const AFTER = `table Users {
  PK Id    bigint        not null
     Name  nvarchar(100) null
     Email nvarchar(255) null
}

table Orders {
  PK Id bigint not null
}
`;

describe("highlightChanges", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    vi.useRealTimers();
    host.remove();
  });

  it("新增的表跟欄位標綠、修改的標黃，幾秒後自動拿掉", () => {
    const before = parseSchema(BEFORE, "a.dbschema").schema;
    const after = parseSchema(AFTER, "a.dbschema").schema;
    const renderer = new SchemaRenderer(host);
    renderer.setSchema(before);
    renderer.updateSchema(after);

    highlightChanges(host, diffSchemas(before, after));

    const card = (id: string) => host.querySelector<HTMLElement>(`.dbs-card[data-table-id="${id}"]`)!;
    const row = (id: string, column: string) => card(id).querySelector<HTMLElement>(`.dbs-row[data-column="${column}"]`)!;

    expect(card("dbo.Orders").classList.contains("dbs-change-added")).toBe(true);
    expect(card("dbo.Users").classList.contains("dbs-change-changed")).toBe(true);
    expect(row("dbo.Users", "Email").classList.contains("dbs-change-added")).toBe(true);
    expect(row("dbo.Users", "Name").classList.contains("dbs-change-changed")).toBe(true);
    expect(row("dbo.Users", "Id").className).not.toContain("dbs-change");

    vi.advanceTimersByTime(4000);
    expect(host.querySelectorAll('[class*="dbs-change-"]').length).toBe(0);
  });

  it("樣式只注入一次", () => {
    const schema = parseSchema(BEFORE, "a.dbschema").schema;
    new SchemaRenderer(host).setSchema(schema);
    const none = { addedTables: [], changedTables: [] };
    highlightChanges(host, none);
    highlightChanges(host, none);
    expect(document.querySelectorAll("#dbs-change-highlight-style").length).toBe(1);
  });
});
