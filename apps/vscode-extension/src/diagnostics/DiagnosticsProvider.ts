import * as vscode from "vscode";
import type { Schema, SchemaDiagnostic } from "@schemalens/schema-core";
import { isSupportedSchemaFile, loadSchemaFromText } from "../schema/documentSchema.js";

export const DBSCHEMA_LANGUAGE_ID = "dbschema";

export interface DocumentSchema {
  schema: Schema;
  diagnostics: SchemaDiagnostic[];
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
export function toVsCodeDiagnostic(diagnostic: SchemaDiagnostic): vscode.Diagnostic {
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
 * 把 DSL 錯誤送進 Editor 的紅色波浪線與 Problems Panel（AC-04）。
 * 點 Problems 項目後的 Jump to Source 由 VS Code 依 Range 自行處理。
 */
export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("dbschema");
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly onSchemaChanged?: (document: vscode.TextDocument, result: DocumentSchema) => void) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => this.refresh(document)),
      vscode.workspace.onDidSaveTextDocument((document) => this.refresh(document)),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.collection.delete(document.uri);
        this.timers.delete(document.uri.toString());
      }),
      // 邊打字邊驗證，但 debounce 以免大型檔案每個按鍵都重跑一次解析。
      vscode.workspace.onDidChangeTextDocument((event) => this.scheduleRefresh(event.document)),
    );

    for (const document of vscode.workspace.textDocuments) this.refresh(document);
  }

  refresh(document: vscode.TextDocument): DocumentSchema | undefined {
    if (!isDiagnosableDocument(document)) return undefined;
    const result = loadDocumentSchema(document);
    this.collection.set(document.uri, result.diagnostics.map(toVsCodeDiagnostic));
    this.onSchemaChanged?.(document, result);
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
