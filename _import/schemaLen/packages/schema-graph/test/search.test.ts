import { describe, expect, it } from "vitest";
import { generateSchema } from "@schemalens/schema-fixtures";
import { search, searchColumns, searchTables } from "@schemalens/schema-graph";

const schema = generateSchema({ tableCount: 100 });

describe("searchTables", () => {
  it("找得到 table 名稱（US3）", () => {
    const hits = searchTables(schema, "Order");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.tableId.toLowerCase().includes("order") || hit.matchedOn === "comment")).toBe(true);
  });

  it("支援 schema.table 全名搜尋", () => {
    const target = schema.tables[0]!;
    const hits = searchTables(schema, target.id);
    expect(hits[0]?.tableId).toBe(target.id);
  });

  it("完全相符排在前綴相符之前", () => {
    const exact = schema.tables.find((t) => t.name === "Users");
    if (!exact) return;
    const hits = searchTables(schema, "Users");
    expect(hits[0]?.tableId).toBe(exact.id);
  });

  it("空查詢不回傳結果", () => {
    expect(searchTables(schema, "   ")).toEqual([]);
  });
});

describe("searchColumns", () => {
  it("同名欄位會列出所有所屬 table（US6）", () => {
    const hits = searchColumns(schema, "CreatedAt");
    expect(hits.length).toBeGreaterThan(5);
    // 每一筆都要帶著 table，才能做 Jump + Highlight。
    expect(hits.every((hit) => hit.tableId && hit.column === "CreatedAt")).toBe(true);
  });

  it("label 是 Table.Column 形式，方便直接顯示在搜尋結果", () => {
    const hits = searchColumns(schema, "Code");
    expect(hits[0]?.label).toMatch(/^[^.]+\.Code$/);
  });
});

describe("search", () => {
  it("同分時 table 命中排在 column 命中之前", () => {
    const hits = search(schema, "Users", 20);
    const firstTable = hits.findIndex((hit) => hit.kind === "table");
    const firstColumn = hits.findIndex((hit) => hit.kind === "column");
    if (firstTable >= 0 && firstColumn >= 0) {
      expect(hits[firstTable]!.score).toBeGreaterThanOrEqual(hits[firstColumn]!.score);
    }
  });

  it("100 表的搜尋在 50ms 內完成", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) search(schema, "Id", 60);
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });
});
