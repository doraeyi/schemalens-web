import * as vscode from "vscode";
import { resolveLocale, type Locale } from "@schemalens/schema-renderer";

export type LanguageSetting = "auto" | "en" | "zh-hant";

export interface ExtensionStrings {
  openSchemaFileFirst: string;
  openDbschemaFileFirst: string;
  exported: (tables: number, path: string) => string;
  validationPassed: (tables: number) => string;
  validationFailed: (issues: number) => string;
  /** 檔案被外部改寫後，狀態列顯示的變更摘要。 */
  schemaChanged: (file: string, changes: { added: number; removed: number; changed: number; relations: number }) => string;
  noSourceForPreview: string;
  exportPickerTitle: string;
  exportImageNeedsPreview: string;
  exportImageFailed: (message: string) => string;
  savedTo: (path: string) => string;
  sqlDialectPickerTitle: string;
  importSqlPickFile: string;
  importSqlNothingFound: (detail: string) => string;
  importSqlDone: (tables: number, skipped: number) => string;
  definitionNotFound: (target: string) => string;
  spikePickerTitle: string;
  spikeSizeLabel: (size: number) => string;
  spikeRequired: string;
  spikeStress: string;
}

const en: ExtensionStrings = {
  openSchemaFileFirst: "Open a .dbschema, *.schema.md or *.schema.json file first",
  openDbschemaFileFirst: "Open a .dbschema file first",
  exported: (tables, path) => `Exported ${tables} tables to ${path}`,
  validationPassed: (tables) => `Schema is valid: ${tables} tables`,
  validationFailed: (issues) => `Schema has ${issues} issues — see the Problems panel`,
  schemaChanged: (file, c) =>
    `DBSchema: ${file} updated — ${[
      c.added && `+${c.added} tables`,
      c.removed && `-${c.removed} tables`,
      c.changed && `~${c.changed} tables`,
      c.relations && `${c.relations} relation changes`,
    ]
      .filter(Boolean)
      .join(", ")}`,
  noSourceForPreview: "This preview has no source file (synthetic schema)",
  exportPickerTitle: "DBSchema — export as",
  exportImageNeedsPreview: "Open the DBSchema preview first — the image is taken from it",
  exportImageFailed: (message) => `Could not render the image: ${message}`,
  savedTo: (path) => `Saved ${path}`,
  sqlDialectPickerTitle: "Which SQL dialect?",
  importSqlPickFile: "Choose a .sql file to import",
  importSqlNothingFound: (detail) => `No CREATE TABLE statements could be read: ${detail}`,
  importSqlDone: (tables, skipped) =>
    `Imported ${tables} tables${skipped > 0 ? ` (${skipped} statements could not be parsed and were skipped)` : ""}`,
  definitionNotFound: (target) => `Could not find the definition of ${target}`,
  spikePickerTitle: "DBSchema Spike — choose a schema size",
  spikeSizeLabel: (size) => `${size} Tables`,
  spikeRequired: "Must stay usable for the MVP",
  spikeStress: "Stress test",
};

const zhHant: ExtensionStrings = {
  openSchemaFileFirst: "請先開啟 .dbschema、*.schema.md 或 *.schema.json 檔案",
  openDbschemaFileFirst: "請先開啟一個 .dbschema 檔案",
  exported: (tables, path) => `已匯出 ${tables} 張 Table 到 ${path}`,
  validationPassed: (tables) => `Schema 驗證通過：${tables} 張 Table`,
  validationFailed: (issues) => `Schema 有 ${issues} 個問題，詳見 Problems Panel`,
  schemaChanged: (file, c) =>
    `DBSchema：${file} 已更新——${[
      c.added && `新增 ${c.added} 張表`,
      c.removed && `刪除 ${c.removed} 張表`,
      c.changed && `修改 ${c.changed} 張表`,
      c.relations && `${c.relations} 個關聯變動`,
    ]
      .filter(Boolean)
      .join("、")}`,
  noSourceForPreview: "目前的 Preview 沒有對應的原始檔（合成 Schema）",
  exportPickerTitle: "DBSchema — 匯出成",
  exportImageNeedsPreview: "請先開啟 DBSchema Preview——圖片是從 Preview 畫面輸出的",
  exportImageFailed: (message) => `圖片輸出失敗：${message}`,
  savedTo: (path) => `已儲存 ${path}`,
  sqlDialectPickerTitle: "SQL 是哪一種方言？",
  importSqlPickFile: "選擇要匯入的 .sql 檔",
  importSqlNothingFound: (detail) => `讀不到任何 CREATE TABLE：${detail}`,
  importSqlDone: (tables, skipped) =>
    `已匯入 ${tables} 張表${skipped > 0 ? `（${skipped} 個敘述無法解析，已略過）` : ""}`,
  definitionNotFound: (target) => `找不到 ${target} 的定義位置`,
  spikePickerTitle: "DBSchema Spike — 選擇 Schema 規模",
  spikeSizeLabel: (size) => `${size} 張 Table`,
  spikeRequired: "MVP 必須可用",
  spikeStress: "壓力測試",
};

const STRINGS: Record<Locale, ExtensionStrings> = { en, "zh-hant": zhHant };

/**
 * 決定目前語系。
 *
 * `auto`（預設）跟隨 VS Code 的顯示語言，因此使用者不必設定就會拿到合理結果；
 * 明確指定 `en` / `zh-hant` 則覆寫之。
 */
export function currentLocale(): Locale {
  const setting = vscode.workspace
    .getConfiguration("dbschema")
    .get<LanguageSetting>("language", "auto");

  if (setting === "en" || setting === "zh-hant") return setting;
  return resolveLocale(vscode.env.language);
}

export function t(): ExtensionStrings {
  return STRINGS[currentLocale()];
}
