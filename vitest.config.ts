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
      "@schemalens/schema-fixtures": pkg("schema-fixtures"),
    },
  },
  test: {
    globals: true,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["packages/schema-renderer/test/**", "jsdom"]],
  },
});
