import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 打包 VSIX。
 *
 * 兩個刻意的作法：
 *  1. 明確算出輸出檔名，而不是靠 `--out <dir>/`——vsce 在 Windows 上不會把結尾斜線
 *     當成目錄，會直接產生一個沒有副檔名的檔案。
 *  2. 直接用 node 執行 vsce 的進入點，而不是 spawn `npx`——Windows 上 spawn .cmd
 *     不帶 shell 會 EINVAL，帶 shell 又要處理引號逸出。
 *
 * 結果：任何平台上的輸出都一定是 dist/dbschema-<version>.vsix。
 */
const require = createRequire(import.meta.url);
const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(extensionRoot, "../..");

const manifest = JSON.parse(readFileSync(resolve(extensionRoot, "package.json"), "utf8"));
const outDir = resolve(repoRoot, "dist");
const outFile = resolve(outDir, `${manifest.name}-${manifest.version}.vsix`);

mkdirSync(outDir, { recursive: true });

const vsceBin = resolve(dirname(require.resolve("@vscode/vsce/package.json")), "vsce");

execFileSync(process.execPath, [vsceBin, "package", "--no-dependencies", "--out", outFile], {
  cwd: extensionRoot,
  stdio: "inherit",
});

console.log(`\nVSIX: ${outFile}`);
