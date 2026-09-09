# Installing the DBSchema extension

Read this only when `code --list-extensions --show-versions` shows no
`kaikaizhen.dbschema`, or the user asks to update or remove it.

| | |
|---|---|
| Extension ID | `kaikaizhen.dbschema` |
| Releases | `https://github.com/kaikaizhen/schemaLen/releases` |
| Asset | `dbschema-<version>.vsix` |
| Requires | VS Code ≥ 1.90 with the `code` CLI on `PATH` |

The VS Code Marketplace is not used. Only the `.vsix` asset is downloaded, and it is
handed to VS Code's own CLI — nothing from the release is executed.

## Constraints

- Never use `sudo` or ask for administrator privileges.
- Never pipe a download into a shell (`curl … | bash` or equivalent).
- Never disable TLS verification or VS Code security settings.
- Write only inside a temporary directory, and remove it afterwards.

## Prefer the repository's installers

If the working copy provides them, run these instead of the manual steps — they
perform the same sequence and are the maintained path:

```bash
scripts/install-vscode-extension.sh            # macOS / Linux
```

```powershell
scripts\install-vscode-extension.ps1           # Windows
```

Both accept an optional explicit version and default to the latest stable release.

## Manual sequence

### 1. Require the CLI

```bash
code --version
```

If it fails, stop. Tell the user to install VS Code and add the CLI to `PATH` —
in VS Code, **Shell Command: Install 'code' command in PATH**. Do not install VS
Code for them.

### 2. Resolve the target version

Use the version the user named, otherwise the latest stable release:

```bash
curl -fsSL https://api.github.com/repos/kaikaizhen/schemaLen/releases/latest
```

```powershell
Invoke-RestMethod -Uri https://api.github.com/repos/kaikaizhen/schemaLen/releases/latest
```

Take `tag_name` (`v<version>`) and the `browser_download_url` of the asset named
`dbschema-<version>.vsix`. If that asset is absent, stop and report it rather than
downloading anything else.

### 3. Skip when already satisfied

If the installed version already equals the target, say so and stop — unless the
user explicitly asked to reinstall.

### 4. Download to a temporary directory

```bash
tmp="$(mktemp -d)"
curl -fL --proto '=https' --tlsv1.2 -o "$tmp/dbschema-<version>.vsix" "<browser_download_url>"
```

```powershell
$tmp = Join-Path $env:TEMP ([guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
Invoke-WebRequest -Uri "<browser_download_url>" -OutFile "$tmp\dbschema-<version>.vsix"
```

`curl -f` and `Invoke-WebRequest` both fail on HTTP errors — do not continue past a
failed download. If the release publishes a SHA256 checksum, verify it first.

### 5. Install

```bash
code --install-extension "$tmp/dbschema-<version>.vsix"
```

### 6. Verify, then clean up

```bash
code --list-extensions --show-versions
```

Confirm `kaikaizhen.dbschema@<version>` matches the target. Remove the temporary
directory afterwards — including when the install failed.

### 7. Report

State the resulting version and whether it was a fresh install, an upgrade or a
no-op. Tell the user to run **Developer: Reload Window**: reinstalling the same
version does not reload the extension host on its own, so the new build would
otherwise appear not to work.

## Uninstall

```bash
code --uninstall-extension kaikaizhen.dbschema
```
