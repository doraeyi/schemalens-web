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
