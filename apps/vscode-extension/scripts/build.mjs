import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

/** Extension host 走 CommonJS；vscode 模組由 host 提供，必須 external。 */
const extensionConfig = {
  entryPoints: [resolve(root, "src/extension.ts")],
  outfile: resolve(root, "out/extension.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};

/** Webview 是瀏覽器環境，整包 bundle 成單檔以符合 CSP。 */
const webviewConfig = {
  entryPoints: [resolve(root, "src/webview/main.ts")],
  outfile: resolve(root, "out/webview.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  for (const config of [extensionConfig, webviewConfig]) {
    const ctx = await context(config);
    await ctx.watch();
  }
  console.log("[dbschema] watching…");
} else {
  await Promise.all([build(extensionConfig), build(webviewConfig)]);
}
