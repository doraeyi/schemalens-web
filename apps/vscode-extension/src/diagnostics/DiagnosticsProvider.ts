import * as vscode from "vscode";
import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import {
  isSupportedSchemaFile,
  lintDiagnostics,
  loadSchemaFromText,
  type DisplayDiagnostic,
} from "../schema/documentSchema.js";

export const DBSCHEMA_LANGUAGE_ID = "dbschema";

/** 監看／掃描的檔案：跟 isSupportedSchemaFile 同一組副檔名。 */
export const SCHEMA_FILE_GLOB = "**/*.{dbschema,schema.md,schema.json}";

export interface DocumentSchema {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
}

/**
 * 這次重新解析是怎麼來的：
 * - `editor`：使用者正在編輯器裡打字（文件有未存檔的修改）
 * - `disk`：檔案在磁碟上被改了——Claude Code／Codex 之類的 agent 直接寫檔、git checkout、
 *   或另一個程式產生的。Preview 會用這個決定要不要標出「這次改了什麼」。
 */
export type SchemaChangeOrigin = "editor" | "disk";

export type SchemaChangedHandler = (uri: vscode.Uri, result: DocumentSchema, origin: SchemaChangeOrigin) => void;

export interface DiagnosticsProviderOptions {
  /** 是否附上 lint 警告（dbschema.lint.enabled）。預設開。 */
  isLintEnabled?: () => boolean;
}

/**
 * 讀一份文件 → Schema + 診斷。
 *
 * 永遠回傳 Schema（可能是部分結果），因此 Preview 在有錯時仍能顯示可解析的部分（US10）。
 */
export function loadDocumentSchema(document: vscode.TextDocument): DocumentSchema {
  return loadSchemaFromText(document.getText(), document.uri.fsPath);
}

/** 需要驗證的文件：`.dbschema`（語言 id）或 `*.schema.md` / `*.schema.json`（檔名）。 */
function isDiagnosableDocument(document: vscode.TextDocument): boolean {
  return document.languageId === DBSCHEMA_LANGUAGE_ID || isSupportedSchemaFile(document.uri.fsPath);
}

/** SchemaDiagnostic 是 1-based；VS Code 的 Position 是 0-based。 */
export function toVsCodeDiagnostic(diagnostic: DisplayDiagnostic): vscode.Diagnostic {
  const location = diagnostic.location;
  const startLine = Math.max(0, (location?.line ?? 1) - 1);
  const startColumn = Math.max(0, (location?.column ?? 1) - 1);
  const endLine = Math.max(startLine, (location?.endLine ?? location?.line ?? 1) - 1);
  // 沒有結束欄時至少標一個字元，否則波浪線畫不出來。
  const endColumn = Math.max(startColumn + 1, (location?.endColumn ?? startColumn + 2) - 1);

  const result = new vscode.Diagnostic(
    new vscode.Range(startLine, startColumn, endLine, endColumn),
    diagnostic.message,
    diagnostic.severity === "warning"
      ? vscode.DiagnosticSeverity.Warning
      : diagnostic.severity === "info"
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Error,
  );
  result.code = diagnostic.code;
  result.source = "DBSchema";
  return result;
}

/**
 * 把 DSL 錯誤跟 lint 警告送進 Editor 的波浪線與 Problems Panel（AC-04）。
 *
 * 不只看編輯器裡開著的文件，也監看磁碟上的 schema 檔：agent 直接改寫檔案、新建檔案，
 * 就算沒有開在編輯器裡，Problems 跟 Preview 也會即時更新。關掉分頁也不會清掉問題，
 * 整個 workspace 的 schema 檔都持續檢查（跟 TypeScript 等語言的行為一致）。
 */
export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("dbschema");
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** 每個檔案上一次解析的內容——磁碟事件跟編輯器事件常常是同一次修改，內容沒變就不重做。 */
  private readonly lastText = new Map<string, string>();

  constructor(
    private readonly onSchemaChanged?: SchemaChangedHandler,
    private readonly options: DiagnosticsProviderOptions = {},
  ) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => this.refresh(document)),
      vscode.workspace.onDidSaveTextDocument((document) => this.refresh(document)),
      // 關掉分頁時未存檔的修改會被丟掉，改回用磁碟上的內容繼續檢查，而不是把問題清掉。
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (!isDiagnosableDocument(document)) return;
        this.timers.delete(document.uri.toString());
        this.lastText.delete(document.uri.toString());
        if (document.uri.scheme === "file") void this.refreshFromDisk(document.uri);
        else this.collection.delete(document.uri);
      }),
      // 邊打字邊驗證，但 debounce 以免大型檔案每個按鍵都重跑一次解析。
      vscode.workspace.onDidChangeTextDocument((event) => this.scheduleRefresh(event.document)),
    );

    for (const document of vscode.workspace.textDocuments) this.refresh(document);
  }

  /**
   * 開始監看磁碟上的 schema 檔，並先把 workspace 裡現有的都檢查一次。
   * 跟建構子分開，單元測試可以只測解析／診斷，不用模擬檔案系統。
   */
  watchWorkspace(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(SCHEMA_FILE_GLOB);
    this.disposables.push(
      watcher,
      watcher.onDidChange((uri) => this.onDiskChange(uri)),
      watcher.onDidCreate((uri) => this.onDiskChange(uri)),
      watcher.onDidDelete((uri) => {
        this.collection.delete(uri);
        this.lastText.delete(uri.toString());
      }),
    );

    this.scanWorkspace();
  }

  /** workspace 裡沒開在編輯器的 schema 檔，從磁碟讀進來檢查。 */
  private scanWorkspace(): void {
    void vscode.workspace.findFiles(SCHEMA_FILE_GLOB, "**/node_modules/**", 2000).then((uris) => {
      for (const uri of uris) if (!this.openDocument(uri)) void this.refreshFromDisk(uri);
    });
  }

  /** 編輯器裡的文件（不管有沒有存檔）。 */
  refresh(document: vscode.TextDocument): DocumentSchema | undefined {
    if (!isDiagnosableDocument(document)) return undefined;
    // 文件在事件發生後仍然「沒有未存檔的修改」，代表內容是從磁碟重新載入的（外部改寫），不是打字。
    const origin: SchemaChangeOrigin = document.isDirty ? "editor" : "disk";
    return this.apply(document.uri, document.getText(), origin);
  }

  /** 重新套用全部（例如 lint 設定改了）。 */
  refreshAll(): void {
    this.lastText.clear();
    for (const document of vscode.workspace.textDocuments) this.refresh(document);
    this.scanWorkspace();
  }

  async refreshFromDisk(uri: vscode.Uri): Promise<DocumentSchema | undefined> {
    if (!isSupportedSchemaFile(uri.fsPath)) return undefined;
    let text: string;
    try {
      text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
      // 讀不到（剛被刪掉、權限）就當作沒有這個檔案。
      this.collection.delete(uri);
      return undefined;
    }
    if (this.lastText.get(uri.toString()) === text) return undefined;
    return this.apply(uri, text, "disk");
  }

  private onDiskChange(uri: vscode.Uri): void {
    // 開在編輯器裡的檔案交給 onDidChangeTextDocument：沒有未存檔修改時 VS Code 會自己重新載入並觸發它；
    // 有未存檔修改時編輯器裡的內容才是使用者要的，不能拿磁碟上的蓋過去。
    if (this.openDocument(uri)) return;
    void this.refreshFromDisk(uri);
  }

  private openDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
    const key = uri.toString();
    return vscode.workspace.textDocuments.find((document) => document.uri.toString() === key);
  }

  private apply(uri: vscode.Uri, text: string, origin: SchemaChangeOrigin): DocumentSchema {
    // 內容跟上次一樣（例如打完字按存檔、重新開啟同一個檔案）就不通知 Preview——
    // 不然存檔會被當成「外部修改」，把使用者自己剛打的東西也標成變更。診斷照樣更新。
    const unchanged = this.lastText.get(uri.toString()) === text;
    this.lastText.set(uri.toString(), text);
    const result = loadSchemaFromText(text, uri.fsPath);
    const lint = this.options.isLintEnabled?.() === false ? [] : lintDiagnostics(result.schema);
    this.collection.set(uri, [...result.diagnostics, ...lint].map(toVsCodeDiagnostic));
    if (!unchanged) this.onSchemaChanged?.(uri, result, origin);
    return result;
  }

  private scheduleRefresh(document: vscode.TextDocument): void {
    if (!isDiagnosableDocument(document)) return;
    const key = document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.refresh(document);
      }, 300),
    );
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const disposable of this.disposables) disposable.dispose();
    this.collection.dispose();
  }
}
