import * as vscode from "vscode";
import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import type { ExtensionToWebview, WebviewToExtension } from "./protocol.js";

/**
 * DBSchema 專屬 Preview（約束 #13：不為了 Markdown Preview 犧牲這裡的能力）。
 * 單一 panel 重用，避免使用者開出一堆重複視窗。
 */
export class PreviewPanel {
  private static current: PreviewPanel | undefined;

  static show(context: vscode.ExtensionContext, schema: Schema, label: string, diagnostics: SchemaDiagnostic[] = []): PreviewPanel {
    if (PreviewPanel.current) {
      PreviewPanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
      PreviewPanel.current.setSchema(schema, label, diagnostics);
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
    PreviewPanel.current.setSchema(schema, label, diagnostics);
    return PreviewPanel.current;
  }

  static get active(): PreviewPanel | undefined {
    return PreviewPanel.current;
  }

  private pending: ExtensionToWebview | null = null;
  private ready = false;

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

  setSchema(schema: Schema, label: string, diagnostics: SchemaDiagnostic[]): void {
    this.post({ type: "schema", schema, diagnostics, label });
  }

  setDiagnostics(diagnostics: SchemaDiagnostic[]): void {
    this.post({ type: "diagnostics", diagnostics });
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
        if (this.pending) {
          void this.panel.webview.postMessage(this.pending);
          this.pending = null;
        }
        return;
      }
      case "openSource": {
        // Stage 0 尚無 DSL Parser / SourceLocation，先讓使用者看到目標，
        // Stage 9 會換成真正的 Jump to Definition。
        const target = message.column ? `${message.tableId}.${message.column}` : message.tableId;
        void vscode.window.showInformationMessage(`Open Source: ${target}（Stage 9 接上 DSL 位置）`);
        return;
      }
      case "metrics": {
        this.panel.title = `DBSchema Preview — ${message.tableCount} tables / ${message.relationCount} relations`;
        console.log(
          `[dbschema] layout ${message.layoutMs.toFixed(1)}ms, render ${message.renderMs.toFixed(1)}ms`,
        );
        return;
      }
    }
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

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
