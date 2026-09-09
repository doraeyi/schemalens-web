# DBSchema DSL syntax

Everything needed to author a valid `.dbschema` file. Read this before writing your
first schema in a session.

## File shape

A file is a sequence of `group`, `table`, `index` and `relation` statements. Blank
lines are ignored. `//` starts a comment that runs to end of line.

Newlines are significant: one column definition per line, statements do not wrap.

Identifiers are `[A-Za-z_][A-Za-z0-9_]*` and case-sensitive. Keywords are
case-insensitive. Strings are double-quoted, may contain any character including
CJK, and escape a quote as `\"`. Strings are used for comments and default values.

## Table

```text
table Users "系統使用者" {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}
```

`table [schema.]Name [String] [in Group] { … }`. Omitting the schema uses `dbo`, so
the table ID is `dbo.Users`. Use `table sales.Orders { … }` for another schema.

### Columns

`[PK|FK|UQ|IDX]* Name Type[(args)] [not null | null] [default value] [String]`

| Rule | Detail |
|---|---|
| Flags | Any order, several allowed (`PK UQ Id`) |
| `PK` | Implies `not null` |
| Omitted nullability | Defaults to nullable, except `PK` |
| One type arg | Length — `nvarchar(255)` |
| Two type args | Precision and scale — `decimal(18,2)` |
| Trailing string | The column comment |
| `FK` | A visual marker only — it does **not** create a relation |
| `IDX` | A marker only — real indexes use the `index` statement |
| `default` | Takes a number, string or identifier |

Quote any default that is not a plain number: `default "sysutcdatetime()"` — an
unquoted value containing parentheses fails to parse.

## Index

```text
index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)
unique index UX_Users_Email on Users(Email)
```

Indexes are modelled separately from columns so that composite indexes keep their
column order.

## Relation

```text
relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
```

`ColumnRef Cardinality -> Cardinality ColumnRef`, where cardinality is `1`, `N` or
`M`.

| Written | Meaning |
|---|---|
| `N -> 1` | `N:1` |
| `1 -> N` | `1:N` |
| `1 -> 1` | `1:1` |
| `N -> N` or `N -> M` | `N:M` |

**The arrow direction matters.** The left side holds the foreign key; the right side
is the referenced table. This is what upstream/downstream tracing follows, so
getting it backwards inverts the dependency arrows in the diagram.

Composite foreign keys use parentheses, paired by position:

```text
relation FK_OrderLines_Orders {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}
```

A `relation` block may hold several mapping lines, but they must all reference the
same pair of tables.

Many-to-many is not expressible with a single foreign key — model it with a junction
table and two `N -> 1` relations, as in `PostTags`.

## Group

Groups are functional modules, a different axis from `schema`, and may span schemas.

```text
group Identity "身分與權限模組" {
  Users
  Roles
  sales.Customers
}

group Sales "訂單與金流"

table Orders in Sales {
  PK Id bigint not null
}
```

Either form works and they can be mixed: list members in the block, or tag the table
with `in <Group>`. Membership lives on the table; the declaration only carries the
description. Members are separated by newlines or commas.

`group` and `in` are soft keywords, so a column named `Group` or `In` still parses.

Rules: a table belongs to at most one group; declaring the same group twice is an
error; listing a table that does not exist is an error.

## Other input formats

- `*.schema.md` — Markdown with ` ```dbschema ` fenced blocks. Multiple blocks in
  one file merge into a single schema, so relations may reference tables declared in
  another block. Good when the schema belongs inside a design document.
- `*.schema.json` — the JSON form, produced by **DBSchema: Export JSON**. Import is
  tolerant: unknown or missing fields are skipped with a diagnostic rather than
  failing the whole file.

## Diagnostics

A syntax error never discards the whole file — the parser skips the bad statement
and keeps the rest, so the Preview still renders what it could parse. Errors appear
in the Problems panel with file, line, column and a code:

| Code | Cause |
|---|---|
| `SCHEMA_PARSE_ERROR` | Syntax error |
| `SCHEMA_DUPLICATE_TABLE` / `_COLUMN` / `_INDEX` | Duplicate definition |
| `SCHEMA_UNKNOWN_TABLE` / `_COLUMN` | Reference to something undefined |
| `SCHEMA_RELATION_SOURCE_NOT_FOUND` / `_TARGET_NOT_FOUND` | Relation endpoint missing |
| `SCHEMA_INVALID_COMPOSITE_RELATION` | Composite relation sides do not line up |
| `SCHEMA_DUPLICATE_GROUP` / `SCHEMA_CONFLICTING_GROUP` | Group declared twice, or a table in two groups |

## Complete example

```text
// 部落格系統

group Identity "使用者與身分"
group Content  "文章、留言與標籤"

table Users "系統使用者" in Identity {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "文章" in Content {
  PK Id        bigint         not null "文章 ID"
  FK AuthorId  bigint         not null "作者，指向 Users"
     Title     nvarchar(200)  not null "文章標題"
     Status    nvarchar(20)   not null default "draft" "draft / published"
     CreatedAt datetime2      not null "發表時間"
}

index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
```

## Authoring advice

- Write a table comment and a comment on every non-obvious column. The diagram shows
  them inline, and they are the main reason a reader understands the schema.
- Name relations after the constraint they represent (`FK_<source>_<target>`).
- Group tables by functional module once a schema passes roughly 20 tables — the
  diagram can then draw module boundaries and filter by module.
