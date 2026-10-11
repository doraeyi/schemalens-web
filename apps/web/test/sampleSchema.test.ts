import { describe, expect, it } from "vitest";
import { lintSchema } from "@schemalens/schema-lint";
import { parseSchema } from "@schemalens/schema-parser";
import { validateSchema } from "@schemalens/schema-core";
import { SAMPLE_SCHEMA_DSL, SAMPLE_SCHEMA_DSL_EN, SNIPPET_DSL } from "../src/lib/schema/sampleSchema";

// 範例是新使用者看到的第一份圖：不能帶任何解析錯誤，也不該一打開就跳 lint 建議。
describe("built-in sample schema", () => {
  it("parses cleanly and has no lint advisories", () => {
    const { schema, diagnostics } = parseSchema(SAMPLE_SCHEMA_DSL, "blog-sample.dbschema");
    expect([...diagnostics, ...validateSchema(schema)]).toEqual([]);
    expect(schema.tables).toHaveLength(5);
    expect(schema.relations).toHaveLength(5);
    expect(lintSchema(schema)).toEqual([]);
  });

  it("English sample has the same structure and no Chinese", () => {
    const zh = parseSchema(SAMPLE_SCHEMA_DSL, "zh.dbschema").schema;
    const { schema, diagnostics } = parseSchema(SAMPLE_SCHEMA_DSL_EN, "en.dbschema");
    expect(diagnostics).toEqual([]);
    expect(schema.tables.map((t) => t.id)).toEqual(zh.tables.map((t) => t.id));
    expect(schema.relations.length).toBe(zh.relations.length);
    expect(SAMPLE_SCHEMA_DSL_EN).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("import-dialog snippet parses cleanly", () => {
    const { schema, diagnostics } = parseSchema(SNIPPET_DSL, "snippet.dbschema");
    expect(diagnostics).toEqual([]);
    expect(schema.relations).toHaveLength(1);
  });
});
