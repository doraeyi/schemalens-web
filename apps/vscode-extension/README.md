# DBSchema

Database Schema Visualization for VS Code.

> Mermaid-like Schema DSL + drawDB-like Interactive Visualizer + Large Schema Exploration

在 VS Code 裡撰寫 `.dbschema`，即時驗證，開啟 Preview 直接看到完整的
Table / Column / Type 與欄位級 Relation；就算有 100 張表，也能快速找到某張表並理解它的關聯。

---

## 安裝

從 [GitHub Releases](https://github.com/kaikaizhen/schemaLen/releases/latest) 下載
`dbschema-<version>.vsix`，再用 `Extensions → ... → Install from VSIX...`
或 `code --install-extension dbschema-<version>.vsix` 安裝。

> 目前尚未上架 Visual Studio Marketplace 與 Open VSX。

---

## 快速開始

1. 建立 `database.dbschema`
2. 撰寫 Table / Column / Relation
3. 執行 `DBSchema: Open Preview`（或按編輯器右上角的圖示）

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

---

## 支援的檔案

| 檔案 | 說明 |
|---|---|
| `*.dbschema` | 第一優先。語法高亮、括號比對、自動縮排、即時診斷 |
| `*.schema.md` | Markdown 內的 ` ```dbschema ` 區塊，可跨多個區塊組成一份 Schema |
| `*.schema.json` | JSON Import；`DBSchema: Export JSON` 的輸出格式 |

---

## 命令

| 命令 | 說明 |
|---|---|
| `DBSchema: Open Preview` | 開啟互動式 Preview |
| `DBSchema: Validate Schema` | 驗證並回報問題數 |
| `DBSchema: Export JSON` | 匯出 `<name>.schema.json` |
| `DBSchema: Fit View` | 縮放到全部可見 |
| `DBSchema: Reset Focus` | 取消聚焦 |
| `DBSchema: Open Spike Preview` | 用 20 / 50 / 100 / 200 張合成表壓測 Viewer |

---

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

Toolbar：**View**（Overview / Keys / Full，預設 Full）、**Depth**（All / 1-Hop / 2-Hop）、
**Direction**（All / Upstream / Downstream）、**Unrelated**（Dim / Hide）。

---

## 大型 Schema

Preview 預設就是完整的資料表卡片，不是只有表名與線。
面對 100 張以上的 Schema 時，典型流程是：

```text
Search Orders → Jump + Focus → 1-Hop → Downstream → Hide Unrelated
```

需要全域導覽時再切到 `Overview`，需要細節時切回 `Full`。

---

## 錯誤處理

DSL 有錯時，錯誤會出現在編輯器的紅色波浪線與 Problems Panel，
**Preview 不會變成空白或崩潰** —— 它會繼續顯示可解析的部分，並在上方列出問題。

---

## 原始碼

<https://github.com/kaikaizhen/schemaLen>

## License

[Apache License 2.0](LICENSE)。
