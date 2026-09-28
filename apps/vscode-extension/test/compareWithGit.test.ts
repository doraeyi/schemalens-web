import { beforeEach, describe, expect, it } from "vitest";
import { compareWithGit, type GitApi, type GitRepository } from "../src/compare/compareWithGit.js";
import { PreviewPanel } from "../src/preview/PreviewPanel.js";
import {
  Uri,
  createdPanels,
  makeDocument,
  quickPickChoices,
  resetStub,
  shownMessages,
  webviewMessages,
  window,
  workspace,
} from "./vscodeStub.js";

const HEAD_VERSION = "table Users {\n  PK Id bigint not null\n}\n";
const OLD_VERSION = "table Legacy {\n  PK Id bigint not null\n}\n";
const CURRENT = "table Users {\n  PK Id    bigint        not null\n     Email nvarchar(255) null\n}\n\ntable Orders {\n  PK Id bigint not null\n}\n";

function fakeContext() {
  return { extensionUri: Uri.file("/ext"), subscriptions: [], globalState: { get: () => undefined, update: () => Promise.resolve() } } as never;
}

function fakeGit(repository: GitRepository | null): { api: () => Promise<GitApi>; shown: Array<{ ref: string; path: string }> } {
  const shown: Array<{ ref: string; path: string }> = [];
  const wrapped = repository && {
    log: repository.log,
    show: (ref: string, path: string) => {
      shown.push({ ref, path });
      return repository.show(ref, path);
    },
  };
  return { api: () => Promise.resolve({ getRepository: () => wrapped }), shown };
}

const repo: GitRepository = {
  log: () =>
    Promise.resolve([
      { hash: "aaaaaaa1111", message: "加上 Email 欄位\n\n細節", authorName: "liam", authorDate: new Date("2026-09-01") },
      { hash: "bbbbbbb2222", message: "初版", authorName: "liam" },
    ]),
  show: (ref) => {
    if (ref === "HEAD") return Promise.resolve(HEAD_VERSION);
    if (ref === "bbbbbbb2222") return Promise.resolve(OLD_VERSION);
    return Promise.reject(new Error("path does not exist in commit"));
  },
};

function compareMessage() {
  return webviewMessages.find((m) => m.type === "compare") as { base: { tables: Array<{ id: string }> }; baseLabel: string } | undefined;
}

beforeEach(() => {
  resetStub();
  (PreviewPanel as unknown as { current: undefined }).current = undefined;
  const document = makeDocument(CURRENT, "/repo/shop.dbschema");
  window.activeTextEditor = { document };
  workspace.textDocuments = [document];
});

describe("跟 git 比較", () => {
  it("預設跟 HEAD 比（看還沒 commit 的修改）：打開 Preview 並進入比較模式", async () => {
    const git = fakeGit(repo);
    expect(await compareWithGit(fakeContext(), git.api)).toBe(true);
    createdPanels[0]!.receive({ type: "ready" });

    expect(git.shown).toEqual([{ ref: "HEAD", path: "/repo/shop.dbschema" }]);
    const message = compareMessage();
    expect(message?.baseLabel).toBe("HEAD");
    expect(message?.base.tables.map((t) => t.id)).toEqual(["dbo.Users"]);
    // 目前的內容照常送到 Preview，Webview 用它跟 base 比
    expect(PreviewPanel.active?.current?.schema.tables).toHaveLength(2);
  });

  it("也可以挑這個檔案歷史上的某個 commit", async () => {
    quickPickChoices.push("bbbbbbb  初版");
    const git = fakeGit(repo);
    await compareWithGit(fakeContext(), git.api);
    createdPanels[0]!.receive({ type: "ready" });

    expect(git.shown[0]!.ref).toBe("bbbbbbb2222");
    expect(compareMessage()?.baseLabel).toBe("bbbbbbb");
    expect(compareMessage()?.base.tables.map((t) => t.id)).toEqual(["dbo.Legacy"]);
  });

  it("commit 訊息只顯示第一行", async () => {
    let offered: string[] = [];
    const original = window.showQuickPick;
    window.showQuickPick = (items: unknown[]) => {
      offered = (items as Array<{ label: string }>).map((i) => i.label);
      return Promise.resolve(undefined);
    };
    await compareWithGit(fakeContext(), fakeGit(repo).api);
    window.showQuickPick = original;
    expect(offered).toEqual(["HEAD", "aaaaaaa  加上 Email 欄位", "bbbbbbb  初版"]);
  });

  it("那個版本還沒有這個檔案：當成空的，所有表都算新增", async () => {
    quickPickChoices.push("aaaaaaa  加上 Email 欄位");
    await compareWithGit(fakeContext(), fakeGit(repo).api);
    createdPanels[0]!.receive({ type: "ready" });
    expect(compareMessage()?.base.tables).toEqual([]);
    expect(shownMessages.length).toBe(1);
  });

  it("不在 git 儲存庫裡就提示，不打開任何東西", async () => {
    expect(await compareWithGit(fakeContext(), fakeGit(null).api)).toBe(false);
    expect(createdPanels).toHaveLength(0);
    expect(shownMessages.length).toBe(1);
  });

  it("Git 擴充套件被停用時提示", async () => {
    expect(await compareWithGit(fakeContext(), () => Promise.resolve(undefined))).toBe(false);
    expect(shownMessages.length).toBe(1);
  });

  it("Preview 已經開著同一個檔案就沿用，不重開", async () => {
    PreviewPanel.show(fakeContext(), { version: "1", metadata: { defaultSchema: "dbo" }, tables: [], relations: [] }, Uri.file("/repo/shop.dbschema"));
    createdPanels[0]!.receive({ type: "ready" });
    await compareWithGit(fakeContext(), fakeGit(repo).api);
    expect(createdPanels).toHaveLength(1);
    expect(compareMessage()).toBeDefined();
  });
});
