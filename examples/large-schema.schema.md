# 大型 Schema 範例（150 張資料表）

用來驗證大型 Schema 的探索體驗（plan §21、AC-20）。
在此檔案上執行 `DBSchema: Open Preview`，然後依序試：

| 操作 | 預期 |
|---|---|
| `Ctrl`/`Cmd` + `F` 搜尋 `Orders` | 跳到該表並聚焦，其餘淡化 |
| 搜尋欄位 `CreatedAt` | 列出所有含此欄位的表，點擊後高亮該欄位 |
| 深度按 `+` 調到 3～4 層 | 逐層往外展開，觀察範圍怎麼變大 |
| 深度切 `全部` | 整個連通元件都算相關 |
| 方向切 `上游` | 只看這張表依賴哪些表 |
| 方向切 `下游` | 只看哪些表依賴這張表 |
| 不相關切 `隱藏` | 不相關的表直接消失 |
| 欄位顯示切 `只有表名` | 只剩表名與關聯，適合全局導覽 |
| 備註切 `換行` | 欄位備註展開成多行 |
| 群組下拉選某個模組 | 只留該模組的表，其餘淡到幾乎看不見 |
| 排版切 `依關聯` | 不再依群組聚攏，關聯線最短；群組外框隨之消失 |
| 排版切回 `依群組` | 同模組的表聚成一塊並畫出外框 |
| 點某個欄位（例如某張表的 Id） | 只亮該欄位與透過 FK 對應的欄位，其餘欄位變雜訊 |
| 再點同一個欄位 | 取消欄位聚焦 |
| 拖曳卡片 | 自行調整版面，關聯線跟著走 |
| 雙擊欄位 | 跳回本檔案對應的那一行 |

分成 10 個模組區塊，最後一塊是跨模組關聯；
DBSchema 會把所有 ```dbschema 區塊合併成同一份 Schema。

> 本檔由 `npm run example:large` 產生，請勿手動編輯。

---

## 群組（10 個功能模組）

```dbschema
group Identity "使用者、角色與登入"
group Catalog "商品目錄與定價"
group Sales "訂單與購物車"
group Billing "帳務與金流"
group Shipping "出貨與物流"
group Support "客服工單"
group Analytics "事件與報表"
group Content "文章與版面"
group Inventory "庫存與採購"
group Audit "稽核與設定"
```

## identity（15 張表）

```dbschema
table identity.Users "使用者" in Identity {
  PK  Id         bigint           not null "使用者識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Roles "角色" in Identity {
  PK  Id          bigint           not null "角色識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
  FK  WarehouseId bigint           not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Permissions "權限" in Identity {
  PK  Id          bigint         not null "權限識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Sessions "登入工作階段" in Identity {
  PK  Id         bigint           not null "登入工作階段識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Tokens "存取權杖" in Identity {
  PK    Id        bigint         not null "存取權杖識別碼"
  UQ    Code      nvarchar(64)   not null "業務代碼"
        Locale    nvarchar(10)   not null default "zh-TW" "語系"
        SortOrder int            not null default 0 "排序順序"
        Metadata  nvarchar(4000) null     "附加資料（JSON）"
        Version   int            not null default 1 "版本號"
        Notes     nvarchar(1000) null     "備註"
        Priority  int            not null default 0 "優先順序"
  FK    RoleId    bigint         not null "參照 identity.Roles"
  FK UQ TicketId  bigint         null     "參照 support.Tickets"
  IDX   CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Users2 "使用者" in Identity {
  PK  Id          bigint           not null "使用者識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  TagId       bigint           not null "參照 support.Tags"
  FK  RoleId      bigint           not null "參照 identity.Roles"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Roles2 "角色" in Identity {
  PK  Id        bigint         not null "角色識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Slug      nvarchar(120)  null     "網址代稱"
      Locale    nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
  FK  TicketId  bigint         not null "參照 support.Tickets"
  FK  InvoiceId bigint         not null "參照 billing.Invoices"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Permissions2 "權限" in Identity {
  PK  Id         bigint           not null "權限識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
  FK  AddressId  bigint           not null "參照 shipping.Addresses"
  FK  InvoiceId  bigint           not null "參照 billing.Invoices"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Sessions2 "登入工作階段" in Identity {
  PK  Id        bigint         not null "登入工作階段識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Locale    nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
  FK  PaymentId bigint         not null "參照 billing.Payments"
  FK  AddressId bigint         not null "參照 shipping.Addresses"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Tokens2 "存取權杖" in Identity {
  PK  Id          bigint         not null "存取權杖識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Users3 "使用者" in Identity {
  PK  Id         bigint           not null "使用者識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Roles3 "角色" in Identity {
  PK  Id         bigint           not null "角色識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Permissions3 "權限" in Identity {
  PK  Id          bigint           not null "權限識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Sessions3 "登入工作階段" in Identity {
  PK  Id          bigint         not null "登入工作階段識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(200)  not null "標題"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Tokens3 "存取權杖" in Identity {
  PK  Id        bigint         not null "存取權杖識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Users_Code on identity.Users(Code)
index IX_Users_CreatedAt on identity.Users(CreatedAt)
unique index UX_Roles_Code on identity.Roles(Code)
index IX_Roles_CreatedAt on identity.Roles(CreatedAt)
index IX_Roles_WarehouseId on identity.Roles(WarehouseId)
unique index UX_Permissions_Code on identity.Permissions(Code)
index IX_Permissions_CreatedAt on identity.Permissions(CreatedAt)
index IX_Permissions_WarehouseId on identity.Permissions(WarehouseId)
unique index UX_Sessions_Code on identity.Sessions(Code)
index IX_Sessions_CreatedAt on identity.Sessions(CreatedAt)
unique index UX_Tokens_Code on identity.Tokens(Code)
index IX_Tokens_CreatedAt on identity.Tokens(CreatedAt)
index IX_Tokens_RoleId on identity.Tokens(RoleId)
index IX_Tokens_TicketId on identity.Tokens(TicketId)
unique index UX_Users2_Code on identity.Users2(Code)
index IX_Users2_CreatedAt on identity.Users2(CreatedAt)
index IX_Users2_TagId on identity.Users2(TagId)
index IX_Users2_RoleId on identity.Users2(RoleId)
unique index UX_Roles2_Code on identity.Roles2(Code)
index IX_Roles2_CreatedAt on identity.Roles2(CreatedAt)
index IX_Roles2_TicketId on identity.Roles2(TicketId)
index IX_Roles2_InvoiceId on identity.Roles2(InvoiceId)
unique index UX_Permissions2_Code on identity.Permissions2(Code)
index IX_Permissions2_CreatedAt on identity.Permissions2(CreatedAt)
index IX_Permissions2_AddressId on identity.Permissions2(AddressId)
index IX_Permissions2_InvoiceId on identity.Permissions2(InvoiceId)
unique index UX_Sessions2_Code on identity.Sessions2(Code)
index IX_Sessions2_CreatedAt on identity.Sessions2(CreatedAt)
index IX_Sessions2_PaymentId on identity.Sessions2(PaymentId)
index IX_Sessions2_AddressId on identity.Sessions2(AddressId)
unique index UX_Tokens2_Code on identity.Tokens2(Code)
index IX_Tokens2_CreatedAt on identity.Tokens2(CreatedAt)
unique index UX_Users3_Code on identity.Users3(Code)
index IX_Users3_CreatedAt on identity.Users3(CreatedAt)
index IX_Users3_MetricId on identity.Users3(MetricId)
unique index UX_Roles3_Code on identity.Roles3(Code)
index IX_Roles3_CreatedAt on identity.Roles3(CreatedAt)
unique index UX_Permissions3_Code on identity.Permissions3(Code)
index IX_Permissions3_CreatedAt on identity.Permissions3(CreatedAt)
unique index UX_Sessions3_Code on identity.Sessions3(Code)
index IX_Sessions3_CreatedAt on identity.Sessions3(CreatedAt)
unique index UX_Tokens3_Code on identity.Tokens3(Code)
index IX_Tokens3_CreatedAt on identity.Tokens3(CreatedAt)
```

## catalog（15 張表）

```dbschema
table catalog.Products "商品" in Catalog {
  PK  Id         bigint           not null "商品識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  FK  UserId     bigint           not null "參照 identity.Users"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Categories "分類" in Catalog {
  PK  Id          bigint         not null "分類識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Brands "品牌" in Catalog {
  PK  Id         bigint           not null "品牌識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Variants "商品規格" in Catalog {
  PK  Id        bigint         not null "商品規格識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
  FK  RoleId    bigint         not null "參照 identity.Roles"
  FK  InvoiceId bigint         not null "參照 billing.Invoices"
  FK  CartId    bigint         not null "參照 sales.Carts"
  FK  MessageId bigint         not null "參照 support.Messages"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Prices "價格" in Catalog {
  PK  Id          bigint         not null "價格識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Slug        nvarchar(120)  null     "網址代稱"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  OrderId     bigint         not null "參照 sales.Orders"
  FK  SessionId   bigint         not null "參照 identity.Sessions"
  FK  PaymentId   bigint         not null "參照 billing.Payments"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Products2 "商品" in Catalog {
  PK  Id          bigint       not null "商品識別碼"
  UQ  Code        nvarchar(64) not null "業務代碼"
      Quantity    int          not null default 0 "數量"
      StartsAt    datetime2    null     "生效時間"
      EndsAt      datetime2    null     "失效時間"
  FK  WarehouseId bigint       not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2    not null default "sysutcdatetime()" "建立時間"
}

table catalog.Categories2 "分類" in Catalog {
  PK  Id          bigint         not null "分類識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  FK  AuditLogId  bigint         not null "參照 audit.AuditLogs"
  FK  ChangeId    bigint         not null "參照 audit.Changes"
  FK  Order2Id    bigint         not null "參照 sales.Orders2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Brands2 "品牌" in Catalog {
  PK  Id         bigint           not null "品牌識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
  FK  ShipmentId bigint           not null "參照 shipping.Shipments"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Variants2 "商品規格" in Catalog {
  PK  Id         bigint           not null "商品規格識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Prices2 "價格" in Catalog {
  PK  Id          bigint         not null "價格識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Products3 "商品" in Catalog {
  PK  Id          bigint         not null "商品識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Categories3 "分類" in Catalog {
  PK  Id          bigint         not null "分類識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Brands3 "品牌" in Catalog {
  PK  Id         bigint        not null "品牌識別碼"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      Amount     decimal(18,2) not null default 0 "金額"
      Quantity   int           not null default 0 "數量"
      StartsAt   datetime2     null     "生效時間"
  FK  Product3Id bigint        not null "參照 catalog.Products3"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table catalog.Variants3 "商品規格" in Catalog {
  PK  Id          bigint         not null "商品規格識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Prices3 "價格" in Catalog {
  PK  Id         bigint           not null "價格識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Products_Code on catalog.Products(Code)
index IX_Products_CreatedAt on catalog.Products(CreatedAt)
index IX_Products_UserId on catalog.Products(UserId)
unique index UX_Categories_Code on catalog.Categories(Code)
index IX_Categories_CreatedAt on catalog.Categories(CreatedAt)
index IX_Categories_ProductId on catalog.Categories(ProductId)
index IX_Categories_WarehouseId on catalog.Categories(WarehouseId)
unique index UX_Brands_Code on catalog.Brands(Code)
index IX_Brands_CreatedAt on catalog.Brands(CreatedAt)
unique index UX_Variants_Code on catalog.Variants(Code)
index IX_Variants_CreatedAt on catalog.Variants(CreatedAt)
index IX_Variants_RoleId on catalog.Variants(RoleId)
index IX_Variants_InvoiceId on catalog.Variants(InvoiceId)
index IX_Variants_CartId on catalog.Variants(CartId)
index IX_Variants_MessageId on catalog.Variants(MessageId)
unique index UX_Prices_Code on catalog.Prices(Code)
index IX_Prices_CreatedAt on catalog.Prices(CreatedAt)
index IX_Prices_OrderId on catalog.Prices(OrderId)
index IX_Prices_SessionId on catalog.Prices(SessionId)
index IX_Prices_PaymentId on catalog.Prices(PaymentId)
unique index UX_Products2_Code on catalog.Products2(Code)
index IX_Products2_CreatedAt on catalog.Products2(CreatedAt)
index IX_Products2_WarehouseId on catalog.Products2(WarehouseId)
unique index UX_Categories2_Code on catalog.Categories2(Code)
index IX_Categories2_CreatedAt on catalog.Categories2(CreatedAt)
index IX_Categories2_AuditLogId on catalog.Categories2(AuditLogId)
index IX_Categories2_ChangeId on catalog.Categories2(ChangeId)
index IX_Categories2_Order2Id on catalog.Categories2(Order2Id)
unique index UX_Brands2_Code on catalog.Brands2(Code)
index IX_Brands2_CreatedAt on catalog.Brands2(CreatedAt)
index IX_Brands2_ShipmentId on catalog.Brands2(ShipmentId)
unique index UX_Variants2_Code on catalog.Variants2(Code)
index IX_Variants2_CreatedAt on catalog.Variants2(CreatedAt)
unique index UX_Prices2_Code on catalog.Prices2(Code)
index IX_Prices2_CreatedAt on catalog.Prices2(CreatedAt)
unique index UX_Products3_Code on catalog.Products3(Code)
index IX_Products3_CreatedAt on catalog.Products3(CreatedAt)
unique index UX_Categories3_Code on catalog.Categories3(Code)
index IX_Categories3_CreatedAt on catalog.Categories3(CreatedAt)
index IX_Categories3_OrderItemId on catalog.Categories3(OrderItemId)
unique index UX_Brands3_Code on catalog.Brands3(Code)
index IX_Brands3_CreatedAt on catalog.Brands3(CreatedAt)
index IX_Brands3_Product3Id on catalog.Brands3(Product3Id)
unique index UX_Variants3_Code on catalog.Variants3(Code)
index IX_Variants3_CreatedAt on catalog.Variants3(CreatedAt)
index IX_Variants3_OrderItemId on catalog.Variants3(OrderItemId)
unique index UX_Prices3_Code on catalog.Prices3(Code)
index IX_Prices3_CreatedAt on catalog.Prices3(CreatedAt)
```

## sales（15 張表）

```dbschema
table sales.Orders "訂單" in Sales {
  PK  Id        bigint         not null "訂單識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Locale    nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
  FK  UserId    bigint         not null "參照 identity.Users"
  FK  ProductId bigint         not null "參照 catalog.Products"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.OrderItems "訂單明細" in Sales {
  PK  Id         bigint         not null "訂單明細識別碼"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      Version    int            not null default 1 "版本號"
      Notes      nvarchar(1000) null     "備註"
      Priority   int            not null default 0 "優先順序"
      Score      decimal(9,2)   null     "評分"
  FK  ShipmentId bigint         not null "參照 shipping.Shipments"
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Carts "購物車" in Sales {
  PK  Id         bigint           not null "購物車識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  FK  InvoiceId  bigint           not null "參照 billing.Invoices"
  FK  RoleId     bigint           not null "參照 identity.Roles"
  FK  EventId    bigint           not null "參照 analytics.Events"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.CartItems "購物車項目" in Sales {
  PK  Id          bigint           not null "購物車項目識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
  FK  CategoryId  bigint           not null "參照 catalog.Categories"
  FK  OrderItemId bigint           not null "參照 sales.OrderItems"
  FK  TicketId    bigint           not null "參照 support.Tickets"
  FK  PaymentId   bigint           not null "參照 billing.Payments"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Coupons "折價券" in Sales {
  PK  Id         bigint           not null "折價券識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
      Name       nvarchar(200)    not null "名稱"
  FK  RoleId     bigint           not null "參照 identity.Roles"
  FK  ProductId  bigint           not null "參照 catalog.Products"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Orders2 "訂單" in Sales {
  PK  Id          bigint           not null "訂單識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.OrderItems2 "訂單明細" in Sales {
  PK  Id          bigint         not null "訂單明細識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
  FK  PriceId     bigint         not null "參照 catalog.Prices"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  FK  User2Id     bigint         not null "參照 identity.Users2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Carts2 "購物車" in Sales {
  PK  Id          bigint         not null "購物車識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.CartItems2 "購物車項目" in Sales {
  PK  Id          bigint           not null "購物車項目識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       nvarchar(200)    not null "標題"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  PaymentId   bigint           not null "參照 billing.Payments"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Coupons2 "折價券" in Sales {
  PK  Id          bigint         not null "折價券識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
  FK  ShipmentId  bigint         not null "參照 shipping.Shipments"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Orders3 "訂單" in Sales {
  PK  Id          bigint           not null "訂單識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
  FK  RoleId      bigint           not null "參照 identity.Roles"
  FK  EventId     bigint           not null "參照 analytics.Events"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.OrderItems3 "訂單明細" in Sales {
  PK  Id         bigint           not null "訂單明細識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
  FK  UserId     bigint           not null "參照 identity.Users"
  FK  CouponId   bigint           not null "參照 sales.Coupons"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Carts3 "購物車" in Sales {
  PK  Id          bigint           not null "購物車識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Priority    int              not null default 0 "優先順序"
      Score       decimal(9,2)     null     "評分"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  TicketId    bigint           not null "參照 support.Tickets"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.CartItems3 "購物車項目" in Sales {
  PK    Id          bigint         not null "購物車項目識別碼"
  UQ    Code        nvarchar(64)   not null "業務代碼"
        Description nvarchar(4000) null     "描述"
        Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
        Amount      decimal(18,2)  not null default 0 "金額"
  FK UQ TicketId    bigint         null     "參照 support.Tickets"
  IDX   CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Coupons3 "折價券" in Sales {
  PK  Id          bigint         not null "折價券識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Orders_Code on sales.Orders(Code)
index IX_Orders_CreatedAt on sales.Orders(CreatedAt)
index IX_Orders_UserId on sales.Orders(UserId)
index IX_Orders_ProductId on sales.Orders(ProductId)
unique index UX_OrderItems_Code on sales.OrderItems(Code)
index IX_OrderItems_CreatedAt on sales.OrderItems(CreatedAt)
index IX_OrderItems_ShipmentId on sales.OrderItems(ShipmentId)
unique index UX_Carts_Code on sales.Carts(Code)
index IX_Carts_CreatedAt on sales.Carts(CreatedAt)
index IX_Carts_InvoiceId on sales.Carts(InvoiceId)
index IX_Carts_RoleId on sales.Carts(RoleId)
index IX_Carts_EventId on sales.Carts(EventId)
unique index UX_CartItems_Code on sales.CartItems(Code)
index IX_CartItems_CreatedAt on sales.CartItems(CreatedAt)
index IX_CartItems_CategoryId on sales.CartItems(CategoryId)
index IX_CartItems_OrderItemId on sales.CartItems(OrderItemId)
index IX_CartItems_TicketId on sales.CartItems(TicketId)
index IX_CartItems_PaymentId on sales.CartItems(PaymentId)
unique index UX_Coupons_Code on sales.Coupons(Code)
index IX_Coupons_CreatedAt on sales.Coupons(CreatedAt)
index IX_Coupons_RoleId on sales.Coupons(RoleId)
index IX_Coupons_ProductId on sales.Coupons(ProductId)
unique index UX_Orders2_Code on sales.Orders2(Code)
index IX_Orders2_CreatedAt on sales.Orders2(CreatedAt)
unique index UX_OrderItems2_Code on sales.OrderItems2(Code)
index IX_OrderItems2_CreatedAt on sales.OrderItems2(CreatedAt)
index IX_OrderItems2_PriceId on sales.OrderItems2(PriceId)
index IX_OrderItems2_CategoryId on sales.OrderItems2(CategoryId)
index IX_OrderItems2_User2Id on sales.OrderItems2(User2Id)
unique index UX_Carts2_Code on sales.Carts2(Code)
index IX_Carts2_CreatedAt on sales.Carts2(CreatedAt)
unique index UX_CartItems2_Code on sales.CartItems2(Code)
index IX_CartItems2_CreatedAt on sales.CartItems2(CreatedAt)
index IX_CartItems2_PaymentId on sales.CartItems2(PaymentId)
unique index UX_Coupons2_Code on sales.Coupons2(Code)
index IX_Coupons2_CreatedAt on sales.Coupons2(CreatedAt)
index IX_Coupons2_ShipmentId on sales.Coupons2(ShipmentId)
index IX_Coupons2_ProductId on sales.Coupons2(ProductId)
unique index UX_Orders3_Code on sales.Orders3(Code)
index IX_Orders3_CreatedAt on sales.Orders3(CreatedAt)
index IX_Orders3_RoleId on sales.Orders3(RoleId)
index IX_Orders3_EventId on sales.Orders3(EventId)
unique index UX_OrderItems3_Code on sales.OrderItems3(Code)
index IX_OrderItems3_CreatedAt on sales.OrderItems3(CreatedAt)
index IX_OrderItems3_UserId on sales.OrderItems3(UserId)
index IX_OrderItems3_CouponId on sales.OrderItems3(CouponId)
unique index UX_Carts3_Code on sales.Carts3(Code)
index IX_Carts3_CreatedAt on sales.Carts3(CreatedAt)
index IX_Carts3_TicketId on sales.Carts3(TicketId)
unique index UX_CartItems3_Code on sales.CartItems3(Code)
index IX_CartItems3_CreatedAt on sales.CartItems3(CreatedAt)
index IX_CartItems3_TicketId on sales.CartItems3(TicketId)
unique index UX_Coupons3_Code on sales.Coupons3(Code)
index IX_Coupons3_CreatedAt on sales.Coupons3(CreatedAt)
index IX_Coupons3_CategoryId on sales.Coupons3(CategoryId)
```

## billing（15 張表）

```dbschema
table billing.Invoices "發票" in Billing {
  PK  Id          bigint         not null "發票識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Payments "付款" in Billing {
  PK  Id        bigint         not null "付款識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
  FK  UserId    bigint         not null "參照 identity.Users"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Refunds "退款" in Billing {
  PK  Id          bigint           not null "退款識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
      Metadata    nvarchar(4000)   null     "附加資料（JSON）"
  FK  UserId      bigint           not null "參照 identity.Users"
  FK  PaymentId   bigint           not null "參照 billing.Payments"
  FK  WarehouseId bigint           not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Ledgers "分類帳" in Billing {
  PK  Id          bigint           not null "分類帳識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  EventId     bigint           not null "參照 analytics.Events"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Taxes "稅務設定" in Billing {
  PK  Id        bigint        not null "稅務設定識別碼"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      Priority  int           not null default 0 "優先順序"
      Score     decimal(9,2)  null     "評分"
      Name      nvarchar(200) not null "名稱"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table billing.Invoices2 "發票" in Billing {
  PK  Id          bigint           not null "發票識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  ShipmentId  bigint           not null "參照 shipping.Shipments"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Payments2 "付款" in Billing {
  PK  Id          bigint         not null "付款識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  InvoiceId   bigint         not null "參照 billing.Invoices"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Refunds2 "退款" in Billing {
  PK  Id          bigint         not null "退款識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  Invoice2Id  bigint         not null "參照 billing.Invoices2"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Ledgers2 "分類帳" in Billing {
  PK  Id         bigint           not null "分類帳識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Taxes2 "稅務設定" in Billing {
  PK  Id          bigint         not null "稅務設定識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
  FK  EventId     bigint         not null "參照 analytics.Events"
  FK  Category2Id bigint         not null "參照 catalog.Categories2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Invoices3 "發票" in Billing {
  PK  Id         bigint           not null "發票識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Payments3 "付款" in Billing {
  PK  Id         bigint           not null "付款識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
  FK  PostId     bigint           not null "參照 content.Posts"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Refunds3 "退款" in Billing {
  PK  Id          bigint           not null "退款識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  PostId      bigint           not null "參照 content.Posts"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Ledgers3 "分類帳" in Billing {
  PK  Id         bigint           not null "分類帳識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Taxes3 "稅務設定" in Billing {
  PK  Id         bigint           not null "稅務設定識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Invoices_Code on billing.Invoices(Code)
index IX_Invoices_CreatedAt on billing.Invoices(CreatedAt)
unique index UX_Payments_Code on billing.Payments(Code)
index IX_Payments_CreatedAt on billing.Payments(CreatedAt)
index IX_Payments_UserId on billing.Payments(UserId)
unique index UX_Refunds_Code on billing.Refunds(Code)
index IX_Refunds_CreatedAt on billing.Refunds(CreatedAt)
index IX_Refunds_UserId on billing.Refunds(UserId)
index IX_Refunds_PaymentId on billing.Refunds(PaymentId)
index IX_Refunds_WarehouseId on billing.Refunds(WarehouseId)
unique index UX_Ledgers_Code on billing.Ledgers(Code)
index IX_Ledgers_CreatedAt on billing.Ledgers(CreatedAt)
index IX_Ledgers_EventId on billing.Ledgers(EventId)
unique index UX_Taxes_Code on billing.Taxes(Code)
index IX_Taxes_CreatedAt on billing.Taxes(CreatedAt)
unique index UX_Invoices2_Code on billing.Invoices2(Code)
index IX_Invoices2_CreatedAt on billing.Invoices2(CreatedAt)
index IX_Invoices2_ShipmentId on billing.Invoices2(ShipmentId)
unique index UX_Payments2_Code on billing.Payments2(Code)
index IX_Payments2_CreatedAt on billing.Payments2(CreatedAt)
index IX_Payments2_InvoiceId on billing.Payments2(InvoiceId)
unique index UX_Refunds2_Code on billing.Refunds2(Code)
index IX_Refunds2_CreatedAt on billing.Refunds2(CreatedAt)
index IX_Refunds2_Invoice2Id on billing.Refunds2(Invoice2Id)
index IX_Refunds2_OrderItemId on billing.Refunds2(OrderItemId)
unique index UX_Ledgers2_Code on billing.Ledgers2(Code)
index IX_Ledgers2_CreatedAt on billing.Ledgers2(CreatedAt)
unique index UX_Taxes2_Code on billing.Taxes2(Code)
index IX_Taxes2_CreatedAt on billing.Taxes2(CreatedAt)
index IX_Taxes2_EventId on billing.Taxes2(EventId)
index IX_Taxes2_Category2Id on billing.Taxes2(Category2Id)
unique index UX_Invoices3_Code on billing.Invoices3(Code)
index IX_Invoices3_CreatedAt on billing.Invoices3(CreatedAt)
unique index UX_Payments3_Code on billing.Payments3(Code)
index IX_Payments3_CreatedAt on billing.Payments3(CreatedAt)
index IX_Payments3_PostId on billing.Payments3(PostId)
unique index UX_Refunds3_Code on billing.Refunds3(Code)
index IX_Refunds3_CreatedAt on billing.Refunds3(CreatedAt)
index IX_Refunds3_PostId on billing.Refunds3(PostId)
unique index UX_Ledgers3_Code on billing.Ledgers3(Code)
index IX_Ledgers3_CreatedAt on billing.Ledgers3(CreatedAt)
unique index UX_Taxes3_Code on billing.Taxes3(Code)
index IX_Taxes3_CreatedAt on billing.Taxes3(CreatedAt)
index IX_Taxes3_MetricId on billing.Taxes3(MetricId)
```

## shipping（15 張表）

```dbschema
table shipping.Shipments "出貨單" in Shipping {
  PK  Id         bigint           not null "出貨單識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
  FK  OrderId    bigint           not null "參照 sales.Orders"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Addresses "地址" in Shipping {
  PK  Id         bigint           not null "地址識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  FK  PaymentId  bigint           not null "參照 billing.Payments"
  FK  InvoiceId  bigint           not null "參照 billing.Invoices"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Carriers "物流商" in Shipping {
  PK  Id          bigint         not null "物流商識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  ShipmentId  bigint         not null "參照 shipping.Shipments"
  FK  UserId      bigint         not null "參照 identity.Users"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Packages "包裹" in Shipping {
  PK  Id          bigint           not null "包裹識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       nvarchar(200)    not null "標題"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
  FK  WarehouseId bigint           not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings "追蹤紀錄" in Shipping {
  PK  Id          bigint         not null "追蹤紀錄識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  RoleId      bigint         not null "參照 identity.Roles"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Shipments2 "出貨單" in Shipping {
  PK  Id          bigint         not null "出貨單識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Addresses2 "地址" in Shipping {
  PK  Id          bigint           not null "地址識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Carriers2 "物流商" in Shipping {
  PK  Id         bigint           not null "物流商識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  FK  LedgerId   bigint           not null "參照 billing.Ledgers"
  FK  Cart2Id    bigint           not null "參照 sales.Carts2"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Packages2 "包裹" in Shipping {
  PK  Id        bigint         not null "包裹識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings2 "追蹤紀錄" in Shipping {
  PK  Id         bigint           not null "追蹤紀錄識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Shipments3 "出貨單" in Shipping {
  PK  Id          bigint         not null "出貨單識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  FK  InvoiceId   bigint         not null "參照 billing.Invoices"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Addresses3 "地址" in Shipping {
  PK  Id         bigint         not null "地址識別碼"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      Locale     nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder  int            not null default 0 "排序順序"
      Metadata   nvarchar(4000) null     "附加資料（JSON）"
  FK  RoleId     bigint         not null "參照 identity.Roles"
  FK  Invoice2Id bigint         not null "參照 billing.Invoices2"
  FK  CommentId  bigint         not null "參照 content.Comments"
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Carriers3 "物流商" in Shipping {
  PK  Id         bigint           not null "物流商識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
  FK  CommentId  bigint           not null "參照 content.Comments"
  FK  UserId     bigint           not null "參照 identity.Users"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Packages3 "包裹" in Shipping {
  PK  Id          bigint         not null "包裹識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  MetricId    bigint         not null "參照 analytics.Metrics"
  FK  TicketId    bigint         not null "參照 support.Tickets"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings3 "追蹤紀錄" in Shipping {
  PK  Id         bigint           not null "追蹤紀錄識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Shipments_Code on shipping.Shipments(Code)
index IX_Shipments_CreatedAt on shipping.Shipments(CreatedAt)
index IX_Shipments_OrderId on shipping.Shipments(OrderId)
unique index UX_Addresses_Code on shipping.Addresses(Code)
index IX_Addresses_CreatedAt on shipping.Addresses(CreatedAt)
index IX_Addresses_PaymentId on shipping.Addresses(PaymentId)
index IX_Addresses_InvoiceId on shipping.Addresses(InvoiceId)
unique index UX_Carriers_Code on shipping.Carriers(Code)
index IX_Carriers_CreatedAt on shipping.Carriers(CreatedAt)
index IX_Carriers_ShipmentId on shipping.Carriers(ShipmentId)
index IX_Carriers_UserId on shipping.Carriers(UserId)
unique index UX_Packages_Code on shipping.Packages(Code)
index IX_Packages_CreatedAt on shipping.Packages(CreatedAt)
index IX_Packages_WarehouseId on shipping.Packages(WarehouseId)
unique index UX_Trackings_Code on shipping.Trackings(Code)
index IX_Trackings_CreatedAt on shipping.Trackings(CreatedAt)
index IX_Trackings_RoleId on shipping.Trackings(RoleId)
index IX_Trackings_ProductId on shipping.Trackings(ProductId)
unique index UX_Shipments2_Code on shipping.Shipments2(Code)
index IX_Shipments2_CreatedAt on shipping.Shipments2(CreatedAt)
unique index UX_Addresses2_Code on shipping.Addresses2(Code)
index IX_Addresses2_CreatedAt on shipping.Addresses2(CreatedAt)
unique index UX_Carriers2_Code on shipping.Carriers2(Code)
index IX_Carriers2_CreatedAt on shipping.Carriers2(CreatedAt)
index IX_Carriers2_LedgerId on shipping.Carriers2(LedgerId)
index IX_Carriers2_Cart2Id on shipping.Carriers2(Cart2Id)
unique index UX_Packages2_Code on shipping.Packages2(Code)
index IX_Packages2_CreatedAt on shipping.Packages2(CreatedAt)
unique index UX_Trackings2_Code on shipping.Trackings2(Code)
index IX_Trackings2_CreatedAt on shipping.Trackings2(CreatedAt)
unique index UX_Shipments3_Code on shipping.Shipments3(Code)
index IX_Shipments3_CreatedAt on shipping.Shipments3(CreatedAt)
index IX_Shipments3_WarehouseId on shipping.Shipments3(WarehouseId)
index IX_Shipments3_InvoiceId on shipping.Shipments3(InvoiceId)
index IX_Shipments3_ProductId on shipping.Shipments3(ProductId)
unique index UX_Addresses3_Code on shipping.Addresses3(Code)
index IX_Addresses3_CreatedAt on shipping.Addresses3(CreatedAt)
index IX_Addresses3_RoleId on shipping.Addresses3(RoleId)
index IX_Addresses3_Invoice2Id on shipping.Addresses3(Invoice2Id)
index IX_Addresses3_CommentId on shipping.Addresses3(CommentId)
unique index UX_Carriers3_Code on shipping.Carriers3(Code)
index IX_Carriers3_CreatedAt on shipping.Carriers3(CreatedAt)
index IX_Carriers3_CommentId on shipping.Carriers3(CommentId)
index IX_Carriers3_UserId on shipping.Carriers3(UserId)
unique index UX_Packages3_Code on shipping.Packages3(Code)
index IX_Packages3_CreatedAt on shipping.Packages3(CreatedAt)
index IX_Packages3_MetricId on shipping.Packages3(MetricId)
index IX_Packages3_TicketId on shipping.Packages3(TicketId)
unique index UX_Trackings3_Code on shipping.Trackings3(Code)
index IX_Trackings3_CreatedAt on shipping.Trackings3(CreatedAt)
```

## support（15 張表）

```dbschema
table support.Tickets "工單" in Support {
  PK  Id          bigint         not null "工單識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  ShipmentId  bigint         not null "參照 shipping.Shipments"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Messages "訊息" in Support {
  PK  Id         bigint           not null "訊息識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
  FK  PostId     bigint           not null "參照 content.Posts"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Attachments "附件" in Support {
  PK  Id        bigint       not null "附件識別碼"
  UQ  Code      nvarchar(64) not null "業務代碼"
      Quantity  int          not null default 0 "數量"
      StartsAt  datetime2    null     "生效時間"
      EndsAt    datetime2    null     "失效時間"
      IsActive  bit          not null default 1 "是否啟用"
  IDX CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table support.Tags "標籤" in Support {
  PK  Id          bigint         not null "標籤識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(200)  not null "標題"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Notes "內部註記" in Support {
  PK    Id          bigint           not null "內部註記識別碼"
  UQ    Code        nvarchar(64)     not null "業務代碼"
        StartsAt    datetime2        null     "生效時間"
        EndsAt      datetime2        null     "失效時間"
        IsActive    bit              not null default 1 "是否啟用"
        ExternalId  uniqueidentifier null     "外部系統識別碼"
        Slug        nvarchar(120)    null     "網址代稱"
        Locale      nvarchar(10)     not null default "zh-TW" "語系"
        SortOrder   int              not null default 0 "排序順序"
  FK UQ OrderItemId bigint           null     "參照 sales.OrderItems"
  FK    AuditLogId  bigint           not null "參照 audit.AuditLogs"
  FK    EventId     bigint           not null "參照 analytics.Events"
  IDX   CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Tickets2 "工單" in Support {
  PK  Id          bigint         not null "工單識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Messages2 "訊息" in Support {
  PK  Id         bigint           not null "訊息識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
  FK  CouponId   bigint           not null "參照 sales.Coupons"
  FK  PostId     bigint           not null "參照 content.Posts"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Attachments2 "附件" in Support {
  PK  Id        bigint        not null "附件識別碼"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      Amount    decimal(18,2) not null default 0 "金額"
      Quantity  int           not null default 0 "數量"
      StartsAt  datetime2     null     "生效時間"
      EndsAt    datetime2     null     "失效時間"
      IsActive  bit           not null default 1 "是否啟用"
  FK  MetricId  bigint        not null "參照 analytics.Metrics"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table support.Tags2 "標籤" in Support {
  PK  Id          bigint         not null "標籤識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  FK  TicketId    bigint         not null "參照 support.Tickets"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Notes2 "內部註記" in Support {
  PK  Id        bigint         not null "內部註記識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
  FK  OrderId   bigint         not null "參照 sales.Orders"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Tickets3 "工單" in Support {
  PK  Id          bigint           not null "工單識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       nvarchar(200)    not null "標題"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  AuditLogId  bigint           not null "參照 audit.AuditLogs"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Messages3 "訊息" in Support {
  PK  Id         bigint       not null "訊息識別碼"
  UQ  Code       nvarchar(64) not null "業務代碼"
      Quantity   int          not null default 0 "數量"
      StartsAt   datetime2    null     "生效時間"
      EndsAt     datetime2    null     "失效時間"
      IsActive   bit          not null default 1 "是否啟用"
  FK  ShipmentId bigint       not null "參照 shipping.Shipments"
  IDX CreatedAt  datetime2    not null default "sysutcdatetime()" "建立時間"
}

table support.Attachments3 "附件" in Support {
  PK  Id         bigint        not null "附件識別碼"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      Status     nvarchar(20)  not null default "active" "狀態：active / inactive"
      Amount     decimal(18,2) not null default 0 "金額"
      Quantity   int           not null default 0 "數量"
      StartsAt   datetime2     null     "生效時間"
      EndsAt     datetime2     null     "失效時間"
  FK  AuditLogId bigint        not null "參照 audit.AuditLogs"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table support.Tags3 "標籤" in Support {
  PK  Id          bigint           not null "標籤識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
      Metadata    nvarchar(4000)   null     "附加資料（JSON）"
      Version     int              not null default 1 "版本號"
      Notes       nvarchar(1000)   null     "備註"
      Priority    int              not null default 0 "優先順序"
      Score       decimal(9,2)     null     "評分"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
  FK  PostId      bigint           not null "參照 content.Posts"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Notes3 "內部註記" in Support {
  PK    Id          bigint         not null "內部註記識別碼"
  UQ    Code        nvarchar(64)   not null "業務代碼"
        Priority    int            not null default 0 "優先順序"
        Score       decimal(9,2)   null     "評分"
        Name        nvarchar(200)  not null "名稱"
        Description nvarchar(4000) null     "描述"
        Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
        Amount      decimal(18,2)  not null default 0 "金額"
        Quantity    int            not null default 0 "數量"
  FK UQ InvoiceId   bigint         null     "參照 billing.Invoices"
  IDX   CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Tickets_Code on support.Tickets(Code)
index IX_Tickets_CreatedAt on support.Tickets(CreatedAt)
index IX_Tickets_ShipmentId on support.Tickets(ShipmentId)
unique index UX_Messages_Code on support.Messages(Code)
index IX_Messages_CreatedAt on support.Messages(CreatedAt)
index IX_Messages_PostId on support.Messages(PostId)
unique index UX_Attachments_Code on support.Attachments(Code)
index IX_Attachments_CreatedAt on support.Attachments(CreatedAt)
unique index UX_Tags_Code on support.Tags(Code)
index IX_Tags_CreatedAt on support.Tags(CreatedAt)
index IX_Tags_OrderItemId on support.Tags(OrderItemId)
unique index UX_Notes_Code on support.Notes(Code)
index IX_Notes_CreatedAt on support.Notes(CreatedAt)
index IX_Notes_OrderItemId on support.Notes(OrderItemId)
index IX_Notes_AuditLogId on support.Notes(AuditLogId)
index IX_Notes_EventId on support.Notes(EventId)
unique index UX_Tickets2_Code on support.Tickets2(Code)
index IX_Tickets2_CreatedAt on support.Tickets2(CreatedAt)
unique index UX_Messages2_Code on support.Messages2(Code)
index IX_Messages2_CreatedAt on support.Messages2(CreatedAt)
index IX_Messages2_CouponId on support.Messages2(CouponId)
index IX_Messages2_PostId on support.Messages2(PostId)
unique index UX_Attachments2_Code on support.Attachments2(Code)
index IX_Attachments2_CreatedAt on support.Attachments2(CreatedAt)
index IX_Attachments2_MetricId on support.Attachments2(MetricId)
unique index UX_Tags2_Code on support.Tags2(Code)
index IX_Tags2_CreatedAt on support.Tags2(CreatedAt)
index IX_Tags2_WarehouseId on support.Tags2(WarehouseId)
index IX_Tags2_TicketId on support.Tags2(TicketId)
unique index UX_Notes2_Code on support.Notes2(Code)
index IX_Notes2_CreatedAt on support.Notes2(CreatedAt)
index IX_Notes2_OrderId on support.Notes2(OrderId)
unique index UX_Tickets3_Code on support.Tickets3(Code)
index IX_Tickets3_CreatedAt on support.Tickets3(CreatedAt)
index IX_Tickets3_AuditLogId on support.Tickets3(AuditLogId)
unique index UX_Messages3_Code on support.Messages3(Code)
index IX_Messages3_CreatedAt on support.Messages3(CreatedAt)
index IX_Messages3_ShipmentId on support.Messages3(ShipmentId)
unique index UX_Attachments3_Code on support.Attachments3(Code)
index IX_Attachments3_CreatedAt on support.Attachments3(CreatedAt)
index IX_Attachments3_AuditLogId on support.Attachments3(AuditLogId)
unique index UX_Tags3_Code on support.Tags3(Code)
index IX_Tags3_CreatedAt on support.Tags3(CreatedAt)
index IX_Tags3_PostId on support.Tags3(PostId)
unique index UX_Notes3_Code on support.Notes3(Code)
index IX_Notes3_CreatedAt on support.Notes3(CreatedAt)
index IX_Notes3_InvoiceId on support.Notes3(InvoiceId)
```

## analytics（15 張表）

```dbschema
table analytics.Events "事件" in Analytics {
  PK  Id        bigint         not null "事件識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Slug      nvarchar(120)  null     "網址代稱"
      Locale    nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
  FK  OrderId   bigint         not null "參照 sales.Orders"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Metrics "指標" in Analytics {
  PK    Id          bigint           not null "指標識別碼"
  UQ    Code        nvarchar(64)     not null "業務代碼"
        Description nvarchar(4000)   null     "描述"
        Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
        Amount      decimal(18,2)    not null default 0 "金額"
        Quantity    int              not null default 0 "數量"
        StartsAt    datetime2        null     "生效時間"
        EndsAt      datetime2        null     "失效時間"
        IsActive    bit              not null default 1 "是否啟用"
        ExternalId  uniqueidentifier null     "外部系統識別碼"
        Slug        nvarchar(120)    null     "網址代稱"
        Locale      nvarchar(10)     not null default "zh-TW" "語系"
        SortOrder   int              not null default 0 "排序順序"
  FK UQ ShipmentId  bigint           null     "參照 shipping.Shipments"
  IDX   CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Reports "報表" in Analytics {
  PK  Id          bigint           not null "報表識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
      Metadata    nvarchar(4000)   null     "附加資料（JSON）"
      Version     int              not null default 1 "版本號"
      Notes       nvarchar(1000)   null     "備註"
      Priority    int              not null default 0 "優先順序"
      Score       decimal(9,2)     null     "評分"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Dashboards "儀表板" in Analytics {
  PK  Id         bigint           not null "儀表板識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
  FK  ShipmentId bigint           not null "參照 shipping.Shipments"
  FK  AddressId  bigint           not null "參照 shipping.Addresses"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Snapshots "快照" in Analytics {
  PK  Id          bigint         not null "快照識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  FK  PolicyId    bigint         not null "參照 audit.Policies"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Events2 "事件" in Analytics {
  PK  Id          bigint         not null "事件識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  FK  VariantId   bigint         not null "參照 catalog.Variants"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Metrics2 "指標" in Analytics {
  PK  Id          bigint         not null "指標識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
      IsActive    bit            not null default 1 "是否啟用"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Reports2 "報表" in Analytics {
  PK  Id        bigint       not null "報表識別碼"
  UQ  Code      nvarchar(64) not null "業務代碼"
      StartsAt  datetime2    null     "生效時間"
      EndsAt    datetime2    null     "失效時間"
      IsActive  bit          not null default 1 "是否啟用"
  IDX CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table analytics.Dashboards2 "儀表板" in Analytics {
  PK  Id            bigint         not null "儀表板識別碼"
  UQ  Code          nvarchar(64)   not null "業務代碼"
      Notes         nvarchar(1000) null     "備註"
      Priority      int            not null default 0 "優先順序"
      Score         decimal(9,2)   null     "評分"
      Name          nvarchar(200)  not null "名稱"
      Description   nvarchar(4000) null     "描述"
  FK  Permission2Id bigint         not null "參照 identity.Permissions2"
  IDX CreatedAt     datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Snapshots2 "快照" in Analytics {
  PK  Id          bigint         not null "快照識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Events3 "事件" in Analytics {
  PK  Id          bigint         not null "事件識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(200)  not null "標題"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Metrics3 "指標" in Analytics {
  PK  Id          bigint           not null "指標識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
  FK  CategoryId  bigint           not null "參照 catalog.Categories"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Reports3 "報表" in Analytics {
  PK  Id          bigint         not null "報表識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
      IsActive    bit            not null default 1 "是否啟用"
  FK  EventId     bigint         not null "參照 analytics.Events"
  FK  PaymentId   bigint         not null "參照 billing.Payments"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  FK  TaxId       bigint         not null "參照 billing.Taxes"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Dashboards3 "儀表板" in Analytics {
  PK  Id          bigint         not null "儀表板識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Snapshots3 "快照" in Analytics {
  PK  Id          bigint           not null "快照識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
  FK  OrderItemId bigint           not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Events_Code on analytics.Events(Code)
index IX_Events_CreatedAt on analytics.Events(CreatedAt)
index IX_Events_OrderId on analytics.Events(OrderId)
unique index UX_Metrics_Code on analytics.Metrics(Code)
index IX_Metrics_CreatedAt on analytics.Metrics(CreatedAt)
index IX_Metrics_ShipmentId on analytics.Metrics(ShipmentId)
unique index UX_Reports_Code on analytics.Reports(Code)
index IX_Reports_CreatedAt on analytics.Reports(CreatedAt)
unique index UX_Dashboards_Code on analytics.Dashboards(Code)
index IX_Dashboards_CreatedAt on analytics.Dashboards(CreatedAt)
index IX_Dashboards_ShipmentId on analytics.Dashboards(ShipmentId)
index IX_Dashboards_AddressId on analytics.Dashboards(AddressId)
unique index UX_Snapshots_Code on analytics.Snapshots(Code)
index IX_Snapshots_CreatedAt on analytics.Snapshots(CreatedAt)
index IX_Snapshots_CategoryId on analytics.Snapshots(CategoryId)
index IX_Snapshots_PolicyId on analytics.Snapshots(PolicyId)
unique index UX_Events2_Code on analytics.Events2(Code)
index IX_Events2_CreatedAt on analytics.Events2(CreatedAt)
index IX_Events2_ProductId on analytics.Events2(ProductId)
index IX_Events2_VariantId on analytics.Events2(VariantId)
unique index UX_Metrics2_Code on analytics.Metrics2(Code)
index IX_Metrics2_CreatedAt on analytics.Metrics2(CreatedAt)
index IX_Metrics2_CategoryId on analytics.Metrics2(CategoryId)
unique index UX_Reports2_Code on analytics.Reports2(Code)
index IX_Reports2_CreatedAt on analytics.Reports2(CreatedAt)
unique index UX_Dashboards2_Code on analytics.Dashboards2(Code)
index IX_Dashboards2_CreatedAt on analytics.Dashboards2(CreatedAt)
index IX_Dashboards2_Permission2Id on analytics.Dashboards2(Permission2Id)
unique index UX_Snapshots2_Code on analytics.Snapshots2(Code)
index IX_Snapshots2_CreatedAt on analytics.Snapshots2(CreatedAt)
unique index UX_Events3_Code on analytics.Events3(Code)
index IX_Events3_CreatedAt on analytics.Events3(CreatedAt)
unique index UX_Metrics3_Code on analytics.Metrics3(Code)
index IX_Metrics3_CreatedAt on analytics.Metrics3(CreatedAt)
index IX_Metrics3_CategoryId on analytics.Metrics3(CategoryId)
unique index UX_Reports3_Code on analytics.Reports3(Code)
index IX_Reports3_CreatedAt on analytics.Reports3(CreatedAt)
index IX_Reports3_EventId on analytics.Reports3(EventId)
index IX_Reports3_PaymentId on analytics.Reports3(PaymentId)
index IX_Reports3_ProductId on analytics.Reports3(ProductId)
index IX_Reports3_TaxId on analytics.Reports3(TaxId)
unique index UX_Dashboards3_Code on analytics.Dashboards3(Code)
index IX_Dashboards3_CreatedAt on analytics.Dashboards3(CreatedAt)
unique index UX_Snapshots3_Code on analytics.Snapshots3(Code)
index IX_Snapshots3_CreatedAt on analytics.Snapshots3(CreatedAt)
index IX_Snapshots3_OrderItemId on analytics.Snapshots3(OrderItemId)
```

## content（15 張表）

```dbschema
table content.Posts "文章" in Content {
  PK  Id         bigint           not null "文章識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  FK  EventId    bigint           not null "參照 analytics.Events"
  FK  TicketId   bigint           not null "參照 support.Tickets"
  FK  ShipmentId bigint           not null "參照 shipping.Shipments"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Comments "留言" in Content {
  PK  Id          bigint         not null "留言識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
  FK  ShipmentId  bigint         not null "參照 shipping.Shipments"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Medias "媒體檔案" in Content {
  PK  Id          bigint           not null "媒體檔案識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Score       decimal(9,2)     null     "評分"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  MessageId   bigint           not null "參照 support.Messages"
  FK  CommentId   bigint           not null "參照 content.Comments"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Pages "頁面" in Content {
  PK  Id          bigint           not null "頁面識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
      Slug        nvarchar(120)    null     "網址代稱"
      Locale      nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder   int              not null default 0 "排序順序"
      Metadata    nvarchar(4000)   null     "附加資料（JSON）"
      Version     int              not null default 1 "版本號"
      Notes       nvarchar(1000)   null     "備註"
  FK  OrderItemId bigint           not null "參照 sales.OrderItems"
  FK  WarehouseId bigint           not null "參照 inventory.Warehouses"
  FK  CommentId   bigint           not null "參照 content.Comments"
  FK  EventId     bigint           not null "參照 analytics.Events"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Templates "版型" in Content {
  PK  Id          bigint         not null "版型識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Posts2 "文章" in Content {
  PK  Id         bigint           not null "文章識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
  FK  AddressId  bigint           not null "參照 shipping.Addresses"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Comments2 "留言" in Content {
  PK  Id         bigint           not null "留言識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
      Score      decimal(9,2)     null     "評分"
      Name       nvarchar(200)    not null "名稱"
  FK  CategoryId bigint           not null "參照 catalog.Categories"
  FK  ProductId  bigint           not null "參照 catalog.Products"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Medias2 "媒體檔案" in Content {
  PK  Id        bigint         not null "媒體檔案識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Pages2 "頁面" in Content {
  PK    Id          bigint           not null "頁面識別碼"
  UQ    Code        nvarchar(64)     not null "業務代碼"
        StartsAt    datetime2        null     "生效時間"
        EndsAt      datetime2        null     "失效時間"
        IsActive    bit              not null default 1 "是否啟用"
        ExternalId  uniqueidentifier null     "外部系統識別碼"
        Slug        nvarchar(120)    null     "網址代稱"
        Locale      nvarchar(10)     not null default "zh-TW" "語系"
        SortOrder   int              not null default 0 "排序順序"
        Metadata    nvarchar(4000)   null     "附加資料（JSON）"
        Version     int              not null default 1 "版本號"
        Notes       nvarchar(1000)   null     "備註"
  FK    WarehouseId bigint           not null "參照 inventory.Warehouses"
  FK UQ Report2Id   bigint           null     "參照 analytics.Reports2"
  IDX   CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Templates2 "版型" in Content {
  PK  Id          bigint         not null "版型識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  FK  AddressId   bigint         not null "參照 shipping.Addresses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Posts3 "文章" in Content {
  PK  Id        bigint         not null "文章識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Comments3 "留言" in Content {
  PK  Id         bigint           not null "留言識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
  FK  EventId    bigint           not null "參照 analytics.Events"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Medias3 "媒體檔案" in Content {
  PK  Id         bigint           not null "媒體檔案識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
  FK  CategoryId bigint           not null "參照 catalog.Categories"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Pages3 "頁面" in Content {
  PK    Id         bigint         not null "頁面識別碼"
  UQ    Code       nvarchar(64)   not null "業務代碼"
        Version    int            not null default 1 "版本號"
        Notes      nvarchar(1000) null     "備註"
        Priority   int            not null default 0 "優先順序"
  FK    AuditLogId bigint         not null "參照 audit.AuditLogs"
  FK    InvoiceId  bigint         not null "參照 billing.Invoices"
  FK UQ CarrierId  bigint         null     "參照 shipping.Carriers"
  IDX   CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Templates3 "版型" in Content {
  PK  Id          bigint         not null "版型識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
      IsActive    bit            not null default 1 "是否啟用"
  FK  Tax2Id      bigint         not null "參照 billing.Taxes2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Posts_Code on content.Posts(Code)
index IX_Posts_CreatedAt on content.Posts(CreatedAt)
index IX_Posts_EventId on content.Posts(EventId)
index IX_Posts_TicketId on content.Posts(TicketId)
index IX_Posts_ShipmentId on content.Posts(ShipmentId)
unique index UX_Comments_Code on content.Comments(Code)
index IX_Comments_CreatedAt on content.Comments(CreatedAt)
index IX_Comments_ShipmentId on content.Comments(ShipmentId)
unique index UX_Medias_Code on content.Medias(Code)
index IX_Medias_CreatedAt on content.Medias(CreatedAt)
index IX_Medias_MessageId on content.Medias(MessageId)
index IX_Medias_CommentId on content.Medias(CommentId)
unique index UX_Pages_Code on content.Pages(Code)
index IX_Pages_CreatedAt on content.Pages(CreatedAt)
index IX_Pages_OrderItemId on content.Pages(OrderItemId)
index IX_Pages_WarehouseId on content.Pages(WarehouseId)
index IX_Pages_CommentId on content.Pages(CommentId)
index IX_Pages_EventId on content.Pages(EventId)
unique index UX_Templates_Code on content.Templates(Code)
index IX_Templates_CreatedAt on content.Templates(CreatedAt)
unique index UX_Posts2_Code on content.Posts2(Code)
index IX_Posts2_CreatedAt on content.Posts2(CreatedAt)
index IX_Posts2_AddressId on content.Posts2(AddressId)
unique index UX_Comments2_Code on content.Comments2(Code)
index IX_Comments2_CreatedAt on content.Comments2(CreatedAt)
index IX_Comments2_CategoryId on content.Comments2(CategoryId)
index IX_Comments2_ProductId on content.Comments2(ProductId)
index IX_Comments2_MetricId on content.Comments2(MetricId)
unique index UX_Medias2_Code on content.Medias2(Code)
index IX_Medias2_CreatedAt on content.Medias2(CreatedAt)
unique index UX_Pages2_Code on content.Pages2(Code)
index IX_Pages2_CreatedAt on content.Pages2(CreatedAt)
index IX_Pages2_WarehouseId on content.Pages2(WarehouseId)
index IX_Pages2_Report2Id on content.Pages2(Report2Id)
unique index UX_Templates2_Code on content.Templates2(Code)
index IX_Templates2_CreatedAt on content.Templates2(CreatedAt)
index IX_Templates2_AddressId on content.Templates2(AddressId)
unique index UX_Posts3_Code on content.Posts3(Code)
index IX_Posts3_CreatedAt on content.Posts3(CreatedAt)
unique index UX_Comments3_Code on content.Comments3(Code)
index IX_Comments3_CreatedAt on content.Comments3(CreatedAt)
index IX_Comments3_EventId on content.Comments3(EventId)
unique index UX_Medias3_Code on content.Medias3(Code)
index IX_Medias3_CreatedAt on content.Medias3(CreatedAt)
index IX_Medias3_CategoryId on content.Medias3(CategoryId)
unique index UX_Pages3_Code on content.Pages3(Code)
index IX_Pages3_CreatedAt on content.Pages3(CreatedAt)
index IX_Pages3_AuditLogId on content.Pages3(AuditLogId)
index IX_Pages3_InvoiceId on content.Pages3(InvoiceId)
index IX_Pages3_CarrierId on content.Pages3(CarrierId)
unique index UX_Templates3_Code on content.Templates3(Code)
index IX_Templates3_CreatedAt on content.Templates3(CreatedAt)
index IX_Templates3_Tax2Id on content.Templates3(Tax2Id)
```

## inventory（15 張表）

```dbschema
table inventory.Warehouses "倉庫" in Inventory {
  PK  Id         bigint           not null "倉庫識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  FK  UserId     bigint           not null "參照 identity.Users"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Stocks "庫存" in Inventory {
  PK  Id          bigint        not null "庫存識別碼"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Status      nvarchar(20)  not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2) not null default 0 "金額"
      Quantity    int           not null default 0 "數量"
  FK  WarehouseId bigint        not null "參照 inventory.Warehouses"
  FK  CategoryId  bigint        not null "參照 catalog.Categories"
  FK  RoleId      bigint        not null "參照 identity.Roles"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table inventory.Transfers "調撥" in Inventory {
  PK  Id          bigint         not null "調撥識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Suppliers "供應商" in Inventory {
  PK  Id         bigint           not null "供應商識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Purchases "採購單" in Inventory {
  PK  Id         bigint           not null "採購單識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
  FK  CouponId   bigint           not null "參照 sales.Coupons"
  FK  MessageId  bigint           not null "參照 support.Messages"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  FK  OrderId    bigint           not null "參照 sales.Orders"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Warehouses2 "倉庫" in Inventory {
  PK  Id          bigint         not null "倉庫識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  FK  ShipmentId  bigint         not null "參照 shipping.Shipments"
  FK  CommentId   bigint         not null "參照 content.Comments"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Stocks2 "庫存" in Inventory {
  PK  Id          bigint         not null "庫存識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK  Invoice2Id  bigint         not null "參照 billing.Invoices2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Transfers2 "調撥" in Inventory {
  PK  Id          bigint           not null "調撥識別碼"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Score       decimal(9,2)     null     "評分"
      Name        nvarchar(200)    not null "名稱"
      Description nvarchar(4000)   null     "描述"
      Status      nvarchar(20)     not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)    not null default 0 "金額"
      Quantity    int              not null default 0 "數量"
      StartsAt    datetime2        null     "生效時間"
      EndsAt      datetime2        null     "失效時間"
      IsActive    bit              not null default 1 "是否啟用"
      ExternalId  uniqueidentifier null     "外部系統識別碼"
  FK  OrderItemId bigint           not null "參照 sales.OrderItems"
  FK  MetricId    bigint           not null "參照 analytics.Metrics"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Suppliers2 "供應商" in Inventory {
  PK    Id          bigint         not null "供應商識別碼"
  UQ    Code        nvarchar(64)   not null "業務代碼"
        Description nvarchar(4000) null     "描述"
        Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
        Amount      decimal(18,2)  not null default 0 "金額"
        Quantity    int            not null default 0 "數量"
        StartsAt    datetime2      null     "生效時間"
        EndsAt      datetime2      null     "失效時間"
        IsActive    bit            not null default 1 "是否啟用"
  FK UQ AuditLogId  bigint         null     "參照 audit.AuditLogs"
  FK    InvoiceId   bigint         not null "參照 billing.Invoices"
  IDX   CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Purchases2 "採購單" in Inventory {
  PK  Id        bigint         not null "採購單識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Warehouses3 "倉庫" in Inventory {
  PK  Id         bigint           not null "倉庫識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
      Priority   int              not null default 0 "優先順序"
  FK  InvoiceId  bigint           not null "參照 billing.Invoices"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Stocks3 "庫存" in Inventory {
  PK  Id          bigint         not null "庫存識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Slug        nvarchar(120)  null     "網址代稱"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Transfers3 "調撥" in Inventory {
  PK  Id          bigint         not null "調撥識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Slug        nvarchar(120)  null     "網址代稱"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Suppliers3 "供應商" in Inventory {
  PK    Id          bigint         not null "供應商識別碼"
  UQ    Code        nvarchar(64)   not null "業務代碼"
        Version     int            not null default 1 "版本號"
        Notes       nvarchar(1000) null     "備註"
        Priority    int            not null default 0 "優先順序"
        Score       decimal(9,2)   null     "評分"
        Name        nvarchar(200)  not null "名稱"
        Description nvarchar(4000) null     "描述"
        Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  FK    AuditLogId  bigint         not null "參照 audit.AuditLogs"
  FK    EventId     bigint         not null "參照 analytics.Events"
  FK UQ ProductId   bigint         null     "參照 catalog.Products"
  IDX   CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Purchases3 "採購單" in Inventory {
  PK  Id          bigint         not null "採購單識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  FK  PostId      bigint         not null "參照 content.Posts"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  FK  MessageId   bigint         not null "參照 support.Messages"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Warehouses_Code on inventory.Warehouses(Code)
index IX_Warehouses_CreatedAt on inventory.Warehouses(CreatedAt)
index IX_Warehouses_UserId on inventory.Warehouses(UserId)
unique index UX_Stocks_Code on inventory.Stocks(Code)
index IX_Stocks_CreatedAt on inventory.Stocks(CreatedAt)
index IX_Stocks_WarehouseId on inventory.Stocks(WarehouseId)
index IX_Stocks_CategoryId on inventory.Stocks(CategoryId)
index IX_Stocks_RoleId on inventory.Stocks(RoleId)
unique index UX_Transfers_Code on inventory.Transfers(Code)
index IX_Transfers_CreatedAt on inventory.Transfers(CreatedAt)
index IX_Transfers_OrderItemId on inventory.Transfers(OrderItemId)
index IX_Transfers_WarehouseId on inventory.Transfers(WarehouseId)
unique index UX_Suppliers_Code on inventory.Suppliers(Code)
index IX_Suppliers_CreatedAt on inventory.Suppliers(CreatedAt)
unique index UX_Purchases_Code on inventory.Purchases(Code)
index IX_Purchases_CreatedAt on inventory.Purchases(CreatedAt)
index IX_Purchases_CouponId on inventory.Purchases(CouponId)
index IX_Purchases_MessageId on inventory.Purchases(MessageId)
index IX_Purchases_MetricId on inventory.Purchases(MetricId)
index IX_Purchases_OrderId on inventory.Purchases(OrderId)
unique index UX_Warehouses2_Code on inventory.Warehouses2(Code)
index IX_Warehouses2_CreatedAt on inventory.Warehouses2(CreatedAt)
index IX_Warehouses2_WarehouseId on inventory.Warehouses2(WarehouseId)
index IX_Warehouses2_ShipmentId on inventory.Warehouses2(ShipmentId)
index IX_Warehouses2_CommentId on inventory.Warehouses2(CommentId)
unique index UX_Stocks2_Code on inventory.Stocks2(Code)
index IX_Stocks2_CreatedAt on inventory.Stocks2(CreatedAt)
index IX_Stocks2_Invoice2Id on inventory.Stocks2(Invoice2Id)
unique index UX_Transfers2_Code on inventory.Transfers2(Code)
index IX_Transfers2_CreatedAt on inventory.Transfers2(CreatedAt)
index IX_Transfers2_OrderItemId on inventory.Transfers2(OrderItemId)
index IX_Transfers2_MetricId on inventory.Transfers2(MetricId)
unique index UX_Suppliers2_Code on inventory.Suppliers2(Code)
index IX_Suppliers2_CreatedAt on inventory.Suppliers2(CreatedAt)
index IX_Suppliers2_AuditLogId on inventory.Suppliers2(AuditLogId)
index IX_Suppliers2_InvoiceId on inventory.Suppliers2(InvoiceId)
unique index UX_Purchases2_Code on inventory.Purchases2(Code)
index IX_Purchases2_CreatedAt on inventory.Purchases2(CreatedAt)
unique index UX_Warehouses3_Code on inventory.Warehouses3(Code)
index IX_Warehouses3_CreatedAt on inventory.Warehouses3(CreatedAt)
index IX_Warehouses3_InvoiceId on inventory.Warehouses3(InvoiceId)
unique index UX_Stocks3_Code on inventory.Stocks3(Code)
index IX_Stocks3_CreatedAt on inventory.Stocks3(CreatedAt)
unique index UX_Transfers3_Code on inventory.Transfers3(Code)
index IX_Transfers3_CreatedAt on inventory.Transfers3(CreatedAt)
unique index UX_Suppliers3_Code on inventory.Suppliers3(Code)
index IX_Suppliers3_CreatedAt on inventory.Suppliers3(CreatedAt)
index IX_Suppliers3_AuditLogId on inventory.Suppliers3(AuditLogId)
index IX_Suppliers3_EventId on inventory.Suppliers3(EventId)
index IX_Suppliers3_ProductId on inventory.Suppliers3(ProductId)
unique index UX_Purchases3_Code on inventory.Purchases3(Code)
index IX_Purchases3_CreatedAt on inventory.Purchases3(CreatedAt)
index IX_Purchases3_OrderItemId on inventory.Purchases3(OrderItemId)
index IX_Purchases3_PostId on inventory.Purchases3(PostId)
index IX_Purchases3_ProductId on inventory.Purchases3(ProductId)
index IX_Purchases3_MessageId on inventory.Purchases3(MessageId)
```

## audit（15 張表）

```dbschema
table audit.AuditLogs "稽核紀錄" in Audit {
  PK  Id         bigint           not null "稽核紀錄識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
  FK  UserId     bigint           not null "參照 identity.Users"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Changes "異動" in Audit {
  PK  Id         bigint           not null "異動識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
      Notes      nvarchar(1000)   null     "備註"
  FK  ShipmentId bigint           not null "參照 shipping.Shipments"
  FK  StockId    bigint           not null "參照 inventory.Stocks"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Approvals "簽核" in Audit {
  PK  Id         bigint        not null "簽核識別碼"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      Amount     decimal(18,2) not null default 0 "金額"
      Quantity   int           not null default 0 "數量"
      StartsAt   datetime2     null     "生效時間"
  FK  CategoryId bigint        not null "參照 catalog.Categories"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table audit.Policies "政策" in Audit {
  PK  Id          bigint         not null "政策識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
      EndsAt      datetime2      null     "失效時間"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings "設定" in Audit {
  PK  Id          bigint         not null "設定識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
      Amount      decimal(18,2)  not null default 0 "金額"
      Quantity    int            not null default 0 "數量"
      StartsAt    datetime2      null     "生效時間"
  FK  OrderItemId bigint         not null "參照 sales.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.AuditLogs2 "稽核紀錄" in Audit {
  PK  Id         bigint           not null "稽核紀錄識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  FK  MessageId  bigint           not null "參照 support.Messages"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Changes2 "異動" in Audit {
  PK  Id         bigint           not null "異動識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     decimal(18,2)    not null default 0 "金額"
      Quantity   int              not null default 0 "數量"
      StartsAt   datetime2        null     "生效時間"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Approvals2 "簽核" in Audit {
  PK  Id            bigint         not null "簽核識別碼"
  UQ  Code          nvarchar(64)   not null "業務代碼"
      Locale        nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder     int            not null default 0 "排序順序"
      Metadata      nvarchar(4000) null     "附加資料（JSON）"
      Version       int            not null default 1 "版本號"
      Notes         nvarchar(1000) null     "備註"
      Priority      int            not null default 0 "優先順序"
  FK  Permission2Id bigint         not null "參照 identity.Permissions2"
  IDX CreatedAt     datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Policies2 "政策" in Audit {
  PK  Id          bigint         not null "政策識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
      Status      nvarchar(20)   not null default "active" "狀態：active / inactive"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings2 "設定" in Audit {
  PK  Id        bigint         not null "設定識別碼"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      SortOrder int            not null default 0 "排序順序"
      Metadata  nvarchar(4000) null     "附加資料（JSON）"
      Version   int            not null default 1 "版本號"
      Notes     nvarchar(1000) null     "備註"
      Priority  int            not null default 0 "優先順序"
      Score     decimal(9,2)   null     "評分"
      Name      nvarchar(200)  not null "名稱"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.AuditLogs3 "稽核紀錄" in Audit {
  PK  Id          bigint         not null "稽核紀錄識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  CategoryId  bigint         not null "參照 catalog.Categories"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Changes3 "異動" in Audit {
  PK  Id         bigint           not null "異動識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
      Locale     nvarchar(10)     not null default "zh-TW" "語系"
      SortOrder  int              not null default 0 "排序順序"
      Metadata   nvarchar(4000)   null     "附加資料（JSON）"
      Version    int              not null default 1 "版本號"
  FK  MetricId   bigint           not null "參照 analytics.Metrics"
  FK  TicketId   bigint           not null "參照 support.Tickets"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Approvals3 "簽核" in Audit {
  PK  Id         bigint           not null "簽核識別碼"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     datetime2        null     "失效時間"
      IsActive   bit              not null default 1 "是否啟用"
      ExternalId uniqueidentifier null     "外部系統識別碼"
      Slug       nvarchar(120)    null     "網址代稱"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Policies3 "政策" in Audit {
  PK  Id          bigint         not null "政策識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Locale      nvarchar(10)   not null default "zh-TW" "語系"
      SortOrder   int            not null default 0 "排序順序"
      Metadata    nvarchar(4000) null     "附加資料（JSON）"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings3 "設定" in Audit {
  PK  Id          bigint         not null "設定識別碼"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Version     int            not null default 1 "版本號"
      Notes       nvarchar(1000) null     "備註"
      Priority    int            not null default 0 "優先順序"
      Score       decimal(9,2)   null     "評分"
      Name        nvarchar(200)  not null "名稱"
      Description nvarchar(4000) null     "描述"
  FK  ProductId   bigint         not null "參照 catalog.Products"
  FK  WarehouseId bigint         not null "參照 inventory.Warehouses"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_AuditLogs_Code on audit.AuditLogs(Code)
index IX_AuditLogs_CreatedAt on audit.AuditLogs(CreatedAt)
index IX_AuditLogs_UserId on audit.AuditLogs(UserId)
unique index UX_Changes_Code on audit.Changes(Code)
index IX_Changes_CreatedAt on audit.Changes(CreatedAt)
index IX_Changes_ShipmentId on audit.Changes(ShipmentId)
index IX_Changes_StockId on audit.Changes(StockId)
unique index UX_Approvals_Code on audit.Approvals(Code)
index IX_Approvals_CreatedAt on audit.Approvals(CreatedAt)
index IX_Approvals_CategoryId on audit.Approvals(CategoryId)
unique index UX_Policies_Code on audit.Policies(Code)
index IX_Policies_CreatedAt on audit.Policies(CreatedAt)
index IX_Policies_CategoryId on audit.Policies(CategoryId)
index IX_Policies_WarehouseId on audit.Policies(WarehouseId)
unique index UX_Settings_Code on audit.Settings(Code)
index IX_Settings_CreatedAt on audit.Settings(CreatedAt)
index IX_Settings_OrderItemId on audit.Settings(OrderItemId)
unique index UX_AuditLogs2_Code on audit.AuditLogs2(Code)
index IX_AuditLogs2_CreatedAt on audit.AuditLogs2(CreatedAt)
index IX_AuditLogs2_MetricId on audit.AuditLogs2(MetricId)
index IX_AuditLogs2_MessageId on audit.AuditLogs2(MessageId)
unique index UX_Changes2_Code on audit.Changes2(Code)
index IX_Changes2_CreatedAt on audit.Changes2(CreatedAt)
unique index UX_Approvals2_Code on audit.Approvals2(Code)
index IX_Approvals2_CreatedAt on audit.Approvals2(CreatedAt)
index IX_Approvals2_Permission2Id on audit.Approvals2(Permission2Id)
unique index UX_Policies2_Code on audit.Policies2(Code)
index IX_Policies2_CreatedAt on audit.Policies2(CreatedAt)
unique index UX_Settings2_Code on audit.Settings2(Code)
index IX_Settings2_CreatedAt on audit.Settings2(CreatedAt)
unique index UX_AuditLogs3_Code on audit.AuditLogs3(Code)
index IX_AuditLogs3_CreatedAt on audit.AuditLogs3(CreatedAt)
index IX_AuditLogs3_CategoryId on audit.AuditLogs3(CategoryId)
unique index UX_Changes3_Code on audit.Changes3(Code)
index IX_Changes3_CreatedAt on audit.Changes3(CreatedAt)
index IX_Changes3_MetricId on audit.Changes3(MetricId)
index IX_Changes3_TicketId on audit.Changes3(TicketId)
unique index UX_Approvals3_Code on audit.Approvals3(Code)
index IX_Approvals3_CreatedAt on audit.Approvals3(CreatedAt)
unique index UX_Policies3_Code on audit.Policies3(Code)
index IX_Policies3_CreatedAt on audit.Policies3(CreatedAt)
unique index UX_Settings3_Code on audit.Settings3(Code)
index IX_Settings3_CreatedAt on audit.Settings3(CreatedAt)
index IX_Settings3_ProductId on audit.Settings3(ProductId)
index IX_Settings3_WarehouseId on audit.Settings3(WarehouseId)
```

## 關聯（191 條）

```dbschema
relation FK_Orders_Users {
  sales.Orders.UserId N -> 1 identity.Users.Id
}

relation FK_Roles_Warehouses {
  identity.Roles.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_AuditLogs2_Metrics {
  audit.AuditLogs2.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Notes_OrderItems {
  support.Notes.OrderItemId 1 -> 1 sales.OrderItems.Id
}

relation FK_Purchases3_OrderItems {
  inventory.Purchases3.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Carriers_Shipments {
  shipping.Carriers.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Shipments3_Warehouses {
  shipping.Shipments3.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Trackings_Roles {
  shipping.Trackings.RoleId N -> 1 identity.Roles.Id
}

relation FK_Posts_Events {
  content.Posts.EventId N -> 1 analytics.Events.Id
}

relation FK_Posts2_Addresses {
  content.Posts2.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_Stocks_Warehouses {
  inventory.Stocks.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Invoices2_Shipments {
  billing.Invoices2.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Brands2_Shipments {
  catalog.Brands2.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Events2_Products {
  analytics.Events2.ProductId N -> 1 catalog.Products.Id
}

relation FK_Purchases_Coupons {
  inventory.Purchases.CouponId N -> 1 sales.Coupons.Id
}

relation FK_Reports3_Events {
  analytics.Reports3.EventId N -> 1 analytics.Events.Id
}

relation FK_Tags3_Posts {
  support.Tags3.PostId N -> 1 content.Posts.Id
}

relation FK_Categories3_OrderItems {
  catalog.Categories3.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Carriers2_Ledgers {
  shipping.Carriers2.LedgerId N -> 1 billing.Ledgers.Id
}

relation FK_Metrics_Shipments {
  analytics.Metrics.ShipmentId 1 -> 1 shipping.Shipments.Id
}

relation FK_Transfers2_OrderItems {
  inventory.Transfers2.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Refunds2_Invoices2 {
  billing.Refunds2.Invoice2Id N -> 1 billing.Invoices2.Id
}

relation FK_Warehouses2_Warehouses {
  inventory.Warehouses2.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Variants_Roles {
  catalog.Variants.RoleId N -> 1 identity.Roles.Id
}

relation FK_Purchases_Messages {
  inventory.Purchases.MessageId N -> 1 support.Messages.Id
}

relation FK_Tickets3_AuditLogs {
  support.Tickets3.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Prices_Orders {
  catalog.Prices.OrderId N -> 1 sales.Orders.Id
}

relation FK_Reports3_Payments {
  analytics.Reports3.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Products_Users {
  catalog.Products.UserId N -> 1 identity.Users.Id
}

relation FK_Taxes2_Events {
  billing.Taxes2.EventId N -> 1 analytics.Events.Id
}

relation FK_Refunds2_OrderItems {
  billing.Refunds2.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Changes3_Metrics {
  audit.Changes3.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_OrderItems3_Users {
  sales.OrderItems3.UserId N -> 1 identity.Users.Id
}

relation FK_Products2_Warehouses {
  catalog.Products2.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Packages3_Metrics {
  shipping.Packages3.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Suppliers3_AuditLogs {
  inventory.Suppliers3.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Carriers3_Comments {
  shipping.Carriers3.CommentId N -> 1 content.Comments.Id
}

relation FK_Carts3_Tickets {
  sales.Carts3.TicketId N -> 1 support.Tickets.Id
}

relation FK_Dashboards2_Permissions2 {
  analytics.Dashboards2.Permission2Id N -> 1 identity.Permissions2.Id
}

relation FK_Reports3_Products {
  analytics.Reports3.ProductId N -> 1 catalog.Products.Id
}

relation FK_Suppliers3_Events {
  inventory.Suppliers3.EventId N -> 1 analytics.Events.Id
}

relation FK_Categories_Products {
  catalog.Categories.ProductId N -> 1 catalog.Products.Id
}

relation FK_AuditLogs_Users {
  audit.AuditLogs.UserId N -> 1 identity.Users.Id
}

relation FK_Posts_Tickets {
  content.Posts.TicketId N -> 1 support.Tickets.Id
}

relation FK_Users2_Tags {
  identity.Users2.TagId N -> 1 support.Tags.Id
}

relation FK_Purchases_Metrics {
  inventory.Purchases.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Shipments3_Invoices {
  shipping.Shipments3.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Transfers_OrderItems {
  inventory.Transfers.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Reports3_Taxes {
  analytics.Reports3.TaxId N -> 1 billing.Taxes.Id
}

relation FK_Templates3_Taxes2 {
  content.Templates3.Tax2Id N -> 1 billing.Taxes2.Id
}

relation FK_OrderItems3_Coupons {
  sales.OrderItems3.CouponId N -> 1 sales.Coupons.Id
}

relation FK_Notes3_Invoices {
  support.Notes3.InvoiceId 1 -> 1 billing.Invoices.Id
}

relation FK_Messages2_Coupons {
  support.Messages2.CouponId N -> 1 sales.Coupons.Id
}

relation FK_Transfers_Warehouses {
  inventory.Transfers.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Packages_Warehouses {
  shipping.Packages.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Permissions2_Addresses {
  identity.Permissions2.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_Coupons2_Shipments {
  sales.Coupons2.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Notes_AuditLogs {
  support.Notes.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Tickets_Shipments {
  support.Tickets.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Categories_Warehouses {
  catalog.Categories.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Warehouses2_Shipments {
  inventory.Warehouses2.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Categories2_AuditLogs {
  catalog.Categories2.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Orders_Products {
  sales.Orders.ProductId N -> 1 catalog.Products.Id
}

relation FK_Refunds_Users {
  billing.Refunds.UserId N -> 1 identity.Users.Id
}

relation FK_Taxes3_Metrics {
  billing.Taxes3.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Orders3_Roles {
  sales.Orders3.RoleId N -> 1 identity.Roles.Id
}

relation FK_Refunds_Payments {
  billing.Refunds.PaymentId N -> 1 billing.Payments.Id
}

relation FK_AuditLogs2_Messages {
  audit.AuditLogs2.MessageId N -> 1 support.Messages.Id
}

relation FK_Pages3_AuditLogs {
  content.Pages3.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Packages3_Tickets {
  shipping.Packages3.TicketId N -> 1 support.Tickets.Id
}

relation FK_Warehouses_Users {
  inventory.Warehouses.UserId N -> 1 identity.Users.Id
}

relation FK_Sessions2_Payments {
  identity.Sessions2.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Shipments3_Products {
  shipping.Shipments3.ProductId N -> 1 catalog.Products.Id
}

relation FK_Pages3_Invoices {
  content.Pages3.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Tags_OrderItems {
  support.Tags.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Snapshots_Categories {
  analytics.Snapshots.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Events2_Variants {
  analytics.Events2.VariantId N -> 1 catalog.Variants.Id
}

relation FK_Messages2_Posts {
  support.Messages2.PostId N -> 1 content.Posts.Id
}

relation FK_Templates2_Addresses {
  content.Templates2.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_Ledgers_Events {
  billing.Ledgers.EventId N -> 1 analytics.Events.Id
}

relation FK_Dashboards_Shipments {
  analytics.Dashboards.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Variants_Invoices {
  catalog.Variants.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Attachments2_Metrics {
  support.Attachments2.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Coupons_Roles {
  sales.Coupons.RoleId N -> 1 identity.Roles.Id
}

relation FK_Pages3_Carriers {
  content.Pages3.CarrierId 1 -> 1 shipping.Carriers.Id
}

relation FK_CartItems3_Tickets {
  sales.CartItems3.TicketId 1 -> 1 support.Tickets.Id
}

relation FK_Purchases3_Posts {
  inventory.Purchases3.PostId N -> 1 content.Posts.Id
}

relation FK_Roles2_Tickets {
  identity.Roles2.TicketId N -> 1 support.Tickets.Id
}

relation FK_Taxes2_Categories2 {
  billing.Taxes2.Category2Id N -> 1 catalog.Categories2.Id
}

relation FK_Pages_OrderItems {
  content.Pages.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Pages2_Warehouses {
  content.Pages2.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_CartItems_Categories {
  sales.CartItems.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Medias3_Categories {
  content.Medias3.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_OrderItems2_Prices {
  sales.OrderItems2.PriceId N -> 1 catalog.Prices.Id
}

relation FK_Addresses_Payments {
  shipping.Addresses.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Users2_Roles {
  identity.Users2.RoleId N -> 1 identity.Roles.Id
}

relation FK_Variants_Carts {
  catalog.Variants.CartId N -> 1 sales.Carts.Id
}

relation FK_Transfers2_Metrics {
  inventory.Transfers2.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Notes2_Orders {
  support.Notes2.OrderId N -> 1 sales.Orders.Id
}

relation FK_Changes_Shipments {
  audit.Changes.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Approvals2_Permissions2 {
  audit.Approvals2.Permission2Id N -> 1 identity.Permissions2.Id
}

relation FK_Comments2_Categories {
  content.Comments2.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Warehouses3_Invoices {
  inventory.Warehouses3.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Pages_Warehouses {
  content.Pages.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_OrderItems2_Categories {
  sales.OrderItems2.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Snapshots_Policies {
  analytics.Snapshots.PolicyId N -> 1 audit.Policies.Id
}

relation FK_Sessions2_Addresses {
  identity.Sessions2.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_Snapshots3_OrderItems {
  analytics.Snapshots3.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Approvals_Categories {
  audit.Approvals.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Carriers2_Carts2 {
  shipping.Carriers2.Cart2Id N -> 1 sales.Carts2.Id
}

relation FK_Settings3_Products {
  audit.Settings3.ProductId N -> 1 catalog.Products.Id
}

relation FK_Roles2_Invoices {
  identity.Roles2.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Comments2_Products {
  content.Comments2.ProductId N -> 1 catalog.Products.Id
}

relation FK_Stocks2_Invoices2 {
  inventory.Stocks2.Invoice2Id N -> 1 billing.Invoices2.Id
}

relation FK_Payments3_Posts {
  billing.Payments3.PostId N -> 1 content.Posts.Id
}

relation FK_Suppliers2_AuditLogs {
  inventory.Suppliers2.AuditLogId 1 -> 1 audit.AuditLogs.Id
}

relation FK_Categories2_Changes {
  catalog.Categories2.ChangeId N -> 1 audit.Changes.Id
}

relation FK_CartItems2_Payments {
  sales.CartItems2.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Permissions2_Addresses_2 {
  identity.Permissions2.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_OrderItems2_Users2 {
  sales.OrderItems2.User2Id N -> 1 identity.Users2.Id
}

relation FK_Refunds_Warehouses {
  billing.Refunds.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_OrderItems_Shipments {
  sales.OrderItems.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Addresses3_Roles {
  shipping.Addresses3.RoleId N -> 1 identity.Roles.Id
}

relation FK_Changes3_Tickets {
  audit.Changes3.TicketId N -> 1 support.Tickets.Id
}

relation FK_Orders3_Events {
  sales.Orders3.EventId N -> 1 analytics.Events.Id
}

relation FK_Coupons2_Products {
  sales.Coupons2.ProductId N -> 1 catalog.Products.Id
}

relation FK_Comments3_Events {
  content.Comments3.EventId N -> 1 analytics.Events.Id
}

relation FK_Attachments3_AuditLogs {
  support.Attachments3.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Coupons_Products {
  sales.Coupons.ProductId N -> 1 catalog.Products.Id
}

relation FK_Comments2_Metrics {
  content.Comments2.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Refunds3_Posts {
  billing.Refunds3.PostId N -> 1 content.Posts.Id
}

relation FK_Trackings_Products {
  shipping.Trackings.ProductId N -> 1 catalog.Products.Id
}

relation FK_Dashboards_Addresses {
  analytics.Dashboards.AddressId N -> 1 shipping.Addresses.Id
}

relation FK_Settings3_Warehouses {
  audit.Settings3.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Categories2_Orders2 {
  catalog.Categories2.Order2Id N -> 1 sales.Orders2.Id
}

relation FK_Warehouses2_Comments {
  inventory.Warehouses2.CommentId N -> 1 content.Comments.Id
}

relation FK_Medias_Messages {
  content.Medias.MessageId N -> 1 support.Messages.Id
}

relation FK_Tokens_Roles {
  identity.Tokens.RoleId N -> 1 identity.Roles.Id
}

relation FK_Stocks_Categories {
  inventory.Stocks.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Shipments_Orders {
  shipping.Shipments.OrderId N -> 1 sales.Orders.Id
}

relation FK_Messages_Posts {
  support.Messages.PostId N -> 1 content.Posts.Id
}

relation FK_Users3_Metrics {
  identity.Users3.MetricId N -> 1 analytics.Metrics.Id
}

relation FK_Orders_Users_2 {
  sales.Orders.UserId N -> 1 identity.Users.Id
}

relation FK_Carriers_Users {
  shipping.Carriers.UserId N -> 1 identity.Users.Id
}

relation FK_Addresses3_Invoices2 {
  shipping.Addresses3.Invoice2Id N -> 1 billing.Invoices2.Id
}

relation FK_Pages_Comments {
  content.Pages.CommentId N -> 1 content.Comments.Id
}

relation FK_Notes_Events {
  support.Notes.EventId N -> 1 analytics.Events.Id
}

relation FK_Permissions_Warehouses {
  identity.Permissions.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Carts_Invoices {
  sales.Carts.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Coupons3_Categories {
  sales.Coupons3.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Purchases3_Products {
  inventory.Purchases3.ProductId N -> 1 catalog.Products.Id
}

relation FK_Prices_Sessions {
  catalog.Prices.SessionId N -> 1 identity.Sessions.Id
}

relation FK_AuditLogs3_Categories {
  audit.AuditLogs3.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Metrics3_Categories {
  analytics.Metrics3.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Posts_Shipments {
  content.Posts.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Medias_Comments {
  content.Medias.CommentId N -> 1 content.Comments.Id
}

relation FK_Tickets3_AuditLogs_2 {
  support.Tickets3.AuditLogId N -> 1 audit.AuditLogs.Id
}

relation FK_Addresses3_Comments {
  shipping.Addresses3.CommentId N -> 1 content.Comments.Id
}

relation FK_Variants_Messages {
  catalog.Variants.MessageId N -> 1 support.Messages.Id
}

relation FK_Changes_Stocks {
  audit.Changes.StockId N -> 1 inventory.Stocks.Id
}

relation FK_Tokens_Tickets {
  identity.Tokens.TicketId 1 -> 1 support.Tickets.Id
}

relation FK_CartItems_OrderItems {
  sales.CartItems.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Pages_Events {
  content.Pages.EventId N -> 1 analytics.Events.Id
}

relation FK_Tags2_Warehouses {
  support.Tags2.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Policies_Categories {
  audit.Policies.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Prices_Payments {
  catalog.Prices.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Purchases3_Messages {
  inventory.Purchases3.MessageId N -> 1 support.Messages.Id
}

relation FK_Payments2_Invoices {
  billing.Payments2.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Posts_Shipments_2 {
  content.Posts.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Policies_Warehouses {
  audit.Policies.WarehouseId N -> 1 inventory.Warehouses.Id
}

relation FK_Stocks_Roles {
  inventory.Stocks.RoleId N -> 1 identity.Roles.Id
}

relation FK_Tags2_Tickets {
  support.Tags2.TicketId N -> 1 support.Tickets.Id
}

relation FK_Purchases_Orders {
  inventory.Purchases.OrderId N -> 1 sales.Orders.Id
}

relation FK_Carriers3_Users {
  shipping.Carriers3.UserId N -> 1 identity.Users.Id
}

relation FK_Suppliers3_Products {
  inventory.Suppliers3.ProductId 1 -> 1 catalog.Products.Id
}

relation FK_Comments_Shipments {
  content.Comments.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Carts_Roles {
  sales.Carts.RoleId N -> 1 identity.Roles.Id
}

relation FK_Brands3_Products3 {
  catalog.Brands3.Product3Id N -> 1 catalog.Products3.Id
}

relation FK_Permissions2_Invoices {
  identity.Permissions2.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_CartItems_Tickets {
  sales.CartItems.TicketId N -> 1 support.Tickets.Id
}

relation FK_Carts_Events {
  sales.Carts.EventId N -> 1 analytics.Events.Id
}

relation FK_Addresses_Invoices {
  shipping.Addresses.InvoiceId N -> 1 billing.Invoices.Id
}

relation FK_Pages2_Reports2 {
  content.Pages2.Report2Id 1 -> 1 analytics.Reports2.Id
}

relation FK_Settings_OrderItems {
  audit.Settings.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_Payments_Users {
  billing.Payments.UserId N -> 1 identity.Users.Id
}

relation FK_Variants3_OrderItems {
  catalog.Variants3.OrderItemId N -> 1 sales.OrderItems.Id
}

relation FK_CartItems_Payments {
  sales.CartItems.PaymentId N -> 1 billing.Payments.Id
}

relation FK_Metrics2_Categories {
  analytics.Metrics2.CategoryId N -> 1 catalog.Categories.Id
}

relation FK_Events_Orders {
  analytics.Events.OrderId N -> 1 sales.Orders.Id
}

relation FK_Messages3_Shipments {
  support.Messages3.ShipmentId N -> 1 shipping.Shipments.Id
}

relation FK_Suppliers2_Invoices {
  inventory.Suppliers2.InvoiceId N -> 1 billing.Invoices.Id
}
```
