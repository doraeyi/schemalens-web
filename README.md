# SchemaLens / DBSchema

VS Code 的 Database Schema Visualization Extension。

> Mermaid-like Schema DSL + drawDB-like Interactive Visualizer + Large Schema Exploration

## 現況：Stage 0 — Technical Spike

先驗證「大型 Schema Viewer 在 VS Code Webview 裡的 UX 與效能」，再投入完整 DSL Parser。
目前 Preview 的資料來源是**合成 Schema**（20 / 50 / 100 / 200 tables），尚未接 DSL。

## 開發

```bash
npm install
npm test          # 單元 + DOM 測試
npm run typecheck
npm run build -w dbschema-vscode
```

在 VS Code 按 `F5`（Run DBSchema Extension），於新視窗執行：

```
DBSchema: Open Spike Preview (Synthetic Schema)
```

### Preview 操作

| 操作 | 行為 |
|---|---|
| 拖曳背景 | Pan |
| `Ctrl` / `Cmd` + 滾輪 | Zoom |
| 滾輪 | 平移 |
| 單擊 Table | Focus（相關表 active、其餘 dim/hide） |
| 雙擊 Table / Column | Open Source |
| `Ctrl` / `Cmd` + `F` | 搜尋 Table / Column |
| `Esc` | Reset Focus |
| 卡片標題的 ▾ | Collapse / Expand |

Toolbar 提供 View（Overview / Keys / **Full**，預設 Full）、Depth（All / 1-Hop / 2-Hop）、
Direction（All / Upstream / Downstream）、Unrelated（Dim / Hide）。

## 架構

```
apps/vscode-extension     Commands、Preview Panel、Webview
packages/schema-core      Domain Model、Error Model（不依賴 VS Code）
packages/schema-graph     Traversal、Search
packages/schema-layout    LayoutEngine 介面 + layered layout + edge routing
packages/schema-renderer  Table Card、Relation Edge、Focus/Dim/Hide、Zoom/Pan
packages/schema-fixtures  合成 Schema（Spike 與壓測用）
```

依賴方向單向向下；`schema-core` 不得依賴 VS Code、Webview、Layout 或 Renderer。

## Git Flow

`main` ← `develop` ← `feature/*`。一個功能一個分支，完成即合併回 `develop`。
