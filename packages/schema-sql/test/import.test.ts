import { describe, expect, it } from "vitest";
import { parseSql } from "@schemalens/schema-sql/import";

const DDL = `
CREATE TABLE users (
  id bigint PRIMARY KEY,
  email text NOT NULL
);
CREATE TABLE orders (
  id bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id)
);
`;

describe("parseSql", () => {
  it("turns column-level REFERENCES into relations", async () => {
    const { schema } = await parseSql(DDL, "postgresql");
    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0]).toMatchObject({
      sourceColumns: ["user_id"],
      targetColumns: ["id"],
    });
  });

  it("uses the dialect's own default schema", async () => {
    const pg = await parseSql(DDL, "postgresql");
    expect(pg.schema.tables.map((t) => t.id)).toEqual(["public.users", "public.orders"]);

    const mysql = await parseSql(DDL, "mysql");
    expect(mysql.schema.tables[0]!.schema).toBe("dbo");
  });

  it("never marks a primary key column as nullable", async () => {
    const { schema } = await parseSql(
      `CREATE TABLE a (id bigint PRIMARY KEY); CREATE TABLE b (id bigint, PRIMARY KEY (id));`,
      "postgresql",
    );
    for (const table of schema.tables) {
      expect(table.columns.find((c) => c.name === "id")).toMatchObject({ primaryKey: true, nullable: false });
    }
  });
});
