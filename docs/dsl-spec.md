# DBSchema DSL 規格 v1

> Stage 1 產出。此規格即 Parser（Stage 3）與 Validator（Stage 4）的契約。
> 修改語法前先改這份，再改 Parser。

---

## 1. 詞法

### 1.1 註解

```text
// 單行註解
```

`//` 之後到行尾忽略。字串內的 `//` 不算註解。

### 1.2 識別字

```text
Identifier ::= [A-Za-z_][A-Za-z0-9_]*
```

大小寫敏感（`Users` ≠ `users`）。關鍵字不區分大小寫（`TABLE` = `table`）。

### 1.3 字串

```text
"任意字元，可含中文，以 \" 逸出"
```

字串只用於 comment 與 default 值。

### 1.4 關鍵字

```text
table  index  relation  on  unique  not  null  default
PK  FK  UQ  IDX
```

`N` / `M` / `1` 只在 relation 的 cardinality 位置具有特殊意義。

### 1.5 換行

換行有意義：一個 column 定義佔一行，語句不跨行。

---

## 2. 檔案結構

```text
File ::= Statement*
Statement ::= TableDecl | IndexDecl | RelationDecl
```

語句之間的空行忽略。

---

## 3. Table

```text
TableDecl ::= "table" QualifiedName [String] "{" NEWLINE ColumnDef* "}"
QualifiedName ::= [Identifier "."] Identifier
```

省略 schema 時使用預設 schema `dbo`。Table 唯一 ID 為 `schema.name`。

```text
table Users "系統使用者" {
  PK Id bigint not null "使用者 ID"
}

table sales.Orders {
  PK Id bigint not null
}
```

---

## 4. Column

```text
ColumnDef  ::= KeyFlag* Identifier TypeRef [Nullability] [Default] [String]
KeyFlag    ::= "PK" | "FK" | "UQ" | "IDX"
TypeRef    ::= Identifier ["(" Number ["," Number] ")"]
Nullability::= "not" "null" | "null"
Default    ::= "default" (Number | String | Identifier)
```

規則：

| 項目 | 規則 |
|---|---|
| KeyFlag 順序 | 不限，可多個（`PK UQ Id`） |
| `PK` | 隱含 `not null` |
| 省略 Nullability | 預設 `null`（可為空），但 `PK` 例外 |
| `TypeRef` 一個參數 | 視為 `length`，例如 `nvarchar(255)` |
| `TypeRef` 兩個參數 | 視為 `precision, scale`，例如 `decimal(18,2)` |
| 尾端 String | 該欄位的 comment |
| `FK` | 只是視覺標記，**不會**自動建立 relation |
| `IDX` | 只是標記；真正的 index 用 `index` 語句 |

```text
table Products {
  PK  Id        bigint        not null "商品 ID"
  UQ  Sku       nvarchar(64)  not null
      Name      nvarchar(200) not null
      Price     decimal(18,2) not null default 0
      Note      nvarchar(4000) null "備註"
      IsActive  bit           not null default 1
}
```

---

## 4.5 Group（群組 / 功能模組）

```text
GroupDecl ::= "group" Identifier [String] ["{" NEWLINE (QualifiedName [","] NEWLINE?)* "}"]
```

`group` 與 `in` 是 **soft keyword**：只有在這些語法位置才具特殊意義，
因此 `Group nvarchar(50)` 這種欄位名不受影響。

群組與 `schema` 是**不同維度**：schema 是資料庫命名空間，group 是人為的功能分類，可以跨 schema。

兩種標記方式，可混用：

```text
// 一、集中宣告並列出成員
group Identity "身分與權限模組" {
  Users
  Roles
  sales.Customers
}

// 二、描述集中宣告，成員標在各自的 table 上
group Sales "訂單與金流"

table Orders in Sales {
  PK Id bigint not null
}
```

規則：

| 項目 | 規則 |
|---|---|
| 成員關係 | 只存在 `Table.group`，宣告區塊會寫回該欄位 |
| 群組描述 | 只存在宣告上，不會在每張表重複 |
| 未宣告的群組 | `table X in G` 而 G 沒宣告時，視為隱含存在（無描述） |
| 一表一群組 | 同時被指定到兩個群組 → `SCHEMA_CONFLICTING_GROUP` |
| 重複宣告 | 同名 group 宣告兩次 → `SCHEMA_DUPLICATE_GROUP` |
| 未知成員 | 群組列出不存在的表 → `SCHEMA_UNKNOWN_TABLE` |
| 成員分隔 | 換行或逗號皆可 |

---

## 5. Index

```text
IndexDecl ::= ["unique"] "index" Identifier "on" QualifiedName "(" ColumnList ")"
ColumnList ::= Identifier ("," Identifier)*
```

Index 獨立建模，composite index 依列出順序保存。

```text
index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)
unique index UX_Users_Email on Users(Email)
```

---

## 6. Relation

```text
RelationDecl ::= "relation" Identifier "{" NEWLINE Mapping+ "}"
Mapping      ::= ColumnRef Cardinality "->" Cardinality ColumnRef
ColumnRef    ::= QualifiedName "." Identifier
               | QualifiedName "." "(" ColumnList ")"
Cardinality  ::= "1" | "N" | "M"
```

Cardinality 對照：

| 寫法 | Relation.cardinality |
|---|---|
| `N -> 1` | `N:1` |
| `1 -> N` | `1:N` |
| `1 -> 1` | `1:1` |
| `N -> N` / `N -> M` | `N:M` |

方向固定為 **FK Source → Referenced Target**，即箭頭左邊持有外鍵。
這個方向同時決定 Upstream / Downstream 的語意。

```text
relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
```

Composite FK：

```text
relation FK_OrderLines_Orders {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}
```

一個 `relation` 區塊可含多行 Mapping，但所有 Mapping 必須指向同一組來源／目標 Table，
否則回報 `SCHEMA_INVALID_COMPOSITE_RELATION`。

---

## 7. 完整範例

```text
// 部落格系統

table Users "系統使用者" {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "文章" {
  PK Id        bigint         not null
  FK AuthorId  bigint         not null "作者"
     Title     nvarchar(200)  not null
     Content   nvarchar(4000) null
     CreatedAt datetime2      not null
}

index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}
```

---

## 8. 錯誤處理原則

Parser **不得**因單一語法錯誤中止整份檔案（US10）。

- 遇到無法解析的語句 → 記錄診斷，跳到下一個語句起點（`table` / `index` / `relation` 或 `}`）繼續。
- 已成功解析的部分仍要產生 Schema，讓 Preview 顯示可理解的部分畫面。
- 每個診斷都必須帶 `file` / `line` / `column` / `code` / `message`。

錯誤碼見 `schema-core/src/errors.ts` 的 `SchemaErrorCode`。
