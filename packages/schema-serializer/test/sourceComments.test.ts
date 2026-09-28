import { describe, expect, it } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { fromJson, toDsl, toJson } from "@schemalens/schema-serializer";

const SOURCE = `// 會員模組
group Identity "身分驗證"

// 使用者主檔
table Users "使用者" in Identity { // 表頭註解
  // 主鍵
  PK Id    bigint        not null // 自動遞增
     Email nvarchar(255) not null
  // 之後要加手機
}

table sales.Orders {
  PK Id     bigint not null
     UserId bigint not null // 下單的人
}

// 查信箱用
index IX_Users_Email on Users(Email)

// 訂單屬於使用者
relation Orders_Users {
  sales.Orders.UserId N -> 1 Users.Id
}

// 檔案結尾的備忘
`;

function roundTrip(source: string): string {
  const parsed = parseSchema(source, "test.dbschema");
  expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return toDsl(parsed.schema);
}

describe("DSL 的 // 註解在重新序列化後保留", () => {
  const output = roundTrip(SOURCE);

  it.each([
    ["檔頭註解（掛在第一個語句前）", "// 會員模組\ngroup Identity"],
    ["表前面的註解", "// 使用者主檔\ntable Users"],
    ["表頭行尾註解", '{ // 表頭註解'],
    ["欄位前面的註解", "  // 主鍵\n  PK"],
    ["欄位行尾註解", "// 自動遞增"],
    ["最後一個欄位之後、} 之前的註解", "  // 之後要加手機\n}"],
    ["index 前面的註解", "// 查信箱用\nindex IX_Users_Email"],
    ["relation 前面的註解", "// 訂單屬於使用者\nrelation Orders_Users"],
    ["檔案結尾的註解", "// 檔案結尾的備忘\n"],
  ])("%s", (_label, expected) => {
    expect(output).toContain(expected);
  });

  it("原本沒寫 schema 的表不會被補上 dbo.，有寫的照樣保留", () => {
    expect(output).toContain("table Users ");
    expect(output).not.toContain("dbo.Users");
    expect(output).toContain("table sales.Orders {");
    expect(output).toContain("on Users(Email)");
    expect(output).toContain("sales.Orders.UserId N -> 1 Users.Id");
  });

  it("再來回一次內容完全不變（穩定）", () => {
    expect(roundTrip(output)).toBe(output);
  });

  it("語意跟原本完全一樣", () => {
    const before = parseSchema(SOURCE, "a.dbschema").schema;
    const after = parseSchema(output, "b.dbschema").schema;
    const semantic = (s: typeof before) =>
      JSON.parse(toJson({ ...s, tables: s.tables.map((t) => ({ ...t, sourceComments: undefined, schemaQualified: undefined, columns: t.columns.map((c) => ({ ...c, sourceComments: undefined })) })) }));
    expect(semantic(after)).toEqual(semantic(before));
  });

  it("經過 JSON 來回，註解也還在", () => {
    const viaJson = toDsl(fromJson(toJson(parseSchema(SOURCE, "a.dbschema").schema)).schema);
    expect(viaJson).toBe(output);
  });
});

describe("沒有註解的 schema 輸出維持原樣", () => {
  it("沒有註解時不會多出任何東西", () => {
    const source = "table dbo.Users {\n  PK Id bigint not null\n}\n";
    expect(roundTrip(source)).toBe("table dbo.Users {\n  PK Id bigint not null\n}\n");
  });

  it("JSON 不會多出空的 sourceComments 欄位", () => {
    const json = toJson(parseSchema("table dbo.Users {\n  PK Id bigint not null\n}\n", "a.dbschema").schema);
    expect(json).not.toContain("sourceComments");
    expect(json).not.toContain("trailingComments");
  });
});
