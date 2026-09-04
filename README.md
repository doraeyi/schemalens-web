# SchemaLens / DBSchema

VS Code 的 Database Schema Visualization Extension。

> Mermaid-like Schema DSL + drawDB-like Interactive Visualizer + Large Schema Exploration

在 VS Code 裡寫 `.dbschema`，即時驗證，開 Preview 直接看到完整的 Table / Column / Type /
欄位級 Relation；就算有 100 張表，也能快速找到某張表並理解它的欄位與關聯。

## 快速開始

```bash
npm install
npm run build -w dbschema-vscode
```

在 VS Code 按 `F5`（Run DBSchema Extension），於新視窗開啟 [examples/blog.dbschema](examples/blog.dbschema)，
按右上角的圖示或執行 `DBSchema: Open Preview`。

## DSL

```text
table Users "系統使用者" {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
}

table Posts "文章" {
  PK Id       bigint        not null
  FK AuthorId bigint        not null
     Title    nvarchar(200) not null
}

index IX_Posts_Author on Posts(AuthorId)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
```

完整語法見 `docs/dsl-spec.md`。

## 支援的輸入

| 檔案 | 說明 |
|---|---|
| `*.dbschema` | 第一優先。語法高亮、括號比對、縮排、即時診斷 |
| `*.schema.md` | Markdown 內的 ` ```dbschema ` 區塊，可跨多個區塊組成一份 Schema |
| `*.schema.json` | JSON Import；`DBSchema: Export JSON` 的輸出格式 |

## 命令

| 命令 | 說明 |
|---|---|
| `DBSchema: Open Preview` | 開啟互動式 Preview |
| `DBSchema: Validate Schema` | 驗證並回報問題數 |
| `DBSchema: Export JSON` | 匯出 `<name>.schema.json` |
| `DBSchema: Fit View` / `Reset Focus` | 視圖控制 |
| `DBSchema: Open Spike Preview` | 用 20 / 50 / 100 / 200 張合成表壓測 Viewer |

## Preview 操作

| 操作 | 行為 |
|---|---|
| 拖曳背景 | Pan |
| `Ctrl` / `Cmd` + 滾輪 | Zoom |
| 滾輪 | 平移 |
| 單擊 Table | Focus：相關表 active、其餘 dim 或 hide |
| 雙擊 Table / Column | 跳回 DSL 定義並選取該行 |
| `Ctrl` / `Cmd` + `F` | 搜尋 Table / Column |
| `Esc` | Reset Focus |
| 卡片標題的 ▾ | Collapse / Expand |

Toolbar：View（Overview / Keys / **Full**，預設 Full）、Depth（All / 1-Hop / 2-Hop）、
Direction（All / Upstream / Downstream）、Unrelated（Dim / Hide）。

## 架構

```
apps/vscode-extension     Commands、Diagnostics、Preview Panel、Language
packages/schema-core      Domain Model、Validator、Error Model（不依賴 VS Code）
packages/schema-parser    Lexer / Parser / AST → Schema、Markdown 區塊
packages/schema-graph     Traversal（1/2-Hop、Upstream/Downstream）、Search
packages/schema-layout    LayoutEngine 介面 + layered layout + 欄位級 edge routing
packages/schema-renderer  Table Card、Relation Edge、Focus/Dim/Hide、Zoom/Pan
packages/schema-serializer JSON ⇄ Schema ⇄ DSL
packages/schema-fixtures  合成 Schema（Spike 與壓測用）
```

依賴方向單向向下。`schema-core` 不依賴 VS Code、Webview、Layout 或 Renderer；
Graph Traversal 獨立於 Renderer；Layout Engine 可整顆替換。

## 開發

```bash
npm test          # 182 個單元 / DOM / round-trip 測試
npm run typecheck
npm run build -w dbschema-vscode
npm run watch -w dbschema-vscode
```

執行計畫與各 Stage 狀態見 `docs/execution-matrix.md`（`docs/` 不進版控）。

## Git Flow

`main` ← `develop` ← `feature/*`。一個功能一個分支，完成即合併回 `develop`。
