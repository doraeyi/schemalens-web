import * as vscode from "vscode";
import type { Schema } from "@schemalens/schema-core";
import { toDsl, toJson } from "@schemalens/schema-serializer";
import { SQL_DIALECTS, type SqlDialectId } from "@schemalens/schema-sql";
import { renderSchemaAsSql } from "@schemalens/schema-sql/export";
import { t } from "../i18n.js";
import { PreviewPanel } from "../preview/PreviewPanel.js";
import type { ImageFormat } from "../preview/protocol.js";
import { isSupportedSchemaFile, loadSchemaFromDocument, loadSchemaFromText } from "../schema/documentSchema.js";

/**
 * 匯出／匯入：跟網頁版同一套轉換（@schemalens/schema-sql、schema-serializer），
 * 差別只在網頁版是下載／剪貼簿，這裡是 VS Code 的存檔對話框、寫進 workspace。
 */

export type ExportTarget = { kind: "sql"; dialect: SqlDialectId } | { kind: "dsl" } | { kind: "json" } | { kind: "image"; format: ImageFormat };

interface SchemaSource {
  schema: Schema;
  /** 來源檔；合成的壓測 Schema 沒有。決定存檔對話框預設的資料夾跟檔名。 */
  source: vscode.Uri | undefined;
}

const LAST_DIALECT_KEY = "dbschema.lastSqlDialect";

/** 優先用正在預覽的那份；沒開 Preview 就用目前編輯器裡的 schema 檔。 */
function currentSchema(): SchemaSource | undefined {
  const previewed = PreviewPanel.active?.current;
  if (previewed) return previewed;
  const document = vscode.window.activeTextEditor?.document;
  if (!document || !(document.languageId === "dbschema" || isSupportedSchemaFile(document.uri.fsPath))) return undefined;
  return { schema: loadSchemaFromDocument(document).schema, source: document.uri };
}

/** `orders.dbschema` → `orders` + 新副檔名，放在同一個資料夾。 */
export function siblingUri(source: vscode.Uri | undefined, suffix: string): vscode.Uri | undefined {
  if (!source) {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    return folder ? vscode.Uri.joinPath(folder, `schema${suffix}`) : undefined;
  }
  const base = source.fsPath.replace(/\.(dbschema|schema\.json|schema\.md|sql)$/i, "");
  return vscode.Uri.file(`${base}${suffix}`);
}

async function saveFile(
  defaultUri: vscode.Uri | undefined,
  filters: Record<string, string[]>,
  content: Uint8Array,
  openAfterSave: boolean,
): Promise<vscode.Uri | undefined> {
  const target = await vscode.window.showSaveDialog({ defaultUri, filters });
  if (!target) return undefined;
  await vscode.workspace.fs.writeFile(target, content);
  if (openAfterSave) {
    const document = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(document, { preview: false });
  }
  void vscode.window.showInformationMessage(t().savedTo(target.fsPath));
  return target;
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** html-to-image 給的 data URL：PNG 是 base64，SVG 是 URL-encoded 的文字。 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (header.endsWith(";base64")) return Uint8Array.from(Buffer.from(payload, "base64"));
  return utf8(decodeURIComponent(payload));
}

export async function pickSqlDialect(context: vscode.ExtensionContext): Promise<SqlDialectId | undefined> {
  const last = context.globalState.get<SqlDialectId>(LAST_DIALECT_KEY);
  const items = [...SQL_DIALECTS]
    .sort((a, b) => Number(b.id === last) - Number(a.id === last))
    .map((dialect) => ({ label: dialect.label, id: dialect.id }));
  const picked = await vscode.window.showQuickPick(items, { title: t().sqlDialectPickerTitle });
  if (picked) await context.globalState.update(LAST_DIALECT_KEY, picked.id);
  return picked?.id;
}

export async function exportAs(target: ExportTarget): Promise<vscode.Uri | undefined> {
  const current = currentSchema();
  if (!current) {
    void vscode.window.showWarningMessage(t().openSchemaFileFirst);
    return undefined;
  }
  const { schema, source } = current;

  switch (target.kind) {
    case "sql":
      return saveFile(siblingUri(source, `.${target.dialect}.sql`), { SQL: ["sql"] }, utf8(renderSchemaAsSql(schema, target.dialect)), true);
    case "dsl":
      return saveFile(siblingUri(source, ".dbschema"), { DBSchema: ["dbschema"] }, utf8(toDsl(schema)), true);
    case "json":
      return saveFile(siblingUri(source, ".schema.json"), { JSON: ["json"] }, utf8(toJson(schema)), true);
    case "image": {
      const preview = PreviewPanel.active;
      if (!preview) {
        void vscode.window.showWarningMessage(t().exportImageNeedsPreview);
        return undefined;
      }
      let dataUrl: string;
      try {
        dataUrl = await preview.requestImage(target.format);
      } catch (error) {
        void vscode.window.showErrorMessage(t().exportImageFailed(error instanceof Error ? error.message : String(error)));
        return undefined;
      }
      const filters: Record<string, string[]> = target.format === "png" ? { PNG: ["png"] } : { SVG: ["svg"] };
      return saveFile(siblingUri(source, `.${target.format}`), filters, dataUrlToBytes(dataUrl), false);
    }
  }
}

/** Preview 工具列的「匯出…」跟 `DBSchema: Export…` 指令：一個選單列出所有格式。 */
export async function showExportMenu(): Promise<vscode.Uri | undefined> {
  const items: Array<{ label: string; description?: string; target: ExportTarget }> = [
    ...SQL_DIALECTS.map((dialect) => ({
      label: `SQL — ${dialect.label}`,
      description: "CREATE TABLE",
      target: { kind: "sql", dialect: dialect.id } as ExportTarget,
    })),
    { label: "DSL", description: ".dbschema", target: { kind: "dsl" } },
    { label: "JSON", description: ".schema.json", target: { kind: "json" } },
    { label: "PNG", target: { kind: "image", format: "png" } },
    { label: "SVG", target: { kind: "image", format: "svg" } },
  ];
  const picked = await vscode.window.showQuickPick(items, { title: t().exportPickerTitle });
  return picked ? exportAs(picked.target) : undefined;
}

async function readText(uri: vscode.Uri): Promise<string> {
  const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
  if (open) return open.getText();
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
}

/**
 * SQL DDL（CREATE TABLE…）→ `.dbschema`，跟網頁版「匯入 SQL」同一套解析。
 * 來源依序：檔案總管右鍵傳進來的檔、目前開著的 .sql 檔、再不然跳出選檔對話框。
 */
export async function importSql(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
  let source = uri;
  if (!source) {
    const active = vscode.window.activeTextEditor?.document;
    if (active && (active.languageId === "sql" || /\.sql$/i.test(active.uri.fsPath))) source = active.uri;
  }
  if (!source) {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { SQL: ["sql"] },
      title: t().importSqlPickFile,
    });
    source = picked?.[0];
  }
  if (!source) return undefined;

  const dialect = await pickSqlDialect(context);
  if (!dialect) return undefined;

  // SQL 解析器（node-sql-parser）很大，打包成獨立的 out/sql-import.cjs，要匯入時才載入，
  // 不拖慢插件啟動（見 scripts/build.mjs）。
  const { parseSql } = await import("@schemalens/schema-sql/import");
  const result = await parseSql(await readText(source), dialect, source.fsPath);
  if (result.schema.tables.length === 0) {
    void vscode.window.showErrorMessage(t().importSqlNothingFound(result.diagnostics[0]?.message ?? "—"));
    return undefined;
  }

  const dsl = toDsl(result.schema);
  const target = await saveFile(siblingUri(source, ".dbschema"), { DBSchema: ["dbschema"] }, utf8(dsl), true);
  if (!target) return undefined;
  // 重新解析剛寫出去的 DSL（而不是直接用 SQL 解析的結果），Preview 雙擊跳回原始碼才對得到 .dbschema 的行號。
  const loaded = loadSchemaFromText(dsl, target.fsPath);
  PreviewPanel.show(context, loaded.schema, target, loaded.diagnostics);
  void vscode.window.showInformationMessage(t().importSqlDone(result.schema.tables.length, result.diagnostics.length));
  return target;
}
