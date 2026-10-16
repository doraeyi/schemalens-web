import { describe, expect, it } from "vitest";
import { parseSql } from "@schemalens/schema-sql/import";
import { splitSqlStatements } from "../src/import/statementSplitter";

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

const PG_FUNCTION = `
BEGIN;
CREATE OR REPLACE FUNCTION booking.can_access(p_employee_id varchar, p_type_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT booking.is_it_admin(p_employee_id)
      OR EXISTS (SELECT 1 FROM booking.res_type rt WHERE rt.id = p_type_id);
$$;
CREATE FUNCTION booking.touch() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now(); -- create table inside a body must not count
  RETURN NEW;
END;
$body$;
`;

describe("splitSqlStatements", () => {
  it("treats $$ / $tag$ bodies as one piece", () => {
    const parts = splitSqlStatements(PG_FUNCTION).map((s) => s.text.trim().split(/\s+/).slice(0, 4).join(" "));
    expect(parts).toEqual(["BEGIN;", "CREATE OR REPLACE FUNCTION", "CREATE FUNCTION booking.touch() RETURNS"]);
  });

  it("does not mistake $1 parameters for a dollar quote", () => {
    expect(splitSqlStatements("SELECT $1; SELECT $2;")).toHaveLength(2);
  });
});

describe("parseSql", () => {
  it("says plainly when the SQL has no CREATE TABLE", async () => {
    const { schema, diagnostics } = await parseSql(PG_FUNCTION, "postgresql");
    expect(schema.tables).toHaveLength(0);
    expect(diagnostics[0]!.message).toContain("沒有 CREATE TABLE");
  });

  it("keeps semicolons inside $$ bodies from splitting the statement", async () => {
    const { schema, diagnostics } = await parseSql(
      `${PG_FUNCTION}\nCREATE TABLE booking.res_type (id integer PRIMARY KEY, manager varchar(20));`,
      "postgresql",
    );
    expect(schema.tables.map((t) => t.name)).toEqual(["res_type"]);
    expect(diagnostics.some((d) => d.message.includes("沒有 CREATE TABLE"))).toBe(false);
  });

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
