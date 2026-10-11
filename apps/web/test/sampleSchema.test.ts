import { describe, expect, it } from "vitest";
import { lintSchema } from "@schemalens/schema-lint";
import { parseSchema } from "@schemalens/schema-parser";
import { validateSchema } from "@schemalens/schema-core";
import { SAMPLE_SCHEMA_DSL, SNIPPET_DSL } from "../src/lib/schema/sampleSchema";

// 範例是新使用者看到的第一份圖：不能帶任何解析錯誤，也不該一打開就跳 lint 建議。
describe("built-in sample schema", () => {
  it("parses cleanly and has no lint advisories", () => {
    const { schema, diagnostics } = parseSchema(SAMPLE_SCHEMA_DSL, "blog-sample.dbschema");
    expect([...diagnostics, ...validateSchema(schema)]).toEqual([]);
    expect(schema.tables).toHaveLength(5);
    expect(schema.relations).toHaveLength(5);
    expect(lintSchema(schema)).toEqual([]);
  });

  it("import-dialog snippet parses cleanly", () => {
    const { schema, diagnostics } = parseSchema(SNIPPET_DSL, "snippet.dbschema");
    expect(diagnostics).toEqual([]);
    expect(schema.relations).toHaveLength(1);
  });
});
