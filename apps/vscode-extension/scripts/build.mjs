import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

/**
 * SQL 匯入要用的 node-sql-parser 有 1MB 以上，不能打進 extension.cjs——插件在 workspace 有
 * schema 檔時就會啟動，每次都要多載入一大包。extension.cjs 裡的
 * `import("@schemalens/schema-sql/import")` 改指向另外打包的 out/sql-import.cjs，執行「匯入 SQL」時才載入。
 */
const sqlImportExternal = {
  name: "sql-import-external",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@schemalens\/schema-sql\/import$/ }, () => ({ path: "./sql-import.cjs", external: true }));
  },
};

/** Extension host 走 CommonJS；vscode 模組由 host 提供，必須 external。 */
const extensionConfig = {
  entryPoints: [resolve(root, "src/extension.ts")],
  outfile: resolve(root, "out/extension.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  plugins: [sqlImportExternal],
  sourcemap: true,
  logLevel: "info",
};

const sqlImportConfig = {
  entryPoints: [resolve(root, "../../packages/schema-sql/src/import/index.ts")],
  outfile: resolve(root, "out/sql-import.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
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
  for (const config of [extensionConfig, webviewConfig, sqlImportConfig]) {
    const ctx = await context(config);
    await ctx.watch();
  }
  console.log("[dbschema] watching…");
} else {
  await Promise.all([build(extensionConfig), build(webviewConfig), build(sqlImportConfig)]);
}
