import { describe, expect, it } from "vitest";
import { extractDbschemaBlocks, parseMarkdownSchema } from "@schemalens/schema-parser";

const DOC = `# Database Design

一些說明文字。

\`\`\`dbschema
table Users {
  PK Id bigint not null
}
\`\`\`

再一些說明。

\`\`\`ts
const notSchema = 1;
\`\`\`

\`\`\`dbschema
table Posts {
  PK Id bigint not null
  FK AuthorId bigint not null
}

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
\`\`\`
`;

describe("extractDbschemaBlocks", () => {
  it("只取出 dbschema 區塊", () => {
    const blocks = extractDbschemaBlocks(DOC);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain("table Users");
    expect(blocks[1]!.source).toContain("table Posts");
  });

  it("記錄區塊在 Markdown 中的行號", () => {
    const blocks = extractDbschemaBlocks(DOC);
    expect(blocks[0]!.fenceLine).toBe(5);
    expect(blocks[0]!.startLine).toBe(6);
    expect(blocks[0]!.endLine).toBe(8);
  });

  it("忽略其他語言的區塊", () => {
    expect(extractDbschemaBlocks("```ts\nconst a = 1;\n```")).toEqual([]);
  });

  it("支援 ~~~ 圍欄", () => {
    const blocks = extractDbschemaBlocks("~~~dbschema\ntable A {\n}\n~~~");
    expect(blocks).toHaveLength(1);
  });

  it("未閉合的圍欄吃到檔尾，不會無限迴圈", () => {
    const blocks = extractDbschemaBlocks("```dbschema\ntable A {\n");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toContain("table A");
  });

  it("沒有區塊時回傳空陣列", () => {
    expect(extractDbschemaBlocks("# 只有標題")).toEqual([]);
  });
});

describe("parseMarkdownSchema", () => {
  it("多個區塊合併成同一份 Schema", () => {
    const { schema, diagnostics } = parseMarkdownSchema(DOC, "database.schema.md");
    expect(diagnostics).toEqual([]);
    expect(schema.tables.map((t) => t.name)).toEqual(["Users", "Posts"]);
    expect(schema.relations).toHaveLength(1);
  });

  it("SourceLocation 平移回 Markdown 的實際行號", () => {
    const { schema } = parseMarkdownSchema(DOC, "database.schema.md");
    // `table Users` 在 Markdown 第 6 行。
    expect(schema.tables[0]!.location?.line).toBe(6);
    // `table Posts` 在第 18 行。
    expect(schema.tables[1]!.location?.line).toBe(18);
  });

  it("診斷行號也平移到 Markdown 位置（Problems Panel 才跳得對）", () => {
    const doc = `# 標題

\`\`\`dbschema
table A {
  Broken ???
}
\`\`\`
`;
    const { diagnostics } = parseMarkdownSchema(doc, "x.schema.md");
    expect(diagnostics[0]!.location?.line).toBe(5);
  });

  it("沒有 dbschema 區塊時回傳空 Schema 而不是錯誤", () => {
    const { schema, diagnostics } = parseMarkdownSchema("# 沒有區塊");
    expect(schema.tables).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it("區塊內有錯不影響其他區塊（US10）", () => {
    const doc = `\`\`\`dbschema
nonsense
\`\`\`

\`\`\`dbschema
table Good {
  PK Id bigint not null
}
\`\`\`
`;
    const { schema, diagnostics } = parseMarkdownSchema(doc);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(schema.tables.map((t) => t.name)).toEqual(["Good"]);
  });
});
