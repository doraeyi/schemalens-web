/**
 * 合成 Schema 的「語意品質」測試。
 *
 * 這份資料會被當成範例檔給人看，所以不能只驗「解析得過」——
 * 之前就發生過型別與欄位名完全不搭（Quantity uniqueidentifier）、
 * 付款表被歸到分析模組、FK 欄位名叫 CategorieId 這些問題，
 * 語法上全部合法，但範例本身是錯的。
 */
import { describe, expect, it } from "vitest";
import { validateSchema } from "@schemalens/schema-core";
import { toJson } from "@schemalens/schema-serializer";
import { FIXTURE_SIZES, generateSchema } from "@schemalens/schema-fixtures";

const schema = generateSchema({ tableCount: 150, seed: 20260905 });

describe("結構正確性", () => {
  it("驗證沒有診斷", () => {
    expect(validateSchema(schema)).toEqual([]);
  });

  it("表數與要求一致", () => {
    for (const size of FIXTURE_SIZES) {
      expect(generateSchema({ tableCount: size }).tables).toHaveLength(size);
    }
  });

  it("同一個 seed 產生完全相同的結果", () => {
    expect(toJson(generateSchema({ tableCount: 50, seed: 7 }))).toBe(
      toJson(generateSchema({ tableCount: 50, seed: 7 })),
    );
  });

  it("每張表都有 PK 與唯一的 Code、稽核用的 CreatedAt", () => {
    for (const table of schema.tables) {
      expect(table.columns.some((c) => c.primaryKey)).toBe(true);
      expect(table.columns.some((c) => c.name === "Code" && c.unique)).toBe(true);
      expect(table.columns.some((c) => c.name === "CreatedAt")).toBe(true);
    }
  });

  it("欄位名在同一張表內不重複", () => {
    for (const table of schema.tables) {
      const names = table.columns.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("型別要配得上欄位名", () => {
  const expected: Record<string, string> = {
    IsActive: "bit",
    SortOrder: "int",
    Quantity: "int",
    Priority: "int",
    Version: "int",
    Notes: "nvarchar",
    Description: "nvarchar",
    Slug: "nvarchar",
    Locale: "nvarchar",
    Status: "nvarchar",
    Amount: "decimal",
    Score: "decimal",
    StartsAt: "datetime2",
    EndsAt: "datetime2",
    CreatedAt: "datetime2",
    ExternalId: "uniqueidentifier",
  };

  it("每個已知欄位名都對應到正確型別", () => {
    for (const table of schema.tables) {
      for (const column of table.columns) {
        const want = expected[column.name];
        if (want) expect(`${table.id}.${column.name}:${column.type}`).toBe(`${table.id}.${column.name}:${want}`);
      }
    }
  });

  it("所有 FK 欄位都是 bigint，與被參照的 Id 型別一致", () => {
    for (const table of schema.tables) {
      for (const column of table.columns) {
        if (column.foreignKey) expect(column.type).toBe("bigint");
      }
    }
  });
});

describe("備註要有實際意義", () => {
  it("沒有 'XXX 欄位說明' 這類佔位文字", () => {
    for (const table of schema.tables) {
      expect(table.comment ?? "").not.toMatch(/欄位說明|模組的/);
      for (const column of table.columns) {
        expect(column.comment ?? "").not.toMatch(/欄位說明/);
      }
    }
  });

  it("每張表與每個欄位都有備註", () => {
    for (const table of schema.tables) {
      expect(table.comment).toBeTruthy();
      for (const column of table.columns) expect(column.comment).toBeTruthy();
    }
  });
});

describe("模組分類要合理", () => {
  it("每張表都有群組", () => {
    expect(schema.tables.every((t) => Boolean(t.group))).toBe(true);
  });

  it("schema 名稱與群組一致（Payment 不會被歸到 Analytics）", () => {
    for (const table of schema.tables) {
      expect(table.schema).toBe(table.group!.toLowerCase());
    }
  });

  it("群組宣告涵蓋所有實際使用到的群組", () => {
    const declared = new Set((schema.groups ?? []).map((g) => g.name));
    for (const table of schema.tables) expect(declared.has(table.group!)).toBe(true);
  });

  it("每個群組宣告都有描述", () => {
    for (const group of schema.groups ?? []) expect(group.description).toBeTruthy();
  });
});

describe("同一張表不該同時有 Name 與 Title", () => {
  it("兩者互斥", () => {
    for (const table of schema.tables) {
      const names = new Set(table.columns.map((c) => c.name));
      expect(names.has("Name") && names.has("Title")).toBe(false);
    }
  });
});

describe("關聯要合理", () => {
  it("FK 欄位名是目標表名的單數（複數化回去要等於表名）", () => {
    // 用「複數化後應等於目標表名」來驗，而不是硬檢查結尾字元——
    // Address 的單數本來就以 s 結尾，粗糙的規則會誤判。
    const pluralize = (name: string): string => {
      if (name.endsWith("y")) return `${name.slice(0, -1)}ies`;
      if (name.endsWith("s") || name.endsWith("x") || name.endsWith("ch")) return `${name}es`;
      return `${name}s`;
    };
    /** `User2` → `Users2`：序號要留在最後面。 */
    const pluralizeWithSuffix = (name: string): string => {
      const [, base, suffix] = /^(.*?)(\d*)$/.exec(name)!;
      return `${pluralize(base!)}${suffix}`;
    };

    let checked = 0;
    for (const relation of schema.relations) {
      const fk = relation.sourceColumns[0]!;
      expect(fk).toMatch(/Id$/);
      const singular = fk.slice(0, -2);
      const targetName = relation.targetTable.split(".")[1]!;
      expect(pluralizeWithSuffix(singular)).toBe(targetName);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("每條 relation 的兩端都存在，且欄位真的在表上", () => {
    const byId = new Map(schema.tables.map((t) => [t.id, t]));
    for (const relation of schema.relations) {
      const source = byId.get(relation.sourceTable);
      const target = byId.get(relation.targetTable);
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      expect(source!.columns.some((c) => c.name === relation.sourceColumns[0])).toBe(true);
      expect(target!.columns.some((c) => c.name === relation.targetColumns[0])).toBe(true);
    }
  });

  it("沒有自我參照", () => {
    for (const relation of schema.relations) {
      expect(relation.sourceTable).not.toBe(relation.targetTable);
    }
  });

  it("不產生 N:M——單一外鍵欄位表達不了多對多", () => {
    for (const relation of schema.relations) {
      expect(relation.cardinality).not.toBe("N:M");
    }
  });

  it("FK 圖無環（真實資料庫的外鍵大多是有向無環的）", () => {
    const outgoing = new Map<string, string[]>();
    for (const relation of schema.relations) {
      const list = outgoing.get(relation.sourceTable);
      if (list) list.push(relation.targetTable);
      else outgoing.set(relation.sourceTable, [relation.targetTable]);
    }

    const state = new Map<string, "visiting" | "done">();
    const hasCycle = (node: string): boolean => {
      const current = state.get(node);
      if (current === "visiting") return true;
      if (current === "done") return false;
      state.set(node, "visiting");
      for (const next of outgoing.get(node) ?? []) {
        if (hasCycle(next)) return true;
      }
      state.set(node, "done");
      return false;
    };

    for (const table of schema.tables) expect(hasCycle(table.id)).toBe(false);
  });

  it("有跨 schema 的關聯，才測得到多模組情境", () => {
    const cross = schema.relations.filter(
      (r) => r.sourceTable.split(".")[0] !== r.targetTable.split(".")[0],
    );
    expect(cross.length).toBeGreaterThan(0);
  });
});
