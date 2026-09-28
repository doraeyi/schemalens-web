import * as vscode from "vscode";
import { t } from "../i18n.js";
import { PreviewPanel } from "../preview/PreviewPanel.js";
import { isSupportedSchemaFile, loadSchemaFromText } from "../schema/documentSchema.js";

/**
 * VS Code 內建 Git 擴充套件（vscode.git）公開 API 裡用得到的部分。
 * 完整型別在 vscode 原始碼的 extensions/git/src/api/git.d.ts；只抄需要的，不另外裝型別套件。
 */
export interface GitCommit {
  hash: string;
  message: string;
  authorName?: string;
  authorDate?: Date;
}

export interface GitRepository {
  log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
  /** path 可以是絕對路徑，Git 擴充套件會自己換成相對於 repository 的路徑。 */
  show(ref: string, path: string): Promise<string>;
}

export interface GitApi {
  getRepository(uri: vscode.Uri): GitRepository | null;
}

async function builtInGitApi(): Promise<GitApi | undefined> {
  const extension = vscode.extensions.getExtension<{ getAPI(version: 1): GitApi }>("vscode.git");
  if (!extension) return undefined;
  const exports = extension.isActive ? extension.exports : await extension.activate();
  return exports.getAPI(1);
}

async function readCurrent(uri: vscode.Uri): Promise<string> {
  const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
  if (open) return open.getText();
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
}

function sourceToCompare(): vscode.Uri | undefined {
  const previewed = PreviewPanel.active?.current?.source;
  if (previewed) return previewed;
  const document = vscode.window.activeTextEditor?.document;
  if (document && (document.languageId === "dbschema" || isSupportedSchemaFile(document.uri.fsPath))) return document.uri;
  return undefined;
}

/**
 * 跟 git 裡的某個版本比較（網頁版「比較」功能的插件版本）：預設第一個選項是 HEAD，
 * 看還沒 commit 的修改；也可以挑這個檔案歷史上的任一個 commit。
 * 比較畫面跟網頁版一樣：新增綠、刪除紅、修改黃。比較期間檔案再被改，畫面會自動重新比較。
 */
export async function compareWithGit(
  context: vscode.ExtensionContext,
  getGitApi: () => Promise<GitApi | undefined> = builtInGitApi,
): Promise<boolean> {
  const source = sourceToCompare();
  if (!source) {
    void vscode.window.showWarningMessage(t().openSchemaFileFirst);
    return false;
  }

  const git = await getGitApi();
  if (!git) {
    void vscode.window.showWarningMessage(t().gitUnavailable);
    return false;
  }
  const repository = git.getRepository(source);
  if (!repository) {
    void vscode.window.showWarningMessage(t().notInGitRepository);
    return false;
  }

  const commits = await repository.log({ path: source.fsPath, maxEntries: 30 }).catch(() => [] as GitCommit[]);
  const items = [
    { label: "HEAD", description: t().compareHeadDescription, ref: "HEAD" },
    ...commits.map((commit) => ({
      label: `${commit.hash.slice(0, 7)}  ${commit.message.split("\n", 1)[0] ?? ""}`,
      description: [commit.authorName, commit.authorDate?.toLocaleDateString()].filter(Boolean).join(" · "),
      ref: commit.hash,
    })),
  ];
  const picked = await vscode.window.showQuickPick(items, { title: t().comparePickerTitle, matchOnDescription: true });
  if (!picked) return false;
  const baseLabel = picked.ref === "HEAD" ? "HEAD" : picked.ref.slice(0, 7);

  let baseText = "";
  try {
    baseText = await repository.show(picked.ref, source.fsPath);
  } catch {
    // 那個版本還沒有這個檔案：當成空的，所有表都顯示成新增。
    void vscode.window.showInformationMessage(t().compareFileNotInVersion(baseLabel));
  }
  const base = loadSchemaFromText(baseText, source.fsPath).schema;

  if (PreviewPanel.active?.current?.source?.toString() !== source.toString()) {
    const current = loadSchemaFromText(await readCurrent(source), source.fsPath);
    PreviewPanel.show(context, current.schema, source, current.diagnostics);
  }
  PreviewPanel.active?.startCompare(base, baseLabel);
  return true;
}
