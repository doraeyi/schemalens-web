import { describe, expect, it } from "vitest";
import { parseSchema } from "@schemalens/schema-parser";
import { mergeSchemas } from "../src/lib/schema/mutations";

const current = parseSchema(
  `group Identity "身分"
table Users in Identity {
  PK Id bigint not null
}
table Posts {
  PK Id bigint not null
  FK AuthorId bigint not null
}
relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}`,
  "current.dbschema",
).schema;

const incoming = parseSchema(
  `table Posts {
  PK Id bigint not null
  FK AuthorId bigint not null
     Title nvarchar(200) not null
}
table Tags {
  PK Id bigint not null
}`,
  "incoming.dbschema",
).schema;

describe("mergeSchemas (匯入時「合併進來」)", () => {
  it("keeps existing tables, adds new ones, and lets the import win on the same table", () => {
    const merged = mergeSchemas(current, incoming);
    expect(merged.tables.map((t) => t.name).sort()).toEqual(["Posts", "Tags", "Users"]);
    expect(merged.tables.find((t) => t.name === "Posts")!.columns.map((c) => c.name)).toContain("Title");
  });

  it("keeps existing relations and groups", () => {
    const merged = mergeSchemas(current, incoming);
    expect(merged.relations.map((r) => r.name)).toEqual(["FK_Posts_Users"]);
    expect(merged.groups?.map((g) => g.name)).toEqual(["Identity"]);
  });

  it("does not mutate its inputs", () => {
    const before = JSON.stringify(current);
    mergeSchemas(current, incoming);
    expect(JSON.stringify(current)).toBe(before);
  });
});
