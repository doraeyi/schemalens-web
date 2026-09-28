import * as vscode from "vscode";
import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import { diffSchemas, type SchemaDiff } from "@schemalens/schema-diff";
import { currentLocale, t } from "../i18n.js";
import type { ExtensionToWebview, ImageFormat, WebviewToExtension } from "./protocol.js";
import { findSourceLocation } from "./sourceNavigation.js";

/**
 * DBSchema 專屬 Preview（約束 #13：不為了 Markdown Preview 犧牲這裡的能力）。
 * 單一 panel 重用，避免使用者開出一堆重複視窗。
 */
export class PreviewPanel {
  private static current: PreviewPanel | undefined;

  static show(
    context: vscode.ExtensionContext,
    schema: Schema,
    source: vscode.Uri | undefined,
    diagnostics: SchemaDiagnostic[] = [],
  ): PreviewPanel {
    if (PreviewPanel.current) {
      PreviewPanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
      PreviewPanel.current.setSchema(schema, source, diagnostics);
      return PreviewPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      "dbschema.preview",
      "DBSchema Preview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
      },
    );
    PreviewPanel.current = new PreviewPanel(context, panel);
    PreviewPanel.current.setSchema(schema, source, diagnostics);
    return PreviewPanel.current;
  }

  static get active(): PreviewPanel | undefined {
    return PreviewPanel.current;
  }

  /** 工具列按了「匯出」：由 extension.ts 註冊成跟 `DBSchema: Export…` 指令同一個動作。 */
  static onExportRequested: (() => void) | undefined;
  /** 工具列按了「比較…」：對應 `DBSchema: Compare with Git…` 指令。 */
  static onCompareRequested: (() => void) | undefined;

  private nextImageRequestId = 1;
  private readonly imageRequests = new Map<number, { resolve: (dataUrl: string) => void; reject: (error: Error) => void }>();

  /** Webview 還沒 ready 前送的訊息；schema 只留最後一則，其他（例如比較）依序保留。 */
  private pending: ExtensionToWebview[] = [];
  private ready = false;
  private source: vscode.Uri | undefined;
  /** 目前畫面上的 Schema；Preview → Source 需要它的 SourceLocation。 */
  private schema: Schema | null = null;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
  ) {
    panel.webview.html = this.buildHtml();
    panel.onDidDispose(() => {
      PreviewPanel.current = undefined;
      for (const request of this.imageRequests.values()) request.reject(new Error("Preview closed"));
      this.imageRequests.clear();
    });
    panel.webview.onDidReceiveMessage((message: WebviewToExtension) => this.onMessage(message));
  }

  setSchema(schema: Schema, source: vscode.Uri | undefined, diagnostics: SchemaDiagnostic[]): void {
    this.source = source;
    this.schema = schema;
    const label = source ? basename(source.fsPath) : "Synthetic Schema";
    this.panel.title = `DBSchema — ${label}`;
    this.post({ type: "schema", schema, diagnostics, label });
  }

  /**
   * 來源檔案編輯、存檔或在磁碟上被改寫後重繪（plan §39）。
   * 只有正在預覽的那一份檔案會觸發，避免切到別的檔案時畫面被蓋掉。
   *
   * 同一個檔案的更新保留使用者目前的視角。`fromDisk`（agent 直接寫檔等外部修改）時另外算出差異：
   * Preview 短暫標出改了哪些表／欄位，狀態列顯示摘要——agent 一次改很多地方時才看得出改了什麼。
   */
  updateIfSameDocument(uri: vscode.Uri, schema: Schema, diagnostics: SchemaDiagnostic[], fromDisk = false): void {
    if (!this.source || this.source.toString() !== uri.toString()) return;
    const previous = this.schema;
    this.schema = schema;
    const changes = fromDisk && previous ? diffSchemas(previous, schema) : undefined;
    const label = basename(uri.fsPath);
    this.post({
      type: "schema",
      schema,
      diagnostics,
      label,
      preserveView: true,
      ...(changes && hasChanges(changes) ? { changes } : {}),
    });
    if (changes && hasChanges(changes)) {
      vscode.window.setStatusBarMessage(
        t().schemaChanged(label, {
          added: changes.addedTables.length,
          removed: changes.removedTables.length,
          changed: changes.changedTables.length,
          relations: changes.addedRelations.length + changes.removedRelations.length,
        }),
        8000,
      );
    }
  }

  /** 把目前語系推給 Webview（開啟時與設定變更時）。 */
  /** 正在預覽的 Schema 跟它的來源檔（合成的壓測 Schema 沒有來源檔）。 */
  get current(): { schema: Schema; source: vscode.Uri | undefined } | undefined {
    return this.schema ? { schema: this.schema, source: this.source } : undefined;
  }

  /** 請 Webview 把目前的畫布輸出成圖片（data URL）。 */
  requestImage(format: ImageFormat): Promise<string> {
    const requestId = this.nextImageRequestId++;
    return new Promise((resolve, reject) => {
      this.imageRequests.set(requestId, { resolve, reject });
      void this.panel.webview.postMessage({ type: "exportImage", requestId, format } satisfies ExtensionToWebview);
    });
  }

  pushLocale(): void {
    void this.panel.webview.postMessage({ type: "locale", locale: currentLocale() } satisfies ExtensionToWebview);
  }

  run(command: "fitView" | "resetFocus"): void {
    this.post({ type: "command", command });
  }

  /** 進入比較模式：跟 base（git 裡的舊版本）比。之後檔案更新時 Webview 會自己重新比較。 */
  startCompare(base: Schema, baseLabel: string): void {
    this.post({ type: "compare", base, baseLabel });
  }

  private post(message: ExtensionToWebview): void {
    // Webview 尚未 ready 時先排隊，避免開啟瞬間丟訊息。
    if (!this.ready) {
      if (message.type === "schema") this.pending = this.pending.filter((m) => m.type !== "schema");
      this.pending.push(message);
      return;
    }
    void this.panel.webview.postMessage(message);
  }

  private onMessage(message: WebviewToExtension): void {
    switch (message.type) {
      case "ready": {
        this.ready = true;
        // 語系要先於 schema 送達，Toolbar 才不會先閃一次預設語言。
        this.pushLocale();
        for (const message of this.pending) void this.panel.webview.postMessage(message);
        this.pending = [];
        return;
      }
      case "setLocale": {
        // 寫進 Global 設定：使用者換語言是偏好，不該只對當前工作區生效。
        void vscode.workspace
          .getConfiguration("dbschema")
          .update("language", message.locale, vscode.ConfigurationTarget.Global);
        return;
      }
      case "openSource": {
        void this.openSource(message.tableId, message.column);
        return;
      }
      case "requestExport": {
        PreviewPanel.onExportRequested?.();
        return;
      }
      case "requestCompare": {
        PreviewPanel.onCompareRequested?.();
        return;
      }
      case "imageExported":
      case "imageExportFailed": {
        const request = this.imageRequests.get(message.requestId);
        this.imageRequests.delete(message.requestId);
        if (!request) return;
        if (message.type === "imageExported") request.resolve(message.dataUrl);
        else request.reject(new Error(message.message));
        return;
      }
      case "metrics": {
        console.log(
          `[dbschema] ${message.tableCount} tables / ${message.relationCount} relations, ` +
            `layout ${message.layoutMs.toFixed(1)}ms`,
        );
        return;
      }
    }
  }

  /**
   * Preview → Source（US9 / AC-17）。
   *
   * 這是 VS Code Extension 相對於一般 Web Viewer 的核心價值，
   * 所以找不到精確欄位時也要盡量跳到 Table 定義，而不是無聲失敗。
   */
  private async openSource(tableId: string, column?: string): Promise<void> {
    if (!this.source || !this.schema) {
      void vscode.window.showWarningMessage(t().noSourceForPreview);
      return;
    }

    const location = findSourceLocation(this.schema, { tableId, column });
    if (!location) {
      void vscode.window.showWarningMessage(t().definitionNotFound(column ? `${tableId}.${column}` : tableId));
      return;
    }

    const document = await vscode.workspace.openTextDocument(this.source);
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });

    // SourceLocation 是 1-based，VS Code 是 0-based。
    const startLine = Math.max(0, location.line - 1);
    const startColumn = Math.max(0, location.column - 1);
    const endLine = Math.max(startLine, (location.endLine ?? location.line) - 1);
    const endColumn = Math.max(startColumn, (location.endColumn ?? location.column) - 1);
    const range = new vscode.Range(startLine, startColumn, endLine, endColumn);

    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  private buildHtml(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview.js"),
    );
    const nonce = createNonce();
    return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DBSchema Preview</title>
<style>
  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
  #app { position: absolute; inset: 0; }
</style>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function hasChanges(diff: SchemaDiff): boolean {
  return (
    diff.addedTables.length + diff.removedTables.length + diff.changedTables.length +
      diff.addedRelations.length + diff.removedRelations.length >
    0
  );
}

function basename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() ?? fsPath;
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
