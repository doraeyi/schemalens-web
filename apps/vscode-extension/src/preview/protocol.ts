import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";

/**
 * Extension ⇄ Webview 的訊息契約。
 *
 * 刻意只傳 Schema Domain Model 與純資料指令：Webview 端不知道 VS Code，
 * Extension 端不知道 DOM（約束 #6）。
 */
export type ExtensionToWebview =
  | { type: "schema"; schema: Schema; diagnostics: SchemaDiagnostic[]; label: string }
  | { type: "diagnostics"; diagnostics: SchemaDiagnostic[] }
  | { type: "command"; command: "fitView" | "resetFocus" };

export type WebviewToExtension =
  /** US9：Preview → Source。Stage 0 尚無 parser，location 由後續 stage 補上。 */
  | { type: "openSource"; tableId: string; column?: string }
  | { type: "ready" }
  | { type: "metrics"; tableCount: number; relationCount: number; layoutMs: number; renderMs: number };
