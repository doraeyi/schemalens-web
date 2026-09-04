import * as vscode from "vscode";
import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import { currentLocale, t } from "../i18n.js";
import type { ExtensionToWebview, WebviewToExtension } from "./protocol.js";
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

  private pending: ExtensionToWebview | null = null;
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
   * 來源檔案存檔／編輯後重繪（plan §39）。
   * 只有正在預覽的那一份檔案會觸發，避免切到別的檔案時畫面被蓋掉。
   */
  updateIfSameDocument(uri: vscode.Uri, schema: Schema, diagnostics: SchemaDiagnostic[]): void {
    if (!this.source || this.source.toString() !== uri.toString()) return;
    this.schema = schema;
    this.post({ type: "schema", schema, diagnostics, label: basename(uri.fsPath) });
  }

  /** 把目前語系推給 Webview（開啟時與設定變更時）。 */
  pushLocale(): void {
    void this.panel.webview.postMessage({ type: "locale", locale: currentLocale() } satisfies ExtensionToWebview);
  }

  run(command: "fitView" | "resetFocus"): void {
    this.post({ type: "command", command });
  }

  private post(message: ExtensionToWebview): void {
    // Webview 尚未 ready 時先留住最後一則 schema，避免開啟瞬間丟訊息。
    if (!this.ready && message.type === "schema") {
      this.pending = message;
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
        if (this.pending) {
          void this.panel.webview.postMessage(this.pending);
          this.pending = null;
        }
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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

function basename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() ?? fsPath;
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
