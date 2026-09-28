import { beforeEach, describe, expect, it } from "vitest";
import { dataUrlToBytes, exportAs, importSql, showExportMenu, siblingUri } from "../src/export/exportCommands.js";
import { PreviewPanel } from "../src/preview/PreviewPanel.js";
import {
  Uri,
  createdPanels,
  disk,
  makeDocument,
  quickPickChoices,
  resetStub,
  shownMessages,
  webviewMessages,
  window,
  workspace,
  writtenFiles,
} from "./vscodeStub.js";

/** 跟真的 VS Code 一樣：目前的編輯器文件也會出現在 workspace.textDocuments 裡。 */
function openInEditor(document: ReturnType<typeof makeDocument>): void {
  window.activeTextEditor = { document };
  workspace.textDocuments = [document];
}

const SCHEMA = `table Users {
  PK Id    bigint        not null
     Email nvarchar(255) not null
}

table Orders {
  PK Id     bigint not null
  FK UserId bigint not null
}

relation Orders_Users {
  Orders.UserId N -> 1 Users.Id
}
`;

const SQL = `CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) NOT NULL);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);`;

function fakeContext() {
  const state = new Map<string, unknown>();
  return {
    extensionUri: Uri.file("/ext"),
    subscriptions: [],
    globalState: {
      get: <T>(key: string) => state.get(key) as T | undefined,
      update: (key: string, value: unknown) => {
        state.set(key, value);
        return Promise.resolve();
      },
    },
  } as never;
}

const text = (path: string) => new TextDecoder().decode(writtenFiles.get(path));

beforeEach(() => {
  resetStub();
  (PreviewPanel as unknown as { current: undefined }).current = undefined;
  openInEditor(makeDocument(SCHEMA, "/repo/shop.dbschema"));
});

describe("匯出（跟網頁版同一套轉換）", () => {
  it("SQL：依方言輸出 CREATE TABLE，預設存在來源檔旁邊", async () => {
    await exportAs({ kind: "sql", dialect: "postgresql" });
    const sql = text("/repo/shop.postgresql.sql");
    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("Orders");
    expect(sql).toContain("FOREIGN KEY");
  });

  it("DSL 跟 JSON", async () => {
    await exportAs({ kind: "dsl" });
    await exportAs({ kind: "json" });
    expect(text("/repo/shop.dbschema")).toContain("table Users");
    expect(JSON.parse(text("/repo/shop.schema.json")).tables).toHaveLength(2);
  });

  it("沒有開任何 schema 時提示，不會寫檔", async () => {
    window.activeTextEditor = undefined;
    expect(await exportAs({ kind: "dsl" })).toBeUndefined();
    expect(writtenFiles.size).toBe(0);
    expect(shownMessages.length).toBe(1);
  });

  it("圖片要先開 Preview", async () => {
    expect(await exportAs({ kind: "image", format: "png" })).toBeUndefined();
    expect(writtenFiles.size).toBe(0);
  });

  it("開著 Preview 時，圖片由 Webview 畫好傳回來再存檔（PNG、SVG）", async () => {
    PreviewPanel.show(fakeContext(), { version: "1", metadata: { defaultSchema: "dbo" }, tables: [], relations: [] }, Uri.file("/repo/shop.dbschema"));
    createdPanels[0]!.receive({ type: "ready" });

    await exportAs({ kind: "image", format: "png" });
    await exportAs({ kind: "image", format: "svg" });

    expect(webviewMessages.filter((m) => m.type === "exportImage").map((m) => m.format)).toEqual(["png", "svg"]);
    expect(text("/repo/shop.png")).toBe("PNGDATA");
    expect(text("/repo/shop.svg")).toBe("<svg>圖</svg>");
  });

  it("匯出選單（Preview 工具列的「匯出…」）", async () => {
    quickPickChoices.push("SQL — MySQL");
    await showExportMenu();
    expect(writtenFiles.has("/repo/shop.mysql.sql")).toBe(true);
  });
});

describe("匯入 SQL → .dbschema", () => {
  it("用目前開著的 .sql 檔，產生 .dbschema 並打開 Preview", async () => {
    openInEditor(makeDocument(SQL, "/repo/db/init.sql", "sql"));
    quickPickChoices.push("MySQL");

    const target = await importSql(fakeContext());

    expect(target?.fsPath).toBe("/repo/db/init.dbschema");
    const dsl = text("/repo/db/init.dbschema");
    expect(dsl).toContain("table dbo.users");
    expect(dsl).toContain("table dbo.orders");
    expect(dsl).toMatch(/relation [^\n]+\{\n\s+dbo\.orders\.user_id N -> 1 dbo\.users\.id/);
    expect(PreviewPanel.active?.current?.schema.tables).toHaveLength(2);
  });

  it("沒開 .sql 時跳出選檔對話框（也支援檔案總管右鍵傳進來的檔案）", async () => {
    window.activeTextEditor = undefined;
    disk.set("/repo/schema.sql", SQL);
    window.openDialogResult = [Uri.file("/repo/schema.sql")];
    await importSql(fakeContext());
    expect(writtenFiles.has("/repo/schema.dbschema")).toBe(true);

    resetStub();
    disk.set("/repo/other.sql", SQL);
    await importSql(fakeContext(), Uri.file("/repo/other.sql"));
    expect(writtenFiles.has("/repo/other.dbschema")).toBe(true);
  });

  it("讀不到任何 CREATE TABLE 時報錯、不寫檔", async () => {
    openInEditor(makeDocument("SELECT 1;", "/repo/q.sql", "sql"));
    expect(await importSql(fakeContext())).toBeUndefined();
    expect(writtenFiles.size).toBe(0);
  });
});

describe("小工具", () => {
  it("siblingUri 換掉 schema 相關的副檔名", () => {
    expect(siblingUri(Uri.file("/a/b.schema.md"), ".png")?.fsPath).toBe("/a/b.png");
    expect(siblingUri(Uri.file("/a/b.sql"), ".dbschema")?.fsPath).toBe("/a/b.dbschema");
  });

  it("dataUrlToBytes 處理 base64 跟 URL-encoded 兩種", () => {
    expect(new TextDecoder().decode(dataUrlToBytes("data:text/plain;base64,QUJD"))).toBe("ABC");
    expect(new TextDecoder().decode(dataUrlToBytes("data:image/svg+xml;charset=utf-8,%3Csvg%3E"))).toBe("<svg>");
  });
});
