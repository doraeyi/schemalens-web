# SchemaLens Web

用瀏覽器看、編輯資料庫 schema 的工具。這個 repo 是 pnpm monorepo：網站本體在 `apps/web`（SvelteKit），畫圖、解析、排版等核心邏輯在 `packages/*`。

## 本機執行

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

## 常用指令

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

## 其他文件

- Schema DSL 語法：[docs/dsl-spec.md](docs/dsl-spec.md)
- 正式環境的協作 relay 部署：[apps/web/scripts/collab-relay-deploy/README.md](apps/web/scripts/collab-relay-deploy/README.md)
