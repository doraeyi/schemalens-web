<div align="center">

# SchemaLens Web

**在瀏覽器裡畫、編輯、協作資料庫 Schema，並讓 AI 代理直接改你的畫布**

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-realtime-F5A623?style=flat-square)
![MySQL](https://img.shields.io/badge/MySQL-Drizzle-4479A1?style=flat-square&logo=mysql&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-server-000000?style=flat-square&logo=anthropic&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-hosted-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## 📖 簡介

SchemaLens Web 是 SchemaLens 的網頁版：用 DBSchema DSL 描述資料表，右邊即時畫出欄位級的關聯圖。沒有登入也能用（存在 localStorage），登入 GitHub 後可以把多份 schema 存到雲端、邀請別人即時協作。網站本身也是一個 MCP server，Claude 等 AI 代理可以直接讀取、檢查、修改你的分頁。

這個 repo 是 pnpm monorepo：網站本體在 `apps/web`，VS Code 擴充套件在 `apps/vscode-extension`，解析、排版、繪圖等核心邏輯放在 `packages/*` 讓兩邊共用。

## ✨ 功能特色

- ✍️ **DSL 即時預覽**：欄位級關聯線、群組、搜尋、上下游追蹤
- 🧹 **Schema Lint**：缺 PK、外鍵沒 index、命名不一致等最佳實踐檢查
- 🔍 **Schema Diff**：比較兩份 schema 的差異
- 🧾 **SQL 匯入 / 匯出**：DDL ⇄ Schema
- 👥 **即時協作**：Yjs + WebSocket relay，邀請連結加入
- ☁️ **雲端儲存**：GitHub 登入，多分頁、版本快照
- 🤖 **MCP 工具**：AI 代理可列出分頁、讀取 / 更新 schema、查問題
- ⌨️ **畫布快捷鍵**：全選、復原 / 重做、刪除、複製、縮放
- 🌐 **中文 / 英文**

## 🏗️ 系統架構

```mermaid
flowchart LR
    Browser["瀏覽器"] --> Web["apps/web<br/>SvelteKit"]
    Agent["AI 代理<br/>Claude 等"] -- "MCP /api/mcp" --> Web
    Web -- "Auth.js GitHub" --> GH["GitHub OAuth"]
    Web -- "Drizzle" --> DB[("MySQL")]
    Browser <-->|"Yjs / WebSocket"| Relay["Collab Relay<br/>y-websocket"]
    Web -.AI 助手.-> LLM["Anthropic / OpenAI"]

    subgraph Packages["packages/*（插件與網頁共用）"]
        P1["schema-parser・core・serializer"]
        P2["schema-graph・layout・renderer"]
        P3["schema-lint・diff・sql"]
    end
    Web --> Packages
    VSC["apps/vscode-extension"] --> Packages
```

## 🧰 技術棧

| 類別 | 技術 |
| --- | --- |
| 框架 | SvelteKit 2、Svelte 5、TypeScript、Vite |
| 樣式 / 動畫 | Tailwind CSS 4、GSAP、lucide |
| 協作 | Yjs、y-websocket、ws |
| 認證 | Auth.js（@auth/sveltekit）+ GitHub OAuth |
| 資料庫 | MySQL（mysql2）+ Drizzle ORM |
| AI | MCP SDK、Anthropic SDK、OpenAI SDK、zod |
| 核心套件 | `@schemalens/schema-*`（parser、core、graph、layout、renderer、lint、diff、sql…） |
| 測試 | Vitest |
| 部署 | Vercel（網站）、獨立主機（協作 relay） |

## 📂 專案結構

```text
schemalens-web/
├── apps/
│   ├── web/                  # SvelteKit 網站
│   │   ├── src/routes/         # 首頁、/app 編輯器、/docs、/join、/api/mcp…
│   │   ├── src/lib/server/     # auth、db、mcp 工具
│   │   └── scripts/            # yjs dev server、協作 relay 部署
│   └── vscode-extension/     # VS Code 擴充套件
├── packages/                 # 共用核心（見 packages/README.md）
├── plugins/                  # Claude Code / Codex 外掛與 Agent Skill
├── docs/dsl-spec.md          # DSL 語法
└── examples/
```

## 🚀 快速開始

### 需要先裝

- Node.js 22 以上
- pnpm 10 以上（沒有的話：`npm install -g pnpm`）

### 1. 安裝套件

在 repo 根目錄執行一次：

```sh
pnpm install
```

### 2. 啟動網站

```sh
pnpm --filter schemalens-web dev
```

打開 <http://localhost:5173> 就能用了。

**只是要畫圖、編輯 schema 的話，不需要任何設定**：沒有資料庫、沒有登入也能跑，編輯中的內容會存在瀏覽器的 localStorage。

### 3.（選用）即時協作

要在本機測試多人同時編輯，**另外開一個終端機**跑協作用的 relay server：

```sh
pnpm --filter schemalens-web dev:collab
```

它會在 `ws://localhost:1234` 等連線，網站預設就會連這個位址，不用額外設定。開兩個瀏覽器分頁、用邀請連結加入，就能看到彼此的編輯。這個 relay 只存在記憶體裡，關掉資料就沒了。

### 4.（選用）登入與雲端儲存

需要 GitHub 登入、把 schema 存到資料庫時，才要做這步。

1. 複製環境變數範本：

   ```sh
   cp apps/web/.env.example apps/web/.env
   ```

2. 填入 `apps/web/.env`：

   | 變數 | 說明 |
   | --- | --- |
   | `AUTH_SECRET` | 隨便一串亂數，可用 `openssl rand -hex 32` 產生 |
   | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 到 GitHub → Settings → Developer settings → OAuth Apps 建一個 App，Authorization callback URL 填 `http://localhost:5173/auth/callback/github` |
   | `DATABASE_URL` | MySQL 連線字串，例如 `mysql://user:password@localhost:3306/schemalens` |
   | `PUBLIC_COLLAB_WS_URL` | 本機留空即可（會用 `ws://localhost:1234`） |

3. 建立資料表：

   ```sh
   pnpm --filter schemalens-web db:push
   ```

4. 重新啟動 `dev`。

## ⌨️ 常用指令

在 repo 根目錄執行：

| 指令 | 用途 |
| --- | --- |
| `pnpm --filter schemalens-web dev` | 啟動網站（開發模式） |
| `pnpm --filter schemalens-web dev:collab` | 啟動本機協作 relay server |
| `pnpm --filter schemalens-web check` | Svelte / TypeScript 型別檢查 |
| `pnpm --filter schemalens-web build` | 打包正式版 |
| `pnpm --filter schemalens-web preview` | 在本機預覽打包後的正式版 |
| `pnpm test` | 跑所有 packages 的單元測試 |
| `pnpm typecheck` | packages 的型別檢查 |
| `pnpm --filter schemalens-web db:studio` | 開 Drizzle Studio 看資料庫內容 |

## 📚 相關文件

- 共用套件說明：[packages/README.md](packages/README.md)
- Schema DSL 語法：[docs/dsl-spec.md](docs/dsl-spec.md)
- 正式環境的協作 relay 部署：[apps/web/scripts/collab-relay-deploy/README.md](apps/web/scripts/collab-relay-deploy/README.md)
