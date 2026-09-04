import { describe, expect, it } from "vitest";
import { toJson } from "@schemalens/schema-serializer";
import { parseSchema } from "@schemalens/schema-parser";
import { isSchemaJson, jsonExportUri, loadSchemaFromText } from "../src/schema/documentSchema.js";
import { Uri } from "./vscodeStub.js";

const DSL = `table Users {
  PK Id bigint not null
}`;

describe("isSchemaJson", () => {
  it("認得 *.schema.json", () => {
    expect(isSchemaJson("d:/x/database.schema.json")).toBe(true);
    expect(isSchemaJson("d:/x/database.json")).toBe(false);
    expect(isSchemaJson("d:/x/database.dbschema")).toBe(false);
  });
});

describe("loadSchemaFromText", () => {
  it(".dbschema 走 DSL Parser", () => {
    const result = loadSchemaFromText(DSL, "d:/x/database.dbschema");
    expect(result.schema.tables).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
  });

  it("*.schema.json 走 JSON Import（AC-18）", () => {
    const json = toJson(parseSchema(DSL).schema);
    const result = loadSchemaFromText(json, "d:/x/database.schema.json");
    expect(result.schema.tables).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
  });

  it("兩條路徑都會跑 Validator", () => {
    const result = loadSchemaFromText(
      `table A {
  PK Id bigint not null
}
relation R {
  A.Id N -> 1 Ghost.Id
}`,
      "d:/x/database.dbschema",
    );
    expect(result.diagnostics.map((d) => d.code)).toContain("SCHEMA_RELATION_TARGET_NOT_FOUND");
  });

  it("壞掉的 JSON 仍回傳可用的空 Schema", () => {
    const result = loadSchemaFromText("{ broken", "d:/x/database.schema.json");
    expect(result.schema.tables).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("jsonExportUri", () => {
  it("orders.dbschema → orders.schema.json", () => {
    expect(jsonExportUri(Uri.file("d:/x/orders.dbschema")).fsPath).toBe("d:/x/orders.schema.json");
  });

  it("已經是 schema.json 時不會疊加副檔名", () => {
    expect(jsonExportUri(Uri.file("d:/x/orders.schema.json")).fsPath).toBe("d:/x/orders.schema.json");
  });
});
