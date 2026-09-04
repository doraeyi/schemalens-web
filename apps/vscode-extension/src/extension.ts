import * as vscode from "vscode";
import { FIXTURE_SIZES, generateSchema } from "@schemalens/schema-fixtures";
import { PreviewPanel } from "./preview/PreviewPanel.js";

/**
 * Stage 0 — Technical Spike。
 *
 * 這個階段只驗證「大型 Schema Viewer 在 VS Code Webview 裡跑不跑得動」，
 * 因此 Preview 的資料來源是合成 Schema，不是 DSL（約束 #11）。
 * Parser / Diagnostics 會在 Stage 3、4 接進同一個 PreviewPanel。
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
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

      const schema = generateSchema({ tableCount: picked.size });
      PreviewPanel.show(context, schema, `Synthetic ${picked.size} Tables`);
    }),

    vscode.commands.registerCommand("dbschema.fitView", () => {
      PreviewPanel.active?.run("fitView");
    }),

    vscode.commands.registerCommand("dbschema.resetFocus", () => {
      PreviewPanel.active?.run("resetFocus");
    }),
  );
}

export function deactivate(): void {
  // Panel 會隨 webview dispose 自行清理。
}
