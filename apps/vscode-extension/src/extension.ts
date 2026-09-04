import * as vscode from "vscode";
import { FIXTURE_SIZES, generateSchema } from "@schemalens/schema-fixtures";
import {
  DBSCHEMA_LANGUAGE_ID,
  DiagnosticsProvider,
  loadDocumentSchema,
} from "./diagnostics/DiagnosticsProvider.js";
import { PreviewPanel } from "./preview/PreviewPanel.js";

function activeDbschemaDocument(): vscode.TextDocument | undefined {
  const document = vscode.window.activeTextEditor?.document;
  return document?.languageId === DBSCHEMA_LANGUAGE_ID ? document : undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  // 存檔或編輯後重新驗證；若該檔案正開著 Preview，順便重繪（plan §39）。
  const diagnostics = new DiagnosticsProvider((document, result) => {
    PreviewPanel.active?.updateIfSameDocument(document.uri, result.schema, result.diagnostics);
  });
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(
    vscode.commands.registerCommand("dbschema.openPreview", () => {
      const document = activeDbschemaDocument();
      if (!document) {
        void vscode.window.showWarningMessage("請先開啟一個 .dbschema 檔案");
        return;
      }
      const result = loadDocumentSchema(document);
      PreviewPanel.show(context, result.schema, document.uri, result.diagnostics);
    }),

    vscode.commands.registerCommand("dbschema.validateSchema", () => {
      const document = activeDbschemaDocument();
      if (!document) {
        void vscode.window.showWarningMessage("請先開啟一個 .dbschema 檔案");
        return;
      }
      const result = diagnostics.refresh(document);
      const count = result?.diagnostics.length ?? 0;
      void vscode.window.showInformationMessage(
        count === 0
          ? `Schema 驗證通過：${result?.schema.tables.length ?? 0} 張 Table`
          : `Schema 有 ${count} 個問題，詳見 Problems Panel`,
      );
    }),

    vscode.commands.registerCommand("dbschema.fitView", () => {
      PreviewPanel.active?.run("fitView");
    }),

    vscode.commands.registerCommand("dbschema.resetFocus", () => {
      PreviewPanel.active?.run("resetFocus");
    }),

    // Stage 0 的壓測入口保留下來：改動 Renderer 時可以立刻用 100 / 200 張表回歸。
    vscode.commands.registerCommand("dbschema.openSpikePreview", async () => {
      const picked = await vscode.window.showQuickPick(
        FIXTURE_SIZES.map((size) => ({
          label: `${size} Tables`,
          description: size === 100 ? "MVP 必須可用" : size === 200 ? "Stress Test" : undefined,
          size,
        })),
        { title: "DBSchema Spike — 選擇 Schema 規模" },
      );
      if (!picked) return;
      PreviewPanel.show(context, generateSchema({ tableCount: picked.size }), undefined, []);
    }),
  );
}

export function deactivate(): void {
  // Panel 會隨 webview dispose 自行清理。
}
