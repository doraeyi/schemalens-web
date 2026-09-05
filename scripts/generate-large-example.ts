/**
 * 產生大型 Schema 範例，用來人工驗證 AC-20（100+ 張表仍具可用性）。
 *
 * 合成資料而非手寫：手寫 150 張表既不可靠也無法重現，
 * 而 schema-fixtures 用固定 seed，每次產生的結果完全一致。
 *
 *   npm run example:large
 */
import { writeFileSync } from "node:fs";
import { generateSchema } from "@schemalens/schema-fixtures";
import { toDsl } from "@schemalens/schema-serializer";
import type { Schema, Table } from "@schemalens/schema-core";

const TABLE_COUNT = Number(process.env.TABLE_COUNT ?? 150);
const OUT = process.argv[2] ?? "examples/large-schema.schema.md";

const schema = generateSchema({ tableCount: TABLE_COUNT, seed: 20260905 });

/** 依 schema 名稱分組，讓 Markdown 分成多個 dbschema 區塊。 */
const byModule = new Map<string, Table[]>();
for (const table of schema.tables) {
  const list = byModule.get(table.schema);
  if (list) list.push(table);
  else byModule.set(table.schema, [table]);
}

/** 群組宣告只輸出一次，各模組區塊只帶自己的 table。 */
const dslFor = (tables: Table[], relations: Schema["relations"]): string =>
  toDsl({ ...schema, tables, relations, groups: [] }).trimEnd();

const groupsBlock = (): string =>
  toDsl({ ...schema, tables: [], relations: [], groups: schema.groups ?? [] }).trimEnd();

const modules = [...byModule.entries()].sort((a, b) => b[1].length - a[1].length);

const lines: string[] = [
  `# 大型 Schema 範例（${TABLE_COUNT} 張資料表）`,
  "",
  "用來驗證大型 Schema 的探索體驗（plan §21、AC-20）。",
  "在此檔案上執行 `DBSchema: Open Preview`，然後依序試：",
  "",
  "| 操作 | 預期 |",
  "|---|---|",
  "| `Ctrl`/`Cmd` + `F` 搜尋 `Orders` | 跳到該表並聚焦，其餘淡化 |",
  "| 搜尋欄位 `CreatedAt` | 列出所有含此欄位的表，點擊後高亮該欄位 |",
  "| Depth 切 `1-Hop` / `2-Hop` | 只保留一層／兩層相鄰的表 |",
  "| Direction 切 `Upstream` | 只看這張表依賴哪些表 |",
  "| Direction 切 `Downstream` | 只看哪些表依賴這張表 |",
  "| Unrelated 切 `Hide` | 不相關的表直接消失 |",
  "| View 切 `Overview` | 只剩表名與關聯，適合全局導覽 |",
  "| 備註切 `完整` | 欄位備註展開成多行 |",
  "| 拖曳卡片 | 自行調整版面，關聯線跟著走 |",
  "| 雙擊欄位 | 跳回本檔案對應的那一行 |",
  "",
  `分成 ${modules.length} 個模組區塊，最後一塊是跨模組關聯；`,
  "DBSchema 會把所有 ```dbschema 區塊合併成同一份 Schema。",
  "",
  "> 本檔由 `npm run example:large` 產生，請勿手動編輯。",
  "",
  "---",
  "",
  `## 群組（${(schema.groups ?? []).length} 個功能模組）`,
  "",
  "```dbschema",
  groupsBlock(),
  "```",
  "",
];

for (const [moduleName, tables] of modules) {
  lines.push(
    `## ${moduleName}（${tables.length} 張表）`,
    "",
    "```dbschema",
    dslFor(tables, []),
    "```",
    "",
  );
}

lines.push(
  `## 關聯（${schema.relations.length} 條）`,
  "",
  "```dbschema",
  dslFor([], schema.relations),
  "```",
  "",
);

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(
  `${OUT}: ${schema.tables.length} tables, ${schema.relations.length} relations, ${modules.length} modules`,
);
