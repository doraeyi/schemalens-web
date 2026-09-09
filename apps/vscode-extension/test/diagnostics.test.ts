import { beforeEach, describe, expect, it } from "vitest";
import {
  DiagnosticsProvider,
  loadDocumentSchema,
  toVsCodeDiagnostic,
} from "../src/diagnostics/DiagnosticsProvider.js";
import { DiagnosticSeverity, makeDocument, resetStub } from "./vscodeStub.js";

beforeEach(() => resetStub());

describe("loadDocumentSchema", () => {
  it("合法 DSL：拿到 Schema 且沒有診斷", () => {
    const result = loadDocumentSchema(
      makeDocument(`table Users {
  PK Id bigint not null
}`),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.schema.tables).toHaveLength(1);
  });

  it("DSL 有錯時仍回傳可解析的部分（US10）", () => {
    const result = loadDocumentSchema(
      makeDocument(`table Users {
  PK Id bigint not null
}

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Unknown.Id
}`),
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.schema.tables).toHaveLength(1);
  });

  it("同時收集 Parser 與 Validator 的診斷", () => {
    const result = loadDocumentSchema(
      makeDocument(`table A {
  Broken ???
}
relation R {
  A.x N -> 1 Ghost.y
}`),
    );
    const codes = new Set(result.diagnostics.map((d) => d.code));
    expect(codes.has("SCHEMA_PARSE_ERROR")).toBe(true);
    expect(codes.has("SCHEMA_RELATION_TARGET_NOT_FOUND")).toBe(true);
  });
});

describe("toVsCodeDiagnostic", () => {
  it("1-based 的 SourceLocation 轉成 0-based 的 Range", () => {
    const diagnostic = toVsCodeDiagnostic({
      code: "SCHEMA_PARSE_ERROR",
      severity: "error",
      message: "壞掉",
      location: { line: 42, column: 18, endLine: 42, endColumn: 24 },
    });
    expect(diagnostic.range.start.line).toBe(41);
    expect(diagnostic.range.start.character).toBe(17);
    expect(diagnostic.range.end.character).toBe(23);
  });

  it("帶上 error code 與 source，Problems Panel 才看得出來源", () => {
    const diagnostic = toVsCodeDiagnostic({
      code: "SCHEMA_RELATION_TARGET_NOT_FOUND",
      severity: "error",
      message: "x",
      location: { line: 1, column: 1 },
    });
    expect(diagnostic.code).toBe("SCHEMA_RELATION_TARGET_NOT_FOUND");
    expect(diagnostic.source).toBe("DBSchema");
  });

  it("沒有結束位置時至少標一個字元，波浪線才畫得出來", () => {
    const diagnostic = toVsCodeDiagnostic({
      code: "SCHEMA_PARSE_ERROR",
      severity: "error",
      message: "x",
      location: { line: 1, column: 1 },
    });
    expect(diagnostic.range.end.character).toBeGreaterThan(diagnostic.range.start.character);
  });

  it("severity 對應到 VS Code 的層級", () => {
    expect(
      toVsCodeDiagnostic({ code: "SCHEMA_PARSE_ERROR", severity: "warning", message: "x" }).severity,
    ).toBe(DiagnosticSeverity.Warning);
    expect(
      toVsCodeDiagnostic({ code: "SCHEMA_PARSE_ERROR", severity: "error", message: "x" }).severity,
    ).toBe(DiagnosticSeverity.Error);
  });

  it("沒有 location 時退回檔案開頭而不是丟錯", () => {
    const diagnostic = toVsCodeDiagnostic({ code: "SCHEMA_PARSE_ERROR", severity: "error", message: "x" });
    expect(diagnostic.range.start.line).toBe(0);
  });
});

describe("DiagnosticsProvider", () => {
  it("把診斷寫進 collection（AC-04）", () => {
    const provider = new DiagnosticsProvider();
    const document = makeDocument(`relation R {
  A.x N -> 1 B.y
}`);
    provider.refresh(document);

    const entries = [...(provider as unknown as { collection: { entries: Map<string, unknown[]> } }).collection.entries];
    expect(entries[0]![1]!.length).toBeGreaterThan(0);
    provider.dispose();
  });

  it("忽略非 dbschema 的文件", () => {
    const provider = new DiagnosticsProvider();
    expect(provider.refresh(makeDocument("table A {}", "a.md", "markdown"))).toBeUndefined();
    provider.dispose();
  });

  it("解析成功時把 Schema 回呼出去，供 Preview 重繪", () => {
    const seen: number[] = [];
    const provider = new DiagnosticsProvider((_document, result) => seen.push(result.schema.tables.length));
    provider.refresh(makeDocument("table A {\n  PK Id bigint\n}"));
    expect(seen).toEqual([1]);
    provider.dispose();
  });
});
