import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import type { Locale } from "@schemalens/schema-renderer";

/**
 * Extension ⇄ Webview 的訊息契約。
 *
 * 刻意只傳 Schema Domain Model 與純資料指令：Webview 端不知道 VS Code，
 * Extension 端不知道 DOM（約束 #6）。
 */
export type ExtensionToWebview =
  | { type: "schema"; schema: Schema; diagnostics: SchemaDiagnostic[]; label: string }
  /** 介面語系；Extension 端依 `dbschema.language` 設定決定後推給 Webview。 */
  | { type: "locale"; locale: Locale }
  | { type: "diagnostics"; diagnostics: SchemaDiagnostic[] }
  | { type: "command"; command: "fitView" | "resetFocus" };

export type WebviewToExtension =
  /** US9：Preview → Source。Extension 端依 Schema 的 SourceLocation 跳轉。 */
  | { type: "openSource"; tableId: string; column?: string }
  | { type: "ready" }
  /** Toolbar 上的語系切換：由 Extension 寫回 dbschema.language 設定。 */
  | { type: "setLocale"; locale: Locale }
  | { type: "metrics"; tableCount: number; relationCount: number; layoutMs: number; renderMs: number };
