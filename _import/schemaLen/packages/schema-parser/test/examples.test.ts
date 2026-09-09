/**
 * 範例檔是使用者第一眼看到的東西，也是手動驗證 Preview 的素材。
 * 它們必須永遠能乾淨解析與驗證，否則 README 教的第一步就會壞掉。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateSchema } from "@schemalens/schema-core";
import { parseMarkdownSchema, parseSchema } from "@schemalens/schema-parser";

const example = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url)), "utf8");

describe("examples/blog.dbschema", () => {
  const source = example("blog.dbschema");
  const { schema, diagnostics } = parseSchema(source, "blog.dbschema");

  it("解析沒有診斷", () => {
    expect(diagnostics).toEqual([]);
  });

  it("驗證沒有診斷", () => {
    expect(validateSchema(schema, { file: "blog.dbschema" })).toEqual([]);
  });

  it("涵蓋 PK / FK / UQ / IDX、composite index 與多條 relation", () => {
    expect(schema.tables).toHaveLength(5);
    expect(schema.relations).toHaveLength(5);

    const posts = schema.tables.find((table) => table.name === "Posts")!;
    expect(posts.columns.find((column) => column.name === "AuthorId")!.foreignKey).toBe(true);
    expect(posts.indexes[0]!.columns).toEqual(["AuthorId", "CreatedAt"]);

    const postTags = schema.tables.find((table) => table.name === "PostTags")!;
    expect(postTags.indexes[0]!.unique).toBe(true);
  });
});

describe("examples/large-schema.schema.md", () => {
  const source = example("large-schema.schema.md");
  const { schema, diagnostics } = parseMarkdownSchema(source, "large-schema.schema.md");

  it("解析與驗證都沒有診斷", () => {
    expect(diagnostics).toEqual([]);
    expect(validateSchema(schema, { file: "large-schema.schema.md" })).toEqual([]);
  });

  it("規模落在 AC-20 要求的範圍內（100 張表以上）", () => {
    expect(schema.tables.length).toBeGreaterThanOrEqual(100);
    expect(schema.tables.length).toBeLessThanOrEqual(200);
    expect(schema.relations.length).toBeGreaterThan(100);
  });

  it("跨模組區塊的關聯都解析得到（兩端 table 都存在）", () => {
    const ids = new Set(schema.tables.map((table) => table.id));
    for (const relation of schema.relations) {
      expect(ids.has(relation.sourceTable)).toBe(true);
      expect(ids.has(relation.targetTable)).toBe(true);
    }
  });

  it("有跨 schema 的關聯，才測得到多模組情境", () => {
    const crossSchema = schema.relations.filter(
      (relation) => relation.sourceTable.split(".")[0] !== relation.targetTable.split(".")[0],
    );
    expect(crossSchema.length).toBeGreaterThan(0);
  });

  it("SourceLocation 指向 Markdown 的實際行，雙擊才跳得準", () => {
    const lines = source.split(/\r?\n/);
    for (const table of schema.tables.slice(0, 20)) {
      const line = lines[table.location!.line - 1] ?? "";
      expect(line).toContain(`table ${table.id}`);
    }
  });
});

describe("examples/design.schema.md", () => {
  const source = example("design.schema.md");
  const { schema, diagnostics } = parseMarkdownSchema(source, "design.schema.md");

  it("跨多個 dbschema 區塊合併成一份 Schema", () => {
    expect(diagnostics).toEqual([]);
    expect(schema.tables.map((table) => table.name)).toEqual(["Orders", "OrderItems", "Users"]);
    expect(schema.relations).toHaveLength(2);
  });

  it("驗證沒有診斷（跨區塊的 relation 也解析得到）", () => {
    expect(validateSchema(schema, { file: "design.schema.md" })).toEqual([]);
  });
});
