import * as vscode from "vscode";
import { resolveLocale, type Locale } from "@schemalens/schema-renderer";

export type LanguageSetting = "auto" | "en" | "zh-hant";

export interface ExtensionStrings {
  openSchemaFileFirst: string;
  openDbschemaFileFirst: string;
  exported: (tables: number, path: string) => string;
  validationPassed: (tables: number) => string;
  validationFailed: (issues: number) => string;
  noSourceForPreview: string;
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
  noSourceForPreview: "This preview has no source file (synthetic schema)",
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
  noSourceForPreview: "目前的 Preview 沒有對應的原始檔（合成 Schema）",
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
