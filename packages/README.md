# Shared packages

VS Code 插件（`apps/vscode-extension`）跟網頁版（`apps/web`）共用的核心邏輯。都不依賴 VS Code、
Svelte 或瀏覽器 API（`schema-renderer` 例外，它操作 DOM，但兩邊都是在瀏覽器環境——網頁跟
VS Code Webview——裡跑）。

**這個 repo 就是唯一的來源。** 這些套件最早是 2026-09-05 從 `schemaLen` 手動複製過來的，
2026-09-09 把插件併進這個 monorepo 之後，`schemaLen` 就不再維護，直接改這裡。

新功能只要跟畫面無關（解析、檢查、比較、轉換格式），就放在這裡而不是某一個 app 裡，
插件跟網頁版才會自動有一樣的行為。

| 套件 | 內容 |
| --- | --- |
| `schema-core` | Domain model、驗證 |
| `schema-parser` | DSL → Schema（含 `//` 註解，見 `attachComments.ts`） |
| `schema-serializer` | Schema → DSL / JSON |
| `schema-graph` | 關聯圖、搜尋、上下游追蹤 |
| `schema-layout` | 排版 |
| `schema-renderer` | 畫布（DOM + SVG） |
| `schema-lint` | 最佳實踐檢查（缺 PK、外鍵沒 index、命名不一致…），跟 `schema-core` 的結構驗證分開 |
| `schema-diff` | 兩份 schema 的差異 |
| `schema-sql` | SQL DDL 匯出（`/export`）與匯入（`/import`，會載入 node-sql-parser），分開進入點方便延後載入 |
| `schema-fixtures` | 測試用的假資料產生器 |
