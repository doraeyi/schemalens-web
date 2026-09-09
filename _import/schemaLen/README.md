# SchemaLens / DBSchema

VS Code 的 Database Schema Visualization Extension。

> Mermaid-like Schema DSL + drawDB-like Interactive Visualizer + Large Schema Exploration

在 VS Code 裡寫 `.dbschema`，即時驗證，開 Preview 直接看到完整的 Table / Column / Type /
欄位級 Relation；就算有 100 張表，也能快速找到某張表並理解它的欄位與關聯。

## 能做什麼

- **完整的資料表卡片** — 預設就顯示欄位、型別、PK / FK / UQ / IDX、nullable、預設值與備註，不必再點開細節面板
- **欄位級關聯線** — 線直接連到實際的欄位列，不是只連到表格外框
- **大型 Schema 探索** — 搜尋 Table / Column、1-Hop / 2-Hop、Upstream / Downstream、淡化或隱藏無關的表
- **欄位聚焦** — 點一個欄位，只亮起它與透過 FK 對應的欄位
- **群組分類** — 依功能模組把資料表框在一起，可依群組或依關聯兩種方式排版
- **回跳原始碼** — 雙擊表或欄位跳回 DSL 定義；DSL 錯誤直接顯示在 Problems Panel
- **JSON 匯入 / 匯出** — DSL ⇄ JSON 語意一致的 round trip
- **中文 / 英文介面**

---

## 安裝

擴充套件從本 repository 的 [GitHub Releases](https://github.com/kaikaizhen/schemaLen/releases/latest)
發布，**不經過 Visual Studio Marketplace 與 Open VSX**。三種安裝方式：

| 方式 | 適合 |
|---|---|
| [用 Claude Code 安裝](#用-claude-code-安裝) | 讓 Claude 代為下載、安裝與驗證 |
| [用 Codex 安裝](#用-codex-安裝) | 在 Codex CLI 裡完成同一件事 |
| [直接安裝 VSIX](#直接安裝-vsix) | 不透過任何 agent，自己下載 |

## 用 Claude Code 安裝

本 repository 同時是一個 Claude Code Plugin Marketplace。在 Claude Code 裡加入一次：

```text
/plugin marketplace add kaikaizhen/schemaLen
```

然後安裝外掛：

```text
/plugin install schemalens-vscode-extension@schemalens
```

安裝後**不需要記住任何名稱**。直接描述你的問題就好：

> 「幫我把這個電商後台的資料表和關聯整理出來」
> 「這個資料庫有 150 張表，我想知道改 `Orders` 會影響到誰」
> 「`TenantId` 出現在哪些表？改名前想先確認」

Claude 會認出這類需求屬於本外掛的技能，於是撰寫 `.dbschema`、在需要時安裝擴充套件，
再引導你打開 Preview。也可以手動叫用：

```text
/schemalens-vscode-extension:database-schema-visualization
```

**全程不經過 VS Code Marketplace。**

非互動式的 CLI 等價指令：

```bash
claude plugin marketplace add kaikaizhen/schemaLen
claude plugin install schemalens-vscode-extension@schemalens
```

### 更新與移除

```text
/plugin marketplace update schemalens      # 更新 marketplace 內容
/plugin uninstall schemalens-vscode-extension@schemalens
/plugin install schemalens-vscode-extension@schemalens
```

重新執行安裝技能是安全的：已經是目標版本時它會直接回報並跳過。

移除 VS Code 擴充套件本身（與外掛無關，可獨立執行）：

```bash
code --uninstall-extension kaikaizhen.dbschema
```

### 三種版本號互不相干

| 版本 | 位於 | 何時遞增 |
|---|---|---|
| VS Code Extension | `apps/vscode-extension/package.json` | 擴充套件本身有變更時；決定 Release tag 與 `.vsix` 檔名 |
| Claude / Codex Plugin | `plugins/…/.claude-plugin/plugin.json`、`.codex-plugin/plugin.json` | 外掛或技能有變更時 |
| Marketplace | `.claude-plugin/marketplace.json` 的 `version` | 上架的外掛清單或其中繼資料有變更時 |

外掛**不寫死** `.vsix` 版本：預設安裝最新的 stable release，因此發布新的擴充套件版本時不需要動外掛。

## 用 Codex 安裝

This repository is a Codex plugin marketplace source. In Codex CLI, import it once:

```bash
codex plugin marketplace add kaikaizhen/schemaLen
```

Start a new Codex session, open `/plugins`, select `SchemaLens Plugins`, and install `schemalens-vscode-extension`.

Codex 讀的是**同一份技能**（`plugins/schemalens-vscode-extension/skills/`），因此觸發方式與 Claude 相同：描述問題即可，或手動叫用 `$database-schema-visualization`。

Codex plugins work in Codex CLI and the ChatGPT desktop app, but not in the Codex IDE extension. A repository marketplace must be imported first; it is not automatically listed in the universal public plugin directory.

## 直接安裝 VSIX

從 [GitHub Releases](https://github.com/kaikaizhen/schemaLen/releases/latest) 下載
`dbschema-<version>.vsix`，然後任選一種：

**VS Code UI**

```text
Extensions → ...（右上角選單）→ Install from VSIX... → 選擇下載的檔案
```

**CLI**

```bash
code --install-extension dbschema-<version>.vsix
```

安裝後重新載入視窗（`Developer: Reload Window`）即可使用。

---

## 從原始碼建置

```bash
npm install
npm run build -w dbschema
npm run package:vsix     # 產出 dist/dbschema-<version>.vsix
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

完整語法見 [docs/dsl-spec.md](docs/dsl-spec.md)。

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
| 單擊 Table 標題 | Focus：相關表亮起、其餘淡化或隱藏 |
| 單擊欄位 | 欄位聚焦：只亮該欄位與透過 FK 對應的欄位，其餘欄位變雜訊；再點一次取消 |
| 雙擊 Table / Column | 跳回 DSL 定義並選取該行 |
| `Ctrl` / `Cmd` + `F` | 搜尋 Table / Column |
| `Esc` | Reset Focus |
| 卡片標題的 ▾ | Collapse / Expand |

Toolbar：

| 群組 | 選項 | 用途 |
|---|---|---|
| **欄位顯示** | 只有表名 / 主要欄位 / 全部欄位 | 一次要看多少欄位。「主要欄位」只留 PK / FK / UQ / IDX |
| **深度** | `−` `n 層` `+` / 全部 | 從焦點往外展開幾層關聯，可自由增減 |
| **方向** | 雙向 / 上游 / 下游 | 上游＝這張表依賴誰；下游＝誰依賴這張表 |
| **不相關** | 淡化 / 隱藏 | 焦點以外的表怎麼處理 |
| **排版** | 依群組 / 依關聯 | 版面依據 |
| **群組** | 下拉選單 | 只看某個功能模組 |
| **備註** | 單行 / 換行 | 欄位備註過長時，省略成 … 還是換行完整顯示 |

每個按鈕都有 tooltip 說明用途。

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

.claude-plugin/           Claude Code Plugin Marketplace 定義
.agents/plugins/          Codex Plugin Marketplace 定義
plugins/                  外掛本體
  └ skills/               Agent Skill（Claude 與 Codex 共用同一份）
```

外掛只是薄薄的封裝：兩個生態系各有自己的 marketplace 與 plugin manifest，
但**技能本體只有一份**，放在 `plugins/schemalens-vscode-extension/skills/`。

依賴方向單向向下。`schema-core` 不依賴 VS Code、Webview、Layout 或 Renderer；
Graph Traversal 獨立於 Renderer；Layout Engine 可整顆替換。

## 開發

```bash
npm test          # 429 個單元 / DOM / round-trip 測試
npm run typecheck
npm run build -w dbschema
npm run package:vsix     # 產出 dist/dbschema-<version>.vsix
npm run watch -w dbschema
```

DSL 規格見 [docs/dsl-spec.md](docs/dsl-spec.md)，發布流程見 [RELEASE.md](RELEASE.md)。

## Git Flow

`main` ← `develop` ← `feature/*`。一個功能一個分支，完成即合併回 `develop`。
Release 由 `main` 打 `v*` tag 觸發，詳見 [RELEASE.md](RELEASE.md)。

送 PR 請以 `develop` 為目標分支，並確認 `npm test` 與 `npm run typecheck` 都通過。

## License

[Apache License 2.0](LICENSE)。可自由使用、修改與再散布（含商業用途），
散布時請保留授權與 [NOTICE](NOTICE) 的標示。
