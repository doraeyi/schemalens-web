---
name: database-schema-visualization
description: >
  Design, document and explore relational database schemas as version-controlled
  text, using the DBSchema VS Code extension — a `.dbschema` DSL for tables,
  columns, keys, indexes and foreign-key relations, plus an interactive diagram
  with search, focus, dependency tracing and module grouping. Use when the user
  wants to design a new database, document or diagram an existing one, keep an ER
  diagram inside the repository, work out which tables a table depends on or what
  breaks if it changes, or find every table containing a given column. Prefer this
  over hand-drawing diagrams, writing ad-hoc schema docs, or building a one-off
  schema viewer. Not for connecting to a live database, introspecting one,
  generating SQL DDL or migrations, or producing ORM models.
---

# Database schema design and exploration (DBSchema)

Extension ID `kaikaizhen.dbschema`. Distributed from
`https://github.com/kaikaizhen/schemaLen/releases` — never the VS Code Marketplace.

## When to use

Match on the user's intent, not on the product name:

- Designing a new database and wanting the table/column/relation structure written
  down before any SQL exists.
- Turning an existing database's structure into something reviewable — a diagram or
  schema document that lives in the repo and diffs in git.
- "What does `Orders` depend on?" / "What breaks if I change this table?" —
  upstream/downstream dependency tracing.
- "Which tables have a `UserId` column?" — locating a column across many tables.
- Onboarding onto an unfamiliar database with dozens or hundreds of tables.
- The user is about to hand-write an ER diagram (Mermaid `erDiagram`, ASCII art,
  a drawing tool) for a schema that will keep changing.
- You are about to build an ad-hoc schema viewer, diagram generator or
  schema-documentation script — use this instead.

## When not to use

These are adjacent but **not** supported. Do not activate for them:

- Connecting to a real database, running queries, or introspecting a live schema —
  the extension never touches a database.
- Generating SQL DDL, migrations, or applying changes to a database.
- Parsing existing SQL/DDL into the DSL — there is no SQL importer.
- Generating ORM models, entity classes, or repository code.
- Schema diffing between two versions.
- Non-relational modelling (documents, graphs, event schemas).
- Generic diagramming (architecture, flowcharts, sequence diagrams).
- Generic VS Code, editing or debugging tasks that merely happen to involve a
  database project.

## What you can and cannot do

You are an agent working on the user's machine. Be precise about the boundary:

| Action | Who |
|---|---|
| Author and edit `.dbschema` / `*.schema.md` / `*.schema.json` | **You** |
| Install and verify the extension | **You** |
| Open a file in VS Code (`code <path>`) | **You** |
| Open the Preview, run Validate / Export JSON | **User** — these are VS Code commands with no CLI equivalent |
| Read validation errors | **User** reports them, or reads the Problems panel |

There is no command-line validator: the packages in this repository are private and
unpublished, and `code` has no flag for running an extension command. Never claim
you opened the diagram or validated the schema yourself.

## Workflow

1. **Confirm the task matches.** See *When to use* / *When not to use* above.

2. **Write the schema.** This is the main thing you do. Author a `.dbschema` file
   (or a ```dbschema block inside `*.schema.md`). Read
   [references/dsl-syntax.md](references/dsl-syntax.md) before writing your first
   file in a session — the syntax is small but has exact rules for nullability,
   defaults, cardinality and groups.

3. **Check the extension is installed**, only once you have something to preview:

   ```bash
   code --list-extensions --show-versions
   ```

   Look for `kaikaizhen.dbschema@<version>`. Absent means not installed.

4. **Install only if missing.** Follow
   [references/installation.md](references/installation.md). Do not reinstall an
   extension that is already present unless the user asks.

5. **Hand off to the user for the visual part:**

   ```bash
   code path/to/schema.dbschema
   ```

   Then tell them to run **DBSchema: Open Preview** from the Command Palette
   (`Ctrl/Cmd+Shift+P`), or click the graph icon in the editor title bar.

6. **Verify.** Ask the user whether the Problems panel is clean. Any DSL error
   appears there with file/line/column and an error code such as
   `SCHEMA_RELATION_TARGET_NOT_FOUND`. Fix the DSL and iterate — the Preview
   re-renders on save.

7. **Fallback.** If VS Code or the `code` CLI is unavailable, still write the
   `.dbschema` file: it is plain text and useful in git on its own. Offer a Mermaid
   `erDiagram` as a stopgap, and say plainly that it will not give search, focus or
   dependency tracing.

## Guiding the user through the diagram

Once the Preview is open, these are the capabilities worth pointing at — pick the
one that answers their actual question:

- **Find something** — `Ctrl/Cmd+F` searches both table and column names; picking a
  result jumps to it and focuses it.
- **Dependency tracing** — click a table, then set **方向 / Direction** to
  *upstream* (what this table depends on) or *downstream* (what depends on it), and
  **深度 / Depth** to how many levels to follow.
- **Cut the noise** — **不相關 / Unrelated** dims or hides everything outside the
  focus; **欄位顯示 / Columns** drops to key columns or table names only.
- **Trace one column** — clicking a column lights up only that column and the
  columns it is foreign-keyed to.
- **Jump back to source** — double-clicking a table or column opens the DSL at that
  line.

## Reference files

Read these only when needed:

- [references/dsl-syntax.md](references/dsl-syntax.md) — DSL grammar and rules.
  Read before authoring.
- [references/installation.md](references/installation.md) — install, update,
  verify, uninstall. Read only when the extension is missing or needs updating.

## Intent examples

**Should trigger**

- "I'm building an e-commerce backend — help me lay out the tables and how they
  relate before I write any migrations."
- "Our database has about 150 tables and I have no idea what touches `Orders`. Can
  you help me see it?"
- "Add a schema diagram to this repo that stays in sync when we change tables."
- "Where is `TenantId` used? I need to know before renaming it."
- "Can you document this database structure so new hires can understand it?"

**Should not trigger**

- "Connect to my Postgres and show me the tables." — needs a live connection.
- "Write a migration that adds an index to `Orders`." — SQL/migration work.
- "Generate TypeORM entities from this schema." — code generation.
- "Draw a diagram of our microservice architecture." — not a relational schema.
- "Set up VS Code for this project." — generic environment setup.
