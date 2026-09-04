# Release 流程

DBSchema 透過 **Private GitHub Repository 的 Private Release** 發布，
不上架 Visual Studio Marketplace、Open VSX，也不放任何公開下載點。

Release Asset 跟隨 Repository 的可見性：Repository 是 Private，
Release 的 `.vsix` 就只有具備 Repository 權限的人下得到。

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
- 未登入或無權限的帳號**無法**看到此頁面

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

## Access Management

### Personal Private Repository

```text
GitHub Repository
→ Settings
→ Collaborators
→ Add people
```

輸入對方的 GitHub 帳號並送出邀請。對方接受後即可進入 Releases 下載。

權限層級建議 **Read**：足以下載 Release，且不能推送程式碼。

### GitHub Organization

```text
Organization
→ Teams
→ (選擇 Team)
→ Repositories
→ Add repository
```

或直接在 Repository 的 `Settings → Collaborators and teams` 加入團隊，
權限選 **Read**。

### 移除權限

在同一個頁面移除該使用者即可。移除後對方立刻無法再下載 Release Asset。
已經下載過的 `.vsix` 無法回收，這是檔案發布的本質限制。

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
Public GitHub Release
Public CDN / Package Registry
Self-hosted Extension Marketplace
```
