import { beforeEach, describe, expect, it } from "vitest";
import { DiagnosticsProvider, type SchemaChangeOrigin } from "../src/diagnostics/DiagnosticsProvider.js";
import { lintDiagnostics, loadSchemaFromText } from "../src/schema/documentSchema.js";
import { Uri, disk, events, makeDocument, resetStub, workspace } from "./vscodeStub.js";

beforeEach(() => resetStub());

/** 等 provider 裡非同步的讀檔／findFiles 跑完。 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function entries(provider: DiagnosticsProvider): Map<string, Array<{ code?: string | number }>> {
  return (provider as unknown as { collection: { entries: Map<string, Array<{ code?: string | number }>> } }).collection.entries;
}

const VALID = "table Users {\n  PK Id bigint not null\n}\n";
const WITH_ORDERS = `${VALID}\ntable Orders {\n  PK Id bigint not null\n     UserId bigint not null\n}\n\nrelation R {\n  Orders.UserId N -> 1 Users.Id\n}\n`;
const BROKEN = "table Users {\n  PK Id ???\n}\n";

function track() {
  const seen: Array<{ path: string; tables: number; origin: SchemaChangeOrigin }> = [];
  const handler = (uri: Uri, result: { schema: { tables: unknown[] } }, origin: SchemaChangeOrigin) =>
    seen.push({ path: uri.fsPath, tables: result.schema.tables.length, origin });
  return { seen, handler };
}

describe("lint 警告（跟網頁版同一套規則）", () => {
  it("外鍵沒有 index 的警告對到那個欄位所在的行", () => {
    const { schema } = loadSchemaFromText(WITH_ORDERS, "a.dbschema");
    const warning = lintDiagnostics(schema).find((d) => d.code === "LINT_FK_NO_INDEX");
    expect(warning?.severity).toBe("warning");
    expect(warning?.location?.line).toBe(7); // `UserId bigint not null` 那一行
  });

  it("表層級的警告只標表頭那一行", () => {
    const { schema } = loadSchemaFromText("table Empty {\n}\n", "a.dbschema");
    const warning = lintDiagnostics(schema).find((d) => d.code === "LINT_EMPTY_TABLE");
    expect(warning?.location?.line).toBe(1);
    expect(warning?.location?.endLine).toBe(1);
  });

  it("出現在 Problems 裡，設定關掉時就不顯示", () => {
    const on = new DiagnosticsProvider();
    on.refresh(makeDocument(WITH_ORDERS));
    expect([...entries(on).values()][0]!.some((d) => d.code === "LINT_FK_NO_INDEX")).toBe(true);
    on.dispose();

    resetStub();
    const off = new DiagnosticsProvider(undefined, { isLintEnabled: () => false });
    off.refresh(makeDocument(WITH_ORDERS));
    expect([...entries(off).values()][0]!.some((d) => String(d.code).startsWith("LINT_"))).toBe(false);
    off.dispose();
  });
});

describe("agent 直接改寫磁碟上的檔案", () => {
  it("沒開在編輯器的檔案被改寫：Problems 跟 Preview 都更新，標記為外部修改", async () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.watchWorkspace();

    disk.set("schema.dbschema", VALID);
    events.diskChange.fire(Uri.file("schema.dbschema"));
    await flush();
    disk.set("schema.dbschema", BROKEN);
    events.diskChange.fire(Uri.file("schema.dbschema"));
    await flush();

    expect(seen.map((s) => s.origin)).toEqual(["disk", "disk"]);
    expect(entries(provider).get("schema.dbschema")!.some((d) => d.code === "SCHEMA_PARSE_ERROR")).toBe(true);
    provider.dispose();
  });

  it("agent 新建的 schema 檔也會被檢查", async () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.watchWorkspace();

    disk.set("generated.dbschema", WITH_ORDERS);
    events.diskCreate.fire(Uri.file("generated.dbschema"));
    await flush();

    expect(seen).toEqual([{ path: "generated.dbschema", tables: 2, origin: "disk" }]);
    provider.dispose();
  });

  it("磁碟事件內容沒變就不重複通知（同一次修改常常會觸發好幾個事件）", async () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.watchWorkspace();

    disk.set("schema.dbschema", VALID);
    events.diskChange.fire(Uri.file("schema.dbschema"));
    await flush();
    events.diskChange.fire(Uri.file("schema.dbschema"));
    await flush();

    expect(seen).toHaveLength(1);
    provider.dispose();
  });

  it("開在編輯器裡、有未存檔修改的檔案，不會被磁碟上的內容蓋掉", async () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.watchWorkspace();
    workspace.textDocuments = [makeDocument(VALID, "schema.dbschema", "dbschema", true)];

    disk.set("schema.dbschema", BROKEN);
    events.diskChange.fire(Uri.file("schema.dbschema"));
    await flush();

    expect(seen).toEqual([]);
    provider.dispose();
  });

  it("檔案被刪掉就清掉它的問題", async () => {
    const provider = new DiagnosticsProvider();
    provider.watchWorkspace();
    disk.set("schema.dbschema", BROKEN);
    events.diskCreate.fire(Uri.file("schema.dbschema"));
    await flush();
    expect(entries(provider).has("schema.dbschema")).toBe(true);

    disk.delete("schema.dbschema");
    events.diskDelete.fire(Uri.file("schema.dbschema"));
    expect(entries(provider).has("schema.dbschema")).toBe(false);
    provider.dispose();
  });

  it("啟動時把 workspace 裡現有的 schema 檔都檢查一次", async () => {
    disk.set("a.dbschema", BROKEN);
    disk.set("docs/b.schema.md", "# B\n\n```dbschema\ntable B {\n  PK Id bigint\n}\n```\n");
    const provider = new DiagnosticsProvider();
    provider.watchWorkspace();
    await flush();
    await flush();

    expect(entries(provider).has("a.dbschema")).toBe(true);
    expect(entries(provider).has("docs/b.schema.md")).toBe(true);
    provider.dispose();
  });
});

describe("編輯器裡的文件", () => {
  it("打字（有未存檔修改）算 editor；VS Code 從磁碟重新載入（沒有未存檔修改）算 disk", () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.refresh(makeDocument(VALID, "a.dbschema", "dbschema", true));
    provider.refresh(makeDocument(WITH_ORDERS, "a.dbschema", "dbschema", false));
    expect(seen.map((s) => s.origin)).toEqual(["editor", "disk"]);
    provider.dispose();
  });

  it("打完字按存檔（內容沒變）不會再通知 Preview，不然會被當成外部修改", () => {
    const { seen, handler } = track();
    const provider = new DiagnosticsProvider(handler);
    provider.refresh(makeDocument(WITH_ORDERS, "a.dbschema", "dbschema", true));
    events.save.fire(makeDocument(WITH_ORDERS, "a.dbschema", "dbschema", false));
    expect(seen.map((s) => s.origin)).toEqual(["editor"]);
    provider.dispose();
  });

  it("關掉分頁不會清掉問題，改用磁碟上的內容繼續檢查", async () => {
    const provider = new DiagnosticsProvider();
    disk.set("a.dbschema", BROKEN);
    provider.refresh(makeDocument(BROKEN, "a.dbschema"));
    events.close.fire(makeDocument(BROKEN, "a.dbschema"));
    await flush();
    expect(entries(provider).get("a.dbschema")!.some((d) => d.code === "SCHEMA_PARSE_ERROR")).toBe(true);
    provider.dispose();
  });
});
