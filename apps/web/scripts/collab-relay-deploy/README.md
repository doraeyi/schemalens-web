# 部署即時協作 relay server 到 Ubuntu 主機

跟一般 scp 上傳 → mkdir → mv 進資料夾 → 裝依賴 → systemd → nginx 那套流程一樣，
只是這次是 Node 服務。這個服務只負責轉發協作訊息、不落地任何資料——schema
內容本來就會透過既有的 `saveToCloud()` 存進 MySQL，重啟這個服務頂多讓正在
協作中的人斷線重連一下，不會弄丟資料。

以下用 `<YOUR_HOST>`（SSH 主機）、`<YOUR_SSH_PORT>`、`<YOUR_USER>`、
`<YOUR_DOMAIN>` 代稱，換成你自己的實際值。

**架構前提**：如果你的主機本身沒有直接掛 443、TLS 是由更外層（NAS、CDN…）
終結，這台機器只講 http、靠路徑轉給不同後端服務（跟很多家用 NAS 的架設方式
一樣），可以參考 `nginx-collab.conf` 用路徑掛法：
`https://<YOUR_DOMAIN>/collab/`，不用另外申請 DNS、不用跑 certbot。如果你的
主機本身就直接處理 TLS，改成獨立的 `server{}` block + 自己的網域/憑證即可。

## 需要的三個檔案

- `apps/web/scripts/yjs-dev-server.mjs`（relay server 本體）
- `apps/web/scripts/collab-relay-deploy/package.json`（只列 4 個依賴，不是整個 monorepo 的 package.json）
- `apps/web/scripts/collab-relay-deploy/schemalens-collab.service`

## 1. 裝 Node（如果主機本來沒有）

不用 sudo，裝在使用者自己的家目錄：

```
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
node -v   # 記下版本號，等一下 schemalens-collab.service 要填
```

## 2. 上傳檔案、整理資料夾

```
scp -P <YOUR_SSH_PORT> apps/web/scripts/yjs-dev-server.mjs <YOUR_USER>@<YOUR_HOST>:~/
scp -P <YOUR_SSH_PORT> apps/web/scripts/collab-relay-deploy/package.json <YOUR_USER>@<YOUR_HOST>:~/
```

SSH 進去（`ssh -p <YOUR_SSH_PORT> <YOUR_USER>@<YOUR_HOST>`）：

```
mkdir -p ~/schemalens-collab
mv ~/yjs-dev-server.mjs ~/package.json ~/schemalens-collab/
cd ~/schemalens-collab
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install --omit=dev
```

可以先手動跑一次確認沒問題：`node yjs-dev-server.mjs &`，另開一個視窗
`curl http://127.0.0.1:1234` 應該回 `yjs dev relay ok`，確認完 `pkill -f
yjs-dev-server.mjs`。

## 3. systemd 服務

把 `schemalens-collab.service` 裡的 `<YOUR_USER>`、`<NODE_VERSION>`
換成實際值（`node -v` 的結果，例如 `v24.21.0`），上傳並啟用：

```
scp -P <YOUR_SSH_PORT> apps/web/scripts/collab-relay-deploy/schemalens-collab.service <YOUR_USER>@<YOUR_HOST>:~/
```

SSH 進去：

```
sudo cp ~/schemalens-collab.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now schemalens-collab.service
sudo systemctl status schemalens-collab.service   # 確認 active (running)
```

## 4. nginx

把 `nginx-collab.conf` 裡的 `location /collab/ { ... }` 貼進你既有的 nginx
站台設定裡（跟其他 proxy_pass 的 location 放同一層），然後：

```
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` 一定要先過才能 reload，不然可能會連原本其他站台也一起壞掉。

## 5. 驗證

```
curl -s http://127.0.0.1/collab/   # 這台機器上直接測
curl -s https://<YOUR_DOMAIN>/collab/   # 外部測
```

兩邊都應該回 `yjs dev relay ok`。

## 6. 接上正式站台

在 Vercel 專案的 Environment Variables（Production/Preview 都設）加：

```
PUBLIC_COLLAB_WS_URL=wss://<YOUR_DOMAIN>/collab
```

設完重新部署一次。本機開發不用設這個，沒設就繼續用 `ws://localhost:1234`。

## 之後要更新 relay server 本身

```
scp -P <YOUR_SSH_PORT> apps/web/scripts/yjs-dev-server.mjs <YOUR_USER>@<YOUR_HOST>:~/schemalens-collab/
ssh -p <YOUR_SSH_PORT> <YOUR_USER>@<YOUR_HOST> "sudo systemctl restart schemalens-collab"
```
