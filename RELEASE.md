# Release 流程

DBSchema 透過 **GitHub Releases** 發布 VSIX，任何人都可以下載安裝。
目前尚未上架 Visual Studio Marketplace 與 Open VSX。

Repository：<https://github.com/kaikaizhen/schemaLen>

---

## 版本來源

**唯一的版本真實來源是 `apps/vscode-extension/package.json` 的 `version`。**

不要另外維護第二份版本號。Git tag 只是指向它，CI 會強制檢查兩者一致：

```text
Tag v0.1.0  ⟷  "version": "0.1.0"
```

不一致 → Workflow 直接失敗，不會建立 Release。

---

## 發布步驟

### 1. 修改版本號

編輯 `apps/vscode-extension/package.json`：

```json
{
  "version": "0.1.0"
}
```

### 2. 本機驗證

```bash
npm install
npm run typecheck
npm test
npm run package:vsix
```

`npm run package:vsix` 會建置並產出：

```text
dist/dbschema-0.1.0.vsix
```

### 3. 本機安裝確認（建議）

```bash
code --install-extension dist/dbschema-0.1.0.vsix
```

### 4. Commit

```bash
git add .
git commit -m "chore: release v0.1.0"
```

### 5. Tag 並推送

依 Git Flow，release 由 `main` 發出：

```bash
git checkout main
git merge --no-ff develop
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

> Tag 一定要用 `v` 開頭，Workflow 只監聽 `v*`。

### 6. GitHub Actions 執行

`.github/workflows/release.yml` 會依序執行：

```text
Checkout
→ Setup Node 20
→ npm ci
→ Validate version matches tag
→ npm run typecheck
→ npm test
→ Build extension bundles
→ Package VSIX
→ Verify VSIX filename
→ Create GitHub Release + Upload VSIX
```

任何一步失敗（版本不符、typecheck、測試、打包）都**不會**建立 Release。

### 7. 驗證 Release

到 Repository → **Releases** 確認：

- Release 標題為 `DBSchema 0.1.0`
- Asset 名稱為 `dbschema-0.1.0.vsix`
- 未登入的瀏覽器也下載得到（Repository 為 Public）

---

## 重新發布同一個版本

GitHub 不允許重複的 tag。若要重發：

```bash
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
# 到 GitHub 刪掉對應的 Release，再重新 tag
```

一般情況請直接遞增修訂號（例如 `0.1.1`），保留歷史比較乾淨。

---

## 誰可以下載

Repository 是 Public，Release Asset 也跟著公開，任何人都能下載安裝，
不需要邀請或授權。

若日後要改回限定對象發布，把 Repository 改成 Private 即可——
Release Asset 會跟著 Repository 的可見性走，只有具 Repository 權限的人下得到。
屆時記得同步更新 README 與 LICENSE 的說法。

---

## Secrets

**本流程不需要任何自訂 Secret。**

Workflow 只使用 GitHub Actions 內建的 `GITHUB_TOKEN`，
它由 Actions 在每次執行時自動注入，權限限定在本 Repository。

因此：

- 不需要建立 Personal Access Token
- 不需要在 `Settings → Secrets and variables → Actions` 新增任何東西
- 任何 token 都不應該寫進原始碼、README 或 commit

`.gitignore` 已擋掉 `.env*`、`*.pem`、`*.key`、`*.pfx`、`.npmrc`、`*.token` 等金鑰類檔案。

---

## Workflow 權限

`.github/workflows/release.yml` 宣告的是最小權限：

```yaml
permissions:
  contents: write
```

`contents: write` 是建立 Release 與上傳 Asset 的必要權限。
沒有授予 `packages: write`、`issues: write`、`pull-requests: write` 或任何 admin 權限。

若 Repository 或 Organization 設定了更嚴格的預設值，需要確認：

```text
Repository → Settings → Actions → General → Workflow permissions
```

至少為 **Read and write permissions**（或允許 workflow 自行宣告權限）。

---

## 明確不做

```text
Visual Studio Marketplace
Open VSX
Public CDN / Package Registry
Self-hosted Extension Marketplace
```

VSIX 只從 GitHub Releases 發布，不另外放到其他通路。
