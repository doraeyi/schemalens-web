# SchemaLens / DBSchema

VS Code 的 Database Schema Visualization Extension。

> Mermaid-like Schema DSL + drawDB-like Interactive Visualizer + Large Schema Exploration

在 VS Code 裡寫 `.dbschema`，即時驗證，開 Preview 直接看到完整的 Table / Column / Type /
欄位級 Relation；就算有 100 張表，也能快速找到某張表並理解它的欄位與關聯。

---

## Distribution

**This project is distributed through a private GitHub repository.
You must have repository access before downloading a release.**

DBSchema 目前透過 Private GitHub Repository 發布。
只有具有 Repository 權限的使用者才能下載 Release 中的 VSIX。

本專案**不會**發布到 Visual Studio Marketplace 或 Open VSX，也沒有任何公開下載點。

---

## Installation

### Step 1 — 取得 Repository 存取權

安裝前必須先由 Repository Owner 授權。

Personal Private Repository：

```text
GitHub Repository
→ Settings
→ Collaborators
→ Invite collaborator
```

GitHub Organization：

```text
Organization
→ Teams
→ Repository access
```

建議給 **Read** 權限：足以下載 Release，且無法推送程式碼。

### Step 2 — 接受 GitHub 邀請

受邀者會收到 GitHub 的 Invitation，接受後才能進入 Repository。

### Step 3 — 下載 VSIX

```text
Repository
→ Releases
→ Latest Release
→ dbschema-<version>.vsix
```

Release 頁面：<https://github.com/kaikaizhen/schemaLen/releases/latest>

> 此連結需要 Repository 權限。未登入或未獲授權的使用者無法存取。

### Step 4 — VS Code UI 安裝

```text
VS Code
→ Extensions
→ ...（右上角選單）
→ Install from VSIX...
→ 選擇 dbschema-<version>.vsix
```

### Step 5 — CLI 安裝

```bash
code --install-extension dbschema-<version>.vsix
```

---

## 從原始碼開發

```bash
npm install
npm run build -w dbschema
```

在 VS Code 按 `F5`（Run DBSchema Extension），於新視窗開啟 [examples/blog.dbschema](examples/blog.dbschema)，
按右上角的圖示或執行 `DBSchema: Open Preview`。

範例檔：

| 檔案 | 用途 |
|---|---|
| [examples/blog.dbschema](examples/blog.dbschema) | 5 張表的最小範例，涵蓋 PK / FK / UQ / IDX 與 composite index |
| [examples/design.schema.md](examples/design.schema.md) | Markdown 內嵌，跨多個區塊組成一份 Schema |
| [examples/large-schema.schema.md](examples/large-schema.schema.md) | 150 張表、191 條關聯，用來驗證大型 Schema 的探索體驗（AC-20）。由 `npm run example:large` 產生 |

## DSL

```text
group Identity "使用者與身分"

table Users "系統使用者" in Identity {
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
| 單擊 Table 標題 | Focus：相關表 active、其餘 dim 或 hide |
| 單擊欄位 | 欄位聚焦：只亮該欄位與透過 FK 對應的欄位，其餘欄位變雜訊；再點一次取消 |
| 雙擊 Table / Column | 跳回 DSL 定義並選取該行 |
| `Ctrl` / `Cmd` + `F` | 搜尋 Table / Column |
| `Esc` | Reset Focus |
| 卡片標題的 ▾ | Collapse / Expand |

Toolbar：**View**（Overview / Keys / Full，預設 Full）、**Depth**（All / 1-Hop / 2-Hop）、
**Direction**（All / Upstream / Downstream）、**Unrelated**（Dim / Hide）、
**排版**（依群組 / 依關聯）、**Group**（依功能模組篩選）、**備註**（截斷 / 完整）。

排版有兩種依據：**依群組**把同模組的表聚成一塊並畫出外框，適合理解系統結構；
**依關聯**純粹讓關聯線最短，適合追蹤跨模組的資料流。

關聯線預設畫在卡片**之下**（線太多會蓋住欄位內容），聚焦後才浮到卡片之上——
此時無關的線已經被淡化，剩下的正是要看的。

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
npm run build -w dbschema
npm run package:vsix     # 產出 dist/dbschema-<version>.vsix
npm run watch -w dbschema
```

執行計畫與各 Stage 狀態見 `docs/execution-matrix.md`（`docs/` 不進版控）。
發布流程與權限管理見 [RELEASE.md](RELEASE.md)。

## Git Flow

`main` ← `develop` ← `feature/*`。一個功能一個分支，完成即合併回 `develop`。
Release 由 `main` 打 `v*` tag 觸發，詳見 [RELEASE.md](RELEASE.md)。

## License

見 [LICENSE](LICENSE)。本軟體僅授權給取得 Private Repository 權限的使用者。
