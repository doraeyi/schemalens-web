import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@schemalens/schema-core": pkg("schema-core"),
      "@schemalens/schema-graph": pkg("schema-graph"),
      "@schemalens/schema-parser": pkg("schema-parser"),
      "@schemalens/schema-layout": pkg("schema-layout"),
      "@schemalens/schema-renderer": pkg("schema-renderer"),
      "@schemalens/schema-serializer": pkg("schema-serializer"),
      "@schemalens/schema-fixtures": pkg("schema-fixtures"),
      "@schemalens/schema-lint": pkg("schema-lint"),
      "@schemalens/schema-diff": pkg("schema-diff"),
      "@schemalens/schema-sql/export": fileURLToPath(new URL("./packages/schema-sql/src/export/index.ts", import.meta.url)),
      "@schemalens/schema-sql/import": fileURLToPath(new URL("./packages/schema-sql/src/import/index.ts", import.meta.url)),
      "@schemalens/schema-sql": pkg("schema-sql"),
      // Extension 端的測試用 stub 取代真實 VS Code API（只有 Extension Host 才有）。
      vscode: fileURLToPath(new URL("./apps/vscode-extension/test/vscodeStub.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [
      ["packages/schema-renderer/test/**", "jsdom"],
      ["apps/vscode-extension/test/**/*.dom.test.ts", "jsdom"],
    ],
  },
});
