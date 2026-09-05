# 大型 Schema 範例（150 張資料表）

用來驗證大型 Schema 的探索體驗（plan §21、AC-20）。
在此檔案上執行 `DBSchema: Open Preview`，然後依序試：

| 操作 | 預期 |
|---|---|
| `Ctrl`/`Cmd` + `F` 搜尋 `Orders` | 跳到該表並聚焦，其餘淡化 |
| 搜尋欄位 `CreatedAt` | 列出所有含此欄位的表，點擊後高亮該欄位 |
| Depth 切 `1-Hop` / `2-Hop` | 只保留一層／兩層相鄰的表 |
| Direction 切 `Upstream` | 只看這張表依賴哪些表 |
| Direction 切 `Downstream` | 只看哪些表依賴這張表 |
| Unrelated 切 `Hide` | 不相關的表直接消失 |
| View 切 `Overview` | 只剩表名與關聯，適合全局導覽 |
| 備註切 `完整` | 欄位備註展開成多行 |
| 拖曳卡片 | 自行調整版面，關聯線跟著走 |
| 雙擊欄位 | 跳回本檔案對應的那一行 |

分成 11 個模組區塊，最後一塊是跨模組關聯；
DBSchema 會把所有 ```dbschema 區塊合併成同一份 Schema。

> 本檔由 `npm run example:large` 產生，請勿手動編輯。

---

## 群組（10 個功能模組）

```dbschema
group Identity "Identity 功能模組"
group Catalog "Catalog 功能模組"
group Sales "Sales 功能模組"
group Billing "Billing 功能模組"
group Shipping "Shipping 功能模組"
group Support "Support 功能模組"
group Analytics "Analytics 功能模組"
group Content "Content 功能模組"
group Inventory "Inventory 功能模組"
group Audit "Audit 功能模組"
```

## analytics（15 張表）

```dbschema
table analytics.Categories "Analytics 模組的 Categories" in Analytics {
  PK  Id         bigint           not null "Categories 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   uniqueidentifier not null "Quantity 欄位說明"
      StartsAt   datetime2        null
      EndsAt     datetime2        null
      IsActive   nvarchar(4000)   not null "IsActive 欄位說明"
      ExternalId bigint           not null
      Slug       nvarchar(200)    not null
      Locale     bigint           not null
      SortOrder  datetime2        null     "SortOrder 欄位說明"
      Metadata   nvarchar(200)    null
      Version    decimal(18,2)    null
      Notes      datetime2        not null "Notes 欄位說明"
      Priority   nvarchar(50)     not null "Priority 欄位說明"
  FK  CartId     bigint           not null "參照 sales.Carts"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Payments "Analytics 模組的 Payments" in Analytics {
  PK  Id          bigint         not null "Payments 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        int            null
      Title       nvarchar(200)  not null "Title 欄位說明"
      Description nvarchar(4000) null
  FK  Sessions3Id bigint         not null "參照 billing.Sessions3"
  FK  InvoiceId   bigint         not null "參照 support.Invoices"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Messages "Analytics 模組的 Messages" in Analytics {
  PK  Id          bigint         not null "Messages 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   bigint         null
      Metadata    bigint         null
      Version     bigint         not null "Version 欄位說明"
      Notes       datetime2      not null "Notes 欄位說明"
      Priority    bigint         null     "Priority 欄位說明"
      Score       nvarchar(4000) null
      Name        datetime2      not null
      Title       int            null     "Title 欄位說明"
      Description bit            not null default 0
  FK  Tokens2Id   bigint         not null "參照 shipping.Tokens2"
  FK  RefundId    bigint         not null "參照 content.Refunds"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Comments "Analytics 模組的 Comments" in Analytics {
  PK  Id         bigint           not null "Comments 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   bit              not null default 0
      EndsAt     bigint           not null
      IsActive   uniqueidentifier null
      ExternalId decimal(18,2)    not null "ExternalId 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Changes "Analytics 模組的 Changes" in Analytics {
  PK  Id          bigint        not null "Changes 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Title       nvarchar(50)  null     "Title 欄位說明"
      Description nvarchar(200) not null
      Status      bigint        not null "Status 欄位說明"
      Amount      nvarchar(200) null
      Quantity    int           not null "Quantity 欄位說明"
      StartsAt    nvarchar(50)  not null
      EndsAt      decimal(18,2) null
      IsActive    nvarchar(50)  not null "IsActive 欄位說明"
      ExternalId  datetime2     not null
      Slug        nvarchar(200) null
  FK  ProductId   bigint        not null "參照 dbo.Products"
  FK  TokenId     bigint        not null "參照 dbo.Tokens"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table analytics.Categories2 "Analytics 模組的 Categories2" in Analytics {
  PK  Id        bigint         not null "Categories2 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Metadata  bigint         null     "Metadata 欄位說明"
      Version   bigint         null     "Version 欄位說明"
      Notes     bit            null     default 0
      Priority  nvarchar(4000) not null "Priority 欄位說明"
      Score     bigint         not null
  FK  Carts2Id  bigint         not null "參照 sales.Carts2"
  FK  TaxId     bigint         not null "參照 audit.Taxs"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Payments2 "Analytics 模組的 Payments2" in Analytics {
  PK  Id         bigint           not null "Payments2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     bigint           null
      IsActive   uniqueidentifier null     "IsActive 欄位說明"
      ExternalId datetime2        null
  FK  CouponId   bigint           not null "參照 shipping.Coupons"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Messages2 "Analytics 模組的 Messages2" in Analytics {
  PK  Id          bigint        not null "Messages2 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Title       decimal(18,2) not null
      Description int           null
      Status      bigint        not null
      Amount      nvarchar(200) null     "Amount 欄位說明"
      Quantity    nvarchar(200) not null "Quantity 欄位說明"
  FK  InvoiceId   bigint        not null "參照 support.Invoices"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table analytics.Comments2 "Analytics 模組的 Comments2" in Analytics {
  PK    Id        bigint           not null "Comments2 主鍵"
  UQ    Code      nvarchar(64)     not null "業務代碼"
        Version   bit              not null default 0 "Version 欄位說明"
        Notes     bit              null     default 0 "Notes 欄位說明"
        Priority  uniqueidentifier null     "Priority 欄位說明"
        Score     bit              not null default 0
        Name      nvarchar(4000)   not null
  FK    RefundId  bigint           not null "參照 content.Refunds"
  FK    TokenId   bigint           not null "參照 dbo.Tokens"
  FK UQ VariantId bigint           null     "參照 inventory.Variants"
  IDX   CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Changes2 "Analytics 模組的 Changes2" in Analytics {
  PK  Id         bigint           not null "Changes2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   uniqueidentifier not null
      ExternalId nvarchar(4000)   null     "ExternalId 欄位說明"
      Slug       decimal(18,2)    not null
      Locale     nvarchar(50)     null     "Locale 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Categories3 "Analytics 模組的 Categories3" in Analytics {
  PK  Id          bigint           not null "Categories3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description uniqueidentifier not null
      Status      nvarchar(4000)   not null "Status 欄位說明"
      Amount      bigint           null
      Quantity    int              null
      StartsAt    decimal(18,2)    not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Payments3 "Analytics 模組的 Payments3" in Analytics {
  PK  Id          bigint        not null "Payments3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Notes       bigint        not null
      Priority    datetime2     null
      Score       bit           null     default 0 "Score 欄位說明"
      Name        nvarchar(200) not null
      Title       nvarchar(200) null
      Description bit           null     default 0 "Description 欄位說明"
      Status      nvarchar(50)  not null "Status 欄位說明"
      Amount      nvarchar(200) not null
  FK  Products2Id bigint        not null "參照 support.Products2"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table analytics.Messages3 "Analytics 模組的 Messages3" in Analytics {
  PK  Id         bigint         not null "Messages3 主鍵"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      ExternalId nvarchar(4000) null
      Slug       datetime2      null
      Locale     nvarchar(200)  null     "Locale 欄位說明"
      SortOrder  nvarchar(200)  null
      Metadata   nvarchar(4000) null
  FK  BrandId    bigint         not null "參照 content.Brands"
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table analytics.Comments3 "Analytics 模組的 Comments3" in Analytics {
  PK  Id           bigint           not null "Comments3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Status       bigint           not null "Status 欄位說明"
      Amount       uniqueidentifier not null "Amount 欄位說明"
      Quantity     nvarchar(200)    not null
      StartsAt     nvarchar(50)     not null "StartsAt 欄位說明"
      EndsAt       decimal(18,2)    not null "EndsAt 欄位說明"
      IsActive     datetime2        null
      ExternalId   nvarchar(4000)   not null
      Slug         uniqueidentifier not null
      Locale       uniqueidentifier null     "Locale 欄位說明"
      SortOrder    int              not null
  FK  Transfers3Id bigint           not null "參照 sales.Transfers3"
  FK  UserId       bigint           not null "參照 dbo.Users"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table analytics.Changes3 "Analytics 模組的 Changes3" in Analytics {
  PK  Id          bigint           not null "Changes3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Priority    uniqueidentifier null
      Score       uniqueidentifier null
      Name        datetime2        null
  FK  PaymentId   bigint           not null "參照 analytics.Payments"
  FK  OrderId     bigint           not null "參照 identity.Orders"
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Categories_Code on analytics.Categories(Code)
index IX_Categories_CreatedAt on analytics.Categories(CreatedAt)
index IX_Categories_CartId on analytics.Categories(CartId)
unique index UX_Payments_Code on analytics.Payments(Code)
index IX_Payments_CreatedAt on analytics.Payments(CreatedAt)
index IX_Payments_Sessions3Id on analytics.Payments(Sessions3Id)
index IX_Payments_InvoiceId on analytics.Payments(InvoiceId)
unique index UX_Messages_Code on analytics.Messages(Code)
index IX_Messages_CreatedAt on analytics.Messages(CreatedAt)
index IX_Messages_Tokens2Id on analytics.Messages(Tokens2Id)
index IX_Messages_RefundId on analytics.Messages(RefundId)
unique index UX_Comments_Code on analytics.Comments(Code)
index IX_Comments_CreatedAt on analytics.Comments(CreatedAt)
unique index UX_Changes_Code on analytics.Changes(Code)
index IX_Changes_CreatedAt on analytics.Changes(CreatedAt)
index IX_Changes_ProductId on analytics.Changes(ProductId)
index IX_Changes_TokenId on analytics.Changes(TokenId)
unique index UX_Categories2_Code on analytics.Categories2(Code)
index IX_Categories2_CreatedAt on analytics.Categories2(CreatedAt)
index IX_Categories2_Carts2Id on analytics.Categories2(Carts2Id)
index IX_Categories2_TaxId on analytics.Categories2(TaxId)
unique index UX_Payments2_Code on analytics.Payments2(Code)
index IX_Payments2_CreatedAt on analytics.Payments2(CreatedAt)
index IX_Payments2_CouponId on analytics.Payments2(CouponId)
unique index UX_Messages2_Code on analytics.Messages2(Code)
index IX_Messages2_CreatedAt on analytics.Messages2(CreatedAt)
index IX_Messages2_InvoiceId on analytics.Messages2(InvoiceId)
unique index UX_Comments2_Code on analytics.Comments2(Code)
index IX_Comments2_CreatedAt on analytics.Comments2(CreatedAt)
index IX_Comments2_RefundId on analytics.Comments2(RefundId)
index IX_Comments2_TokenId on analytics.Comments2(TokenId)
index IX_Comments2_VariantId on analytics.Comments2(VariantId)
unique index UX_Changes2_Code on analytics.Changes2(Code)
index IX_Changes2_CreatedAt on analytics.Changes2(CreatedAt)
unique index UX_Categories3_Code on analytics.Categories3(Code)
index IX_Categories3_CreatedAt on analytics.Categories3(CreatedAt)
unique index UX_Payments3_Code on analytics.Payments3(Code)
index IX_Payments3_CreatedAt on analytics.Payments3(CreatedAt)
index IX_Payments3_Products2Id on analytics.Payments3(Products2Id)
unique index UX_Messages3_Code on analytics.Messages3(Code)
index IX_Messages3_CreatedAt on analytics.Messages3(CreatedAt)
index IX_Messages3_BrandId on analytics.Messages3(BrandId)
unique index UX_Comments3_Code on analytics.Comments3(Code)
index IX_Comments3_CreatedAt on analytics.Comments3(CreatedAt)
index IX_Comments3_Transfers3Id on analytics.Comments3(Transfers3Id)
index IX_Comments3_UserId on analytics.Comments3(UserId)
unique index UX_Changes3_Code on analytics.Changes3(Code)
index IX_Changes3_CreatedAt on analytics.Changes3(CreatedAt)
index IX_Changes3_PaymentId on analytics.Changes3(PaymentId)
index IX_Changes3_OrderId on analytics.Changes3(OrderId)
index IX_Changes3_OrderItemId on analytics.Changes3(OrderItemId)
```

## content（15 張表）

```dbschema
table content.Brands "Content 模組的 Brands" in Content {
  PK  Id        bigint        not null "Brands 主鍵"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      SortOrder decimal(18,2) not null "SortOrder 欄位說明"
      Metadata  bit           not null default 0
      Version   int           null     "Version 欄位說明"
      Notes     datetime2     null     "Notes 欄位說明"
      Priority  bit           null     default 0 "Priority 欄位說明"
      Score     bigint        not null
      Name      nvarchar(50)  not null "Name 欄位說明"
  FK  CouponId  bigint        not null "參照 shipping.Coupons"
  FK  PriceId   bigint        not null "參照 audit.Prices"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table content.Refunds "Content 模組的 Refunds" in Content {
  PK  Id         bigint           not null "Refunds 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   nvarchar(200)    null
      EndsAt     nvarchar(200)    not null "EndsAt 欄位說明"
      IsActive   bit              not null default 0 "IsActive 欄位說明"
      ExternalId int              not null
      Slug       uniqueidentifier not null
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Attachments "Content 模組的 Attachments" in Content {
  PK  Id          bigint           not null "Attachments 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       uniqueidentifier not null
      Description int              null
      Status      nvarchar(50)     null
      Amount      decimal(18,2)    not null "Amount 欄位說明"
      Quantity    nvarchar(4000)   null
      StartsAt    nvarchar(200)    null
      EndsAt      bigint           not null "EndsAt 欄位說明"
      IsActive    nvarchar(4000)   not null "IsActive 欄位說明"
      ExternalId  nvarchar(50)     null     "ExternalId 欄位說明"
      Slug        nvarchar(50)     not null
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Medias "Content 模組的 Medias" in Content {
  PK  Id        bigint        not null "Medias 主鍵"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      Metadata  nvarchar(50)  null     "Metadata 欄位說明"
      Version   bigint        not null "Version 欄位說明"
      Notes     decimal(18,2) not null
      Priority  decimal(18,2) null     "Priority 欄位說明"
      Score     nvarchar(200) null     "Score 欄位說明"
      Name      bigint        null
      Title     bigint        not null "Title 欄位說明"
  FK  InvoiceId bigint        not null "參照 support.Invoices"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table content.Approvals "Content 模組的 Approvals" in Content {
  PK  Id          bigint        not null "Approvals 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      EndsAt      int           null     "EndsAt 欄位說明"
      IsActive    decimal(18,2) not null "IsActive 欄位說明"
      ExternalId  bigint        not null "ExternalId 欄位說明"
      Slug        nvarchar(50)  not null
  FK  Payments3Id bigint        not null "參照 analytics.Payments3"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table content.Brands2 "Content 模組的 Brands2" in Content {
  PK  Id          bigint           not null "Brands2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       decimal(18,2)    null     "Title 欄位說明"
      Description nvarchar(50)     null
      Status      nvarchar(200)    null
      Amount      nvarchar(200)    null     "Amount 欄位說明"
      Quantity    nvarchar(200)    not null
      StartsAt    uniqueidentifier not null
      EndsAt      nvarchar(50)     null     "EndsAt 欄位說明"
      IsActive    nvarchar(200)    not null
      ExternalId  bigint           not null "ExternalId 欄位說明"
      Slug        nvarchar(4000)   null
      Locale      nvarchar(4000)   not null
      SortOrder   int              not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Refunds2 "Content 模組的 Refunds2" in Content {
  PK  Id        bigint         not null "Refunds2 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Version   decimal(18,2)  not null
      Notes     nvarchar(50)   not null
      Priority  nvarchar(200)  null
      Score     nvarchar(4000) not null
      Name      bit            null     default 0
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Attachments2 "Content 模組的 Attachments2" in Content {
  PK  Id          bigint        not null "Attachments2 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      IsActive    int           not null "IsActive 欄位說明"
      ExternalId  decimal(18,2) not null
      Slug        nvarchar(50)  null     "Slug 欄位說明"
      Locale      decimal(18,2) null
  FK  OrderItemId bigint        not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table content.Medias2 "Content 模組的 Medias2" in Content {
  PK  Id          bigint         not null "Medias2 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description int            not null
      Status      decimal(18,2)  null     "Status 欄位說明"
      Amount      nvarchar(4000) not null
      Quantity    nvarchar(4000) not null
      StartsAt    bit            null     default 0 "StartsAt 欄位說明"
      EndsAt      datetime2      null
      IsActive    nvarchar(50)   null
      ExternalId  nvarchar(4000) null
      Slug        nvarchar(4000) not null "Slug 欄位說明"
      Locale      bigint         null
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Approvals2 "Content 模組的 Approvals2" in Content {
  PK  Id          bigint           not null "Approvals2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Notes       decimal(18,2)    not null "Notes 欄位說明"
      Priority    nvarchar(200)    not null
      Score       int              null
      Name        decimal(18,2)    not null
      Title       uniqueidentifier null     "Title 欄位說明"
      Description decimal(18,2)    not null
      Status      nvarchar(4000)   not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Brands3 "Content 模組的 Brands3" in Content {
  PK  Id         bigint        not null "Brands3 主鍵"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      ExternalId bit           not null default 0 "ExternalId 欄位說明"
      Slug       decimal(18,2) null
      Locale     int           not null
      SortOrder  datetime2     null
      Metadata   nvarchar(200) not null "Metadata 欄位說明"
      Version    bigint        null
      Notes      datetime2     null
      Priority   nvarchar(200) not null
      Score      bigint        null     "Score 欄位說明"
  FK  CartId     bigint        not null "參照 sales.Carts"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table content.Refunds3 "Content 模組的 Refunds3" in Content {
  PK  Id         bigint           not null "Refunds3 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     nvarchar(200)    null     "Status 欄位說明"
      Amount     nvarchar(200)    not null "Amount 欄位說明"
      Quantity   datetime2        not null
      StartsAt   bigint           not null "StartsAt 欄位說明"
      EndsAt     bit              null     default 0 "EndsAt 欄位說明"
      IsActive   uniqueidentifier not null "IsActive 欄位說明"
      ExternalId nvarchar(50)     null
      Slug       uniqueidentifier null     "Slug 欄位說明"
      Locale     nvarchar(200)    not null "Locale 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table content.Attachments3 "Content 模組的 Attachments3" in Content {
  PK  Id           bigint         not null "Attachments3 主鍵"
  UQ  Code         nvarchar(64)   not null "業務代碼"
      Priority     bigint         null
      Score        bigint         null
      Name         datetime2      null
      Title        nvarchar(200)  not null "Title 欄位說明"
      Description  bit            not null default 0 "Description 欄位說明"
      Status       decimal(18,2)  not null "Status 欄位說明"
      Amount       bigint         not null
      Quantity     nvarchar(50)   not null "Quantity 欄位說明"
      StartsAt     nvarchar(50)   null
      EndsAt       bit            null     default 0 "EndsAt 欄位說明"
      IsActive     nvarchar(4000) null
  FK  Addresses3Id bigint         not null "參照 catalog.Addresses3"
  IDX CreatedAt    datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Medias3 "Content 模組的 Medias3" in Content {
  PK  Id        bigint         not null "Medias3 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Slug      nvarchar(4000) not null
      Locale    datetime2      not null "Locale 欄位說明"
      SortOrder int            null     "SortOrder 欄位說明"
      Metadata  decimal(18,2)  not null
  FK  CouponId  bigint         not null "參照 shipping.Coupons"
  FK  InvoiceId bigint         not null "參照 support.Invoices"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table content.Approvals3 "Content 模組的 Approvals3" in Content {
  PK  Id         bigint           not null "Approvals3 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     nvarchar(200)    null
      Quantity   datetime2        not null
      StartsAt   datetime2        null
      EndsAt     nvarchar(50)     null     "EndsAt 欄位說明"
      IsActive   datetime2        not null
      ExternalId uniqueidentifier not null
      Slug       datetime2        not null
      Locale     uniqueidentifier not null
      SortOrder  nvarchar(4000)   not null
      Metadata   decimal(18,2)    not null
  FK  TokenId    bigint           not null "參照 dbo.Tokens"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Brands_Code on content.Brands(Code)
index IX_Brands_CreatedAt on content.Brands(CreatedAt)
index IX_Brands_CouponId on content.Brands(CouponId)
index IX_Brands_PriceId on content.Brands(PriceId)
unique index UX_Refunds_Code on content.Refunds(Code)
index IX_Refunds_CreatedAt on content.Refunds(CreatedAt)
unique index UX_Attachments_Code on content.Attachments(Code)
index IX_Attachments_CreatedAt on content.Attachments(CreatedAt)
index IX_Attachments_OrderItemId on content.Attachments(OrderItemId)
unique index UX_Medias_Code on content.Medias(Code)
index IX_Medias_CreatedAt on content.Medias(CreatedAt)
index IX_Medias_InvoiceId on content.Medias(InvoiceId)
unique index UX_Approvals_Code on content.Approvals(Code)
index IX_Approvals_CreatedAt on content.Approvals(CreatedAt)
index IX_Approvals_Payments3Id on content.Approvals(Payments3Id)
unique index UX_Brands2_Code on content.Brands2(Code)
index IX_Brands2_CreatedAt on content.Brands2(CreatedAt)
unique index UX_Refunds2_Code on content.Refunds2(Code)
index IX_Refunds2_CreatedAt on content.Refunds2(CreatedAt)
unique index UX_Attachments2_Code on content.Attachments2(Code)
index IX_Attachments2_CreatedAt on content.Attachments2(CreatedAt)
index IX_Attachments2_OrderItemId on content.Attachments2(OrderItemId)
unique index UX_Medias2_Code on content.Medias2(Code)
index IX_Medias2_CreatedAt on content.Medias2(CreatedAt)
unique index UX_Approvals2_Code on content.Approvals2(Code)
index IX_Approvals2_CreatedAt on content.Approvals2(CreatedAt)
unique index UX_Brands3_Code on content.Brands3(Code)
index IX_Brands3_CreatedAt on content.Brands3(CreatedAt)
index IX_Brands3_CartId on content.Brands3(CartId)
unique index UX_Refunds3_Code on content.Refunds3(Code)
index IX_Refunds3_CreatedAt on content.Refunds3(CreatedAt)
unique index UX_Attachments3_Code on content.Attachments3(Code)
index IX_Attachments3_CreatedAt on content.Attachments3(CreatedAt)
index IX_Attachments3_Addresses3Id on content.Attachments3(Addresses3Id)
unique index UX_Medias3_Code on content.Medias3(Code)
index IX_Medias3_CreatedAt on content.Medias3(CreatedAt)
index IX_Medias3_CouponId on content.Medias3(CouponId)
index IX_Medias3_InvoiceId on content.Medias3(InvoiceId)
unique index UX_Approvals3_Code on content.Approvals3(Code)
index IX_Approvals3_CreatedAt on content.Approvals3(CreatedAt)
index IX_Approvals3_TokenId on content.Approvals3(TokenId)
```

## inventory（15 張表）

```dbschema
table inventory.Variants "Inventory 模組的 Variants" in Inventory {
  PK  Id          bigint         not null "Variants 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       datetime2      not null "Title 欄位說明"
      Description nvarchar(4000) null     "Description 欄位說明"
  FK  CartItemId  bigint         not null "參照 billing.CartItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Ledgers "Inventory 模組的 Ledgers" in Inventory {
  PK  Id        bigint         not null "Ledgers 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Metadata  datetime2      not null "Metadata 欄位說明"
      Version   decimal(18,2)  null     "Version 欄位說明"
      Notes     nvarchar(4000) null
      Priority  nvarchar(50)   not null "Priority 欄位說明"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Tags "Inventory 模組的 Tags" in Inventory {
  PK  Id          bigint         not null "Tags 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      EndsAt      nvarchar(4000) not null "EndsAt 欄位說明"
      IsActive    decimal(18,2)  not null
      ExternalId  int            not null
      Slug        decimal(18,2)  not null "Slug 欄位說明"
      Locale      nvarchar(4000) not null "Locale 欄位說明"
      SortOrder   nvarchar(200)  null
      Metadata    int            not null "Metadata 欄位說明"
      Version     int            not null
      Notes       bigint         null
  FK  UserId      bigint         not null "參照 dbo.Users"
  FK  OrderItemId bigint         not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Pages "Inventory 模組的 Pages" in Inventory {
  PK  Id            bigint           not null "Pages 主鍵"
  UQ  Code          nvarchar(64)     not null "業務代碼"
      Title         nvarchar(4000)   null
      Description   bit              not null default 0
      Status        bigint           not null
      Amount        bigint           not null
      Quantity      nvarchar(4000)   null
      StartsAt      uniqueidentifier not null
      EndsAt        nvarchar(50)     not null "EndsAt 欄位說明"
  FK  OrderItems3Id bigint           not null "參照 catalog.OrderItems3"
  IDX CreatedAt     datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Policies "Inventory 模組的 Policies" in Inventory {
  PK  Id          bigint           not null "Policies 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Version     nvarchar(4000)   null
      Notes       int              null
      Priority    nvarchar(4000)   null
      Score       uniqueidentifier not null "Score 欄位說明"
      Name        bit              not null default 0 "Name 欄位說明"
      Title       bigint           null
      Description int              not null
      Status      bit              null     default 0
  FK  PriceId     bigint           not null "參照 audit.Prices"
  FK  Medias3Id   bigint           not null "參照 content.Medias3"
  FK  Invoices2Id bigint           not null "參照 support.Invoices2"
  FK  UserId      bigint           not null "參照 dbo.Users"
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  FK  PaymentId   bigint           not null "參照 analytics.Payments"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Variants2 "Inventory 模組的 Variants2" in Inventory {
  PK  Id         bigint        not null "Variants2 主鍵"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      IsActive   decimal(18,2) null
      ExternalId bit           not null default 0 "ExternalId 欄位說明"
      Slug       datetime2     not null "Slug 欄位說明"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table inventory.Ledgers2 "Inventory 模組的 Ledgers2" in Inventory {
  PK  Id           bigint         not null "Ledgers2 主鍵"
  UQ  Code         nvarchar(64)   not null "業務代碼"
      Description  bit            null     default 0
      Status       datetime2      null     "Status 欄位說明"
      Amount       nvarchar(4000) not null
      Quantity     nvarchar(200)  not null
      StartsAt     nvarchar(200)  null
      EndsAt       int            not null "EndsAt 欄位說明"
  FK  TokenId      bigint         not null "參照 dbo.Tokens"
  FK  Templates2Id bigint         not null "參照 audit.Templates2"
  FK  PermissionId bigint         not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Tags2 "Inventory 模組的 Tags2" in Inventory {
  PK  Id          bigint           not null "Tags2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Notes       datetime2        not null "Notes 欄位說明"
      Priority    bigint           null
      Score       nvarchar(4000)   null     "Score 欄位說明"
      Name        nvarchar(50)     not null
      Title       int              null     "Title 欄位說明"
      Description bit              null     default 0 "Description 欄位說明"
      Status      uniqueidentifier null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Pages2 "Inventory 模組的 Pages2" in Inventory {
  PK  Id         bigint         not null "Pages2 主鍵"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      ExternalId bit            not null default 0
      Slug       bigint         not null
      Locale     bit            null     default 0 "Locale 欄位說明"
      SortOrder  nvarchar(4000) null     "SortOrder 欄位說明"
      Metadata   bit            not null default 0
      Version    nvarchar(4000) not null
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Policies2 "Inventory 模組的 Policies2" in Inventory {
  PK  Id          bigint         not null "Policies2 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Status      nvarchar(50)   not null
      Amount      nvarchar(4000) null
      Quantity    int            null     "Quantity 欄位說明"
      StartsAt    nvarchar(200)  null     "StartsAt 欄位說明"
      EndsAt      bit            not null default 0
      IsActive    datetime2      null
      ExternalId  int            not null
      Slug        nvarchar(50)   not null
      Locale      bigint         null     "Locale 欄位說明"
  FK  Carriers2Id bigint         not null "參照 sales.Carriers2"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table inventory.Variants3 "Inventory 模組的 Variants3" in Inventory {
  PK  Id          bigint        not null "Variants3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Priority    decimal(18,2) null     "Priority 欄位說明"
      Score       int           null
      Name        bigint        not null "Name 欄位說明"
  FK  CategorieId bigint        not null "參照 analytics.Categories"
  FK  ProductId   bigint        not null "參照 dbo.Products"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table inventory.Ledgers3 "Inventory 模組的 Ledgers3" in Inventory {
  PK  Id           bigint           not null "Ledgers3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Slug         bigint           null
      Locale       uniqueidentifier null     "Locale 欄位說明"
      SortOrder    bit              not null default 0
      Metadata     datetime2        null
      Version      nvarchar(50)     not null "Version 欄位說明"
      Notes        bigint           not null
      Priority     uniqueidentifier not null
  FK  PermissionId bigint           not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Tags3 "Inventory 模組的 Tags3" in Inventory {
  PK  Id          bigint           not null "Tags3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Amount      nvarchar(200)    not null
      Quantity    uniqueidentifier null     "Quantity 欄位說明"
      StartsAt    uniqueidentifier null
      EndsAt      nvarchar(50)     null
      IsActive    nvarchar(50)     null
      ExternalId  decimal(18,2)    null     "ExternalId 欄位說明"
      Slug        nvarchar(50)     not null
      Locale      uniqueidentifier null
      SortOrder   decimal(18,2)    null     "SortOrder 欄位說明"
      Metadata    datetime2        null     "Metadata 欄位說明"
  FK  CategorieId bigint           not null "參照 analytics.Categories"
  FK  RoleId      bigint           not null "參照 dbo.Roles"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Pages3 "Inventory 模組的 Pages3" in Inventory {
  PK  Id          bigint           not null "Pages3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Score       nvarchar(200)    null
      Name        nvarchar(50)     null
      Title       int              not null
      Description bigint           not null
      Status      bit              null     default 0 "Status 欄位說明"
      Amount      uniqueidentifier not null
      Quantity    nvarchar(4000)   null
      StartsAt    decimal(18,2)    null
      EndsAt      datetime2        not null
      IsActive    int              not null "IsActive 欄位說明"
      ExternalId  nvarchar(50)     not null "ExternalId 欄位說明"
  FK  SessionId   bigint           not null "參照 dbo.Sessions"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table inventory.Policies3 "Inventory 模組的 Policies3" in Inventory {
  PK  Id           bigint        not null "Policies3 主鍵"
  UQ  Code         nvarchar(64)  not null "業務代碼"
      Locale       bit           not null default 0 "Locale 欄位說明"
      SortOrder    datetime2     null
      Metadata     nvarchar(50)  null
      Version      datetime2     not null
      Notes        datetime2     not null "Notes 欄位說明"
      Priority     decimal(18,2) null
      Score        decimal(18,2) null     "Score 欄位說明"
      Name         bit           null     default 0 "Name 欄位說明"
      Title        int           null
      Description  decimal(18,2) not null
  FK  Purchases2Id bigint        not null "參照 shipping.Purchases2"
  FK  TokenId      bigint        not null "參照 dbo.Tokens"
  IDX CreatedAt    datetime2     not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Variants_Code on inventory.Variants(Code)
index IX_Variants_CreatedAt on inventory.Variants(CreatedAt)
index IX_Variants_CartItemId on inventory.Variants(CartItemId)
unique index UX_Ledgers_Code on inventory.Ledgers(Code)
index IX_Ledgers_CreatedAt on inventory.Ledgers(CreatedAt)
unique index UX_Tags_Code on inventory.Tags(Code)
index IX_Tags_CreatedAt on inventory.Tags(CreatedAt)
index IX_Tags_UserId on inventory.Tags(UserId)
index IX_Tags_OrderItemId on inventory.Tags(OrderItemId)
unique index UX_Pages_Code on inventory.Pages(Code)
index IX_Pages_CreatedAt on inventory.Pages(CreatedAt)
index IX_Pages_OrderItems3Id on inventory.Pages(OrderItems3Id)
unique index UX_Policies_Code on inventory.Policies(Code)
index IX_Policies_CreatedAt on inventory.Policies(CreatedAt)
index IX_Policies_PriceId on inventory.Policies(PriceId)
index IX_Policies_Medias3Id on inventory.Policies(Medias3Id)
index IX_Policies_Invoices2Id on inventory.Policies(Invoices2Id)
index IX_Policies_UserId on inventory.Policies(UserId)
index IX_Policies_OrderItemId on inventory.Policies(OrderItemId)
index IX_Policies_PaymentId on inventory.Policies(PaymentId)
unique index UX_Variants2_Code on inventory.Variants2(Code)
index IX_Variants2_CreatedAt on inventory.Variants2(CreatedAt)
unique index UX_Ledgers2_Code on inventory.Ledgers2(Code)
index IX_Ledgers2_CreatedAt on inventory.Ledgers2(CreatedAt)
index IX_Ledgers2_TokenId on inventory.Ledgers2(TokenId)
index IX_Ledgers2_Templates2Id on inventory.Ledgers2(Templates2Id)
index IX_Ledgers2_PermissionId on inventory.Ledgers2(PermissionId)
unique index UX_Tags2_Code on inventory.Tags2(Code)
index IX_Tags2_CreatedAt on inventory.Tags2(CreatedAt)
unique index UX_Pages2_Code on inventory.Pages2(Code)
index IX_Pages2_CreatedAt on inventory.Pages2(CreatedAt)
unique index UX_Policies2_Code on inventory.Policies2(Code)
index IX_Policies2_CreatedAt on inventory.Policies2(CreatedAt)
index IX_Policies2_Carriers2Id on inventory.Policies2(Carriers2Id)
unique index UX_Variants3_Code on inventory.Variants3(Code)
index IX_Variants3_CreatedAt on inventory.Variants3(CreatedAt)
index IX_Variants3_CategorieId on inventory.Variants3(CategorieId)
index IX_Variants3_ProductId on inventory.Variants3(ProductId)
unique index UX_Ledgers3_Code on inventory.Ledgers3(Code)
index IX_Ledgers3_CreatedAt on inventory.Ledgers3(CreatedAt)
index IX_Ledgers3_PermissionId on inventory.Ledgers3(PermissionId)
unique index UX_Tags3_Code on inventory.Tags3(Code)
index IX_Tags3_CreatedAt on inventory.Tags3(CreatedAt)
index IX_Tags3_CategorieId on inventory.Tags3(CategorieId)
index IX_Tags3_RoleId on inventory.Tags3(RoleId)
unique index UX_Pages3_Code on inventory.Pages3(Code)
index IX_Pages3_CreatedAt on inventory.Pages3(CreatedAt)
index IX_Pages3_SessionId on inventory.Pages3(SessionId)
unique index UX_Policies3_Code on inventory.Policies3(Code)
index IX_Policies3_CreatedAt on inventory.Policies3(CreatedAt)
index IX_Policies3_Purchases2Id on inventory.Policies3(Purchases2Id)
index IX_Policies3_TokenId on inventory.Policies3(TokenId)
```

## audit（15 張表）

```dbschema
table audit.Prices "Audit 模組的 Prices" in Audit {
  PK  Id           bigint           not null "Prices 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      EndsAt       uniqueidentifier null     "EndsAt 欄位說明"
      IsActive     bigint           not null
      ExternalId   int              null     "ExternalId 欄位說明"
      Slug         bigint           null
      Locale       bigint           null     "Locale 欄位說明"
  FK  PermissionId bigint           not null "參照 dbo.Permissions"
  FK  StockId      bigint           not null "參照 catalog.Stocks"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Taxs "Audit 模組的 Taxs" in Audit {
  PK  Id          bigint           not null "Taxs 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       decimal(18,2)    null
      Description nvarchar(4000)   null     "Description 欄位說明"
      Status      decimal(18,2)    not null
      Amount      nvarchar(4000)   null
      Quantity    bit              not null default 0 "Quantity 欄位說明"
      StartsAt    nvarchar(50)     null
      EndsAt      uniqueidentifier null
      IsActive    nvarchar(4000)   not null
  FK  BrandId     bigint           not null "參照 content.Brands"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Notes "Audit 模組的 Notes" in Audit {
  PK  Id          bigint           not null "Notes 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Version     nvarchar(4000)   not null
      Notes       decimal(18,2)    null     "Notes 欄位說明"
      Priority    uniqueidentifier not null "Priority 欄位說明"
      Score       bit              not null default 0
      Name        uniqueidentifier null     "Name 欄位說明"
      Title       bigint           not null
      Description nvarchar(50)     null     "Description 欄位說明"
      Status      uniqueidentifier null     "Status 欄位說明"
      Amount      nvarchar(50)     not null "Amount 欄位說明"
      Quantity    nvarchar(50)     null
      StartsAt    nvarchar(4000)   null
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Templates "Audit 模組的 Templates" in Audit {
  PK  Id          bigint           not null "Templates 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      IsActive    datetime2        not null
      ExternalId  uniqueidentifier null
      Slug        bigint           null
      Locale      bigint           not null
      SortOrder   decimal(18,2)    null
      Metadata    bigint           null     "Metadata 欄位說明"
      Version     bigint           null
      Notes       nvarchar(4000)   not null "Notes 欄位說明"
      Priority    nvarchar(4000)   null     "Priority 欄位說明"
      Score       nvarchar(4000)   null
      Name        bigint           null
  FK  PaymentId   bigint           not null "參照 analytics.Payments"
  FK  CategorieId bigint           not null "參照 analytics.Categories"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings "Audit 模組的 Settings" in Audit {
  PK  Id          bigint         not null "Settings 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Description datetime2      not null
      Status      nvarchar(4000) not null
      Amount      nvarchar(4000) null     "Amount 欄位說明"
      Quantity    int            null
      StartsAt    nvarchar(50)   null     "StartsAt 欄位說明"
      EndsAt      nvarchar(200)  null
      IsActive    int            null     "IsActive 欄位說明"
      ExternalId  decimal(18,2)  not null
      Slug        nvarchar(50)   null
  FK  PaymentId   bigint         not null "參照 analytics.Payments"
  FK  CategorieId bigint         not null "參照 analytics.Categories"
  FK  CartItemId  bigint         not null "參照 billing.CartItems"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Prices2 "Audit 模組的 Prices2" in Audit {
  PK  Id          bigint           not null "Prices2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Notes       decimal(18,2)    not null
      Priority    datetime2        not null
      Score       int              not null
      Name        bigint           null     "Name 欄位說明"
      Title       decimal(18,2)    not null
      Description uniqueidentifier not null "Description 欄位說明"
      Status      nvarchar(4000)   null     "Status 欄位說明"
      Amount      nvarchar(200)    null
      Quantity    datetime2        not null "Quantity 欄位說明"
      StartsAt    int              not null
  FK  CategorieId bigint           not null "參照 analytics.Categories"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Taxs2 "Audit 模組的 Taxs2" in Audit {
  PK  Id           bigint           not null "Taxs2 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      ExternalId   uniqueidentifier not null "ExternalId 欄位說明"
      Slug         uniqueidentifier null
      Locale       uniqueidentifier null
      SortOrder    decimal(18,2)    not null
      Metadata     datetime2        null     "Metadata 欄位說明"
      Version      decimal(18,2)    null
      Notes        nvarchar(200)    not null
      Priority     bigint           not null
  FK  Templates3Id bigint           not null "參照 audit.Templates3"
  FK  OrderId      bigint           not null "參照 identity.Orders"
  FK  ProductId    bigint           not null "參照 dbo.Products"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Notes2 "Audit 模組的 Notes2" in Audit {
  PK  Id        bigint       not null "Notes2 主鍵"
  UQ  Code      nvarchar(64) not null "業務代碼"
      Status    bit          not null default 0
      Amount    nvarchar(50) not null "Amount 欄位說明"
      Quantity  bit          not null default 0
  FK  PriceId   bigint       not null "參照 audit.Prices"
  IDX CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table audit.Templates2 "Audit 模組的 Templates2" in Audit {
  PK  Id          bigint        not null "Templates2 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Priority    datetime2     null
      Score       decimal(18,2) null     "Score 欄位說明"
      Name        bit           not null default 0
      Title       bigint        not null
      Description int           null     "Description 欄位說明"
      Status      datetime2     null
      Amount      bit           null     default 0 "Amount 欄位說明"
  FK  RoleId      bigint        not null "參照 dbo.Roles"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings2 "Audit 模組的 Settings2" in Audit {
  PK  Id        bigint           not null "Settings2 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Slug      decimal(18,2)    null     "Slug 欄位說明"
      Locale    bit              null     default 0 "Locale 欄位說明"
      SortOrder nvarchar(50)     not null "SortOrder 欄位說明"
      Metadata  datetime2        null     "Metadata 欄位說明"
      Version   uniqueidentifier null     "Version 欄位說明"
      Notes     datetime2        null
  FK  RoleId    bigint           not null "參照 dbo.Roles"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Prices3 "Audit 模組的 Prices3" in Audit {
  PK  Id          bigint         not null "Prices3 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Amount      nvarchar(200)  null     "Amount 欄位說明"
      Quantity    int            null     "Quantity 欄位說明"
      StartsAt    bit            not null default 0 "StartsAt 欄位說明"
      EndsAt      nvarchar(50)   null
      IsActive    nvarchar(4000) not null
      ExternalId  bit            null     default 0
      Slug        nvarchar(200)  null
      Locale      bigint         not null "Locale 欄位說明"
      SortOrder   decimal(18,2)  not null "SortOrder 欄位說明"
      Metadata    int            null
      Version     nvarchar(4000) null     "Version 欄位說明"
  FK  WarehouseId bigint         not null "參照 identity.Warehouses"
  FK  SessionId   bigint         not null "參照 dbo.Sessions"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Taxs3 "Audit 模組的 Taxs3" in Audit {
  PK  Id          bigint           not null "Taxs3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Score       nvarchar(200)    not null "Score 欄位說明"
      Name        nvarchar(4000)   not null "Name 欄位說明"
      Title       nvarchar(200)    not null
      Description bigint           null
      Status      nvarchar(4000)   null
      Amount      bit              null     default 0
      Quantity    uniqueidentifier not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Notes3 "Audit 模組的 Notes3" in Audit {
  PK  Id        bigint           not null "Notes3 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Locale    int              null     "Locale 欄位說明"
      SortOrder int              not null "SortOrder 欄位說明"
      Metadata  nvarchar(4000)   not null
      Version   datetime2        not null "Version 欄位說明"
      Notes     datetime2        not null "Notes 欄位說明"
      Priority  datetime2        not null "Priority 欄位說明"
      Score     uniqueidentifier null
      Name      bigint           not null "Name 欄位說明"
      Title     bit              not null default 0 "Title 欄位說明"
  FK  CouponId  bigint           not null "參照 shipping.Coupons"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table audit.Templates3 "Audit 模組的 Templates3" in Audit {
  PK    Id         bigint         not null "Templates3 主鍵"
  UQ    Code       nvarchar(64)   not null "業務代碼"
        Quantity   nvarchar(4000) not null
        StartsAt   nvarchar(4000) null     "StartsAt 欄位說明"
        EndsAt     nvarchar(4000) not null
        IsActive   nvarchar(4000) not null
        ExternalId decimal(18,2)  null     "ExternalId 欄位說明"
        Slug       datetime2      null
        Locale     bit            not null default 0
        SortOrder  int            not null "SortOrder 欄位說明"
        Metadata   int            not null
  FK UQ ProductId  bigint         null     "參照 dbo.Products"
  IDX   CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table audit.Settings3 "Audit 模組的 Settings3" in Audit {
  PK  Id          bigint         not null "Settings3 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Name        int            null
      Title       bit            not null default 0
      Description int            not null
      Status      datetime2      null
      Amount      int            null     "Amount 欄位說明"
      Quantity    bit            null     default 0 "Quantity 欄位說明"
      StartsAt    nvarchar(4000) not null
  FK  UserId      bigint         not null "參照 dbo.Users"
  FK  ProductId   bigint         not null "參照 dbo.Products"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Prices_Code on audit.Prices(Code)
index IX_Prices_CreatedAt on audit.Prices(CreatedAt)
index IX_Prices_PermissionId on audit.Prices(PermissionId)
index IX_Prices_StockId on audit.Prices(StockId)
unique index UX_Taxs_Code on audit.Taxs(Code)
index IX_Taxs_CreatedAt on audit.Taxs(CreatedAt)
index IX_Taxs_BrandId on audit.Taxs(BrandId)
unique index UX_Notes_Code on audit.Notes(Code)
index IX_Notes_CreatedAt on audit.Notes(CreatedAt)
index IX_Notes_OrderItemId on audit.Notes(OrderItemId)
unique index UX_Templates_Code on audit.Templates(Code)
index IX_Templates_CreatedAt on audit.Templates(CreatedAt)
index IX_Templates_PaymentId on audit.Templates(PaymentId)
index IX_Templates_CategorieId on audit.Templates(CategorieId)
unique index UX_Settings_Code on audit.Settings(Code)
index IX_Settings_CreatedAt on audit.Settings(CreatedAt)
index IX_Settings_PaymentId on audit.Settings(PaymentId)
index IX_Settings_CategorieId on audit.Settings(CategorieId)
index IX_Settings_CartItemId on audit.Settings(CartItemId)
unique index UX_Prices2_Code on audit.Prices2(Code)
index IX_Prices2_CreatedAt on audit.Prices2(CreatedAt)
index IX_Prices2_CategorieId on audit.Prices2(CategorieId)
unique index UX_Taxs2_Code on audit.Taxs2(Code)
index IX_Taxs2_CreatedAt on audit.Taxs2(CreatedAt)
index IX_Taxs2_Templates3Id on audit.Taxs2(Templates3Id)
index IX_Taxs2_OrderId on audit.Taxs2(OrderId)
index IX_Taxs2_ProductId on audit.Taxs2(ProductId)
unique index UX_Notes2_Code on audit.Notes2(Code)
index IX_Notes2_CreatedAt on audit.Notes2(CreatedAt)
index IX_Notes2_PriceId on audit.Notes2(PriceId)
unique index UX_Templates2_Code on audit.Templates2(Code)
index IX_Templates2_CreatedAt on audit.Templates2(CreatedAt)
index IX_Templates2_RoleId on audit.Templates2(RoleId)
unique index UX_Settings2_Code on audit.Settings2(Code)
index IX_Settings2_CreatedAt on audit.Settings2(CreatedAt)
index IX_Settings2_RoleId on audit.Settings2(RoleId)
unique index UX_Prices3_Code on audit.Prices3(Code)
index IX_Prices3_CreatedAt on audit.Prices3(CreatedAt)
index IX_Prices3_WarehouseId on audit.Prices3(WarehouseId)
index IX_Prices3_SessionId on audit.Prices3(SessionId)
unique index UX_Taxs3_Code on audit.Taxs3(Code)
index IX_Taxs3_CreatedAt on audit.Taxs3(CreatedAt)
unique index UX_Notes3_Code on audit.Notes3(Code)
index IX_Notes3_CreatedAt on audit.Notes3(CreatedAt)
index IX_Notes3_CouponId on audit.Notes3(CouponId)
unique index UX_Templates3_Code on audit.Templates3(Code)
index IX_Templates3_CreatedAt on audit.Templates3(CreatedAt)
index IX_Templates3_ProductId on audit.Templates3(ProductId)
unique index UX_Settings3_Code on audit.Settings3(Code)
index IX_Settings3_CreatedAt on audit.Settings3(CreatedAt)
index IX_Settings3_UserId on audit.Settings3(UserId)
index IX_Settings3_ProductId on audit.Settings3(ProductId)
```

## identity（14 張表）

```dbschema
table identity.Orders "Identity 模組的 Orders" in Identity {
  PK  Id        bigint           not null "Orders 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Version   int              null     "Version 欄位說明"
      Notes     int              not null "Notes 欄位說明"
      Priority  uniqueidentifier not null "Priority 欄位說明"
      Score     nvarchar(200)    not null "Score 欄位說明"
      Name      int              not null "Name 欄位說明"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Shipments "Identity 模組的 Shipments" in Identity {
  PK  Id         bigint        not null "Shipments 主鍵"
  UQ  Code       nvarchar(64)  not null "業務代碼"
      IsActive   int           not null "IsActive 欄位說明"
      ExternalId bit           not null default 0 "ExternalId 欄位說明"
      Slug       bigint        null     "Slug 欄位說明"
      Locale     bigint        null
      SortOrder  nvarchar(200) not null
      Metadata   bigint        null     "Metadata 欄位說明"
  FK  SessionId  bigint        not null "參照 dbo.Sessions"
  IDX CreatedAt  datetime2     not null default "sysutcdatetime()" "建立時間"
}

table identity.Events "Identity 模組的 Events" in Identity {
  PK  Id          bigint           not null "Events 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description decimal(18,2)    not null "Description 欄位說明"
      Status      nvarchar(4000)   null     "Status 欄位說明"
      Amount      nvarchar(200)    null     "Amount 欄位說明"
      Quantity    int              not null
      StartsAt    uniqueidentifier null
      EndsAt      decimal(18,2)    null
      IsActive    int              null     "IsActive 欄位說明"
      ExternalId  decimal(18,2)    null
  FK  RefundId    bigint           not null "參照 content.Refunds"
  FK  CartId      bigint           not null "參照 sales.Carts"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Warehouses "Identity 模組的 Warehouses" in Identity {
  PK  Id          bigint         not null "Warehouses 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Notes       int            null
      Priority    bigint         null     "Priority 欄位說明"
      Score       nvarchar(4000) null
      Name        datetime2      null
      Title       nvarchar(4000) not null "Title 欄位說明"
      Description int            not null
      Status      datetime2      not null
      Amount      int            null     "Amount 欄位說明"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Users2 "Identity 模組的 Users2" in Identity {
  PK  Id           bigint           not null "Users2 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      ExternalId   nvarchar(50)     null
      Slug         nvarchar(50)     not null
      Locale       uniqueidentifier not null
      SortOrder    nvarchar(50)     not null "SortOrder 欄位說明"
      Metadata     int              not null
      Version      uniqueidentifier not null "Version 欄位說明"
      Notes        nvarchar(200)    null     "Notes 欄位說明"
  FK  Approvals2Id bigint           not null "參照 content.Approvals2"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Orders2 "Identity 模組的 Orders2" in Identity {
  PK  Id           bigint         not null "Orders2 主鍵"
  UQ  Code         nvarchar(64)   not null "業務代碼"
      Status       nvarchar(200)  not null
      Amount       decimal(18,2)  null     "Amount 欄位說明"
      Quantity     bit            null     default 0 "Quantity 欄位說明"
      StartsAt     nvarchar(4000) null
      EndsAt       nvarchar(4000) null     "EndsAt 欄位說明"
      IsActive     nvarchar(50)   null
      ExternalId   decimal(18,2)  not null
      Slug         decimal(18,2)  null
      Locale       nvarchar(50)   null
      SortOrder    bigint         not null
  FK  LedgerId     bigint         not null "參照 inventory.Ledgers"
  FK  Approvals3Id bigint         not null "參照 content.Approvals3"
  IDX CreatedAt    datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Shipments2 "Identity 模組的 Shipments2" in Identity {
  PK  Id          bigint           not null "Shipments2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Priority    nvarchar(4000)   not null
      Score       nvarchar(50)     not null "Score 欄位說明"
      Name        datetime2        null
      Title       datetime2        null
      Description uniqueidentifier null     "Description 欄位說明"
      Status      nvarchar(4000)   not null
      Amount      uniqueidentifier not null "Amount 欄位說明"
      Quantity    nvarchar(200)    not null "Quantity 欄位說明"
      StartsAt    nvarchar(4000)   not null "StartsAt 欄位說明"
      EndsAt      datetime2        not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Events2 "Identity 模組的 Events2" in Identity {
  PK  Id             bigint         not null "Events2 主鍵"
  UQ  Code           nvarchar(64)   not null "業務代碼"
      Slug           nvarchar(50)   null
      Locale         bigint         not null
      SortOrder      nvarchar(200)  not null "SortOrder 欄位說明"
      Metadata       nvarchar(4000) null
  FK  SessionId      bigint         not null "參照 dbo.Sessions"
  FK  Attachments2Id bigint         not null "參照 content.Attachments2"
  IDX CreatedAt      datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Warehouses2 "Identity 模組的 Warehouses2" in Identity {
  PK  Id         bigint         not null "Warehouses2 主鍵"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      Amount     nvarchar(4000) not null "Amount 欄位說明"
      Quantity   nvarchar(50)   not null "Quantity 欄位說明"
      StartsAt   bigint         null
      EndsAt     bigint         not null
      IsActive   nvarchar(50)   null
      ExternalId int            not null
      Slug       nvarchar(4000) null     "Slug 欄位說明"
      Locale     int            null     "Locale 欄位說明"
      SortOrder  nvarchar(200)  null
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table identity.Users3 "Identity 模組的 Users3" in Identity {
  PK  Id          bigint        not null "Users3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Score       datetime2     null
      Name        bigint        null     "Name 欄位說明"
      Title       nvarchar(200) not null "Title 欄位說明"
      Description nvarchar(50)  null
      Status      datetime2     null     "Status 欄位說明"
  FK  TokenId     bigint        not null "參照 dbo.Tokens"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table identity.Orders3 "Identity 模組的 Orders3" in Identity {
  PK  Id        bigint        not null "Orders3 主鍵"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      Locale    decimal(18,2) null
      SortOrder datetime2     null
      Metadata  nvarchar(200) null     "Metadata 欄位說明"
      Version   nvarchar(200) null
  FK  CommentId bigint        not null "參照 analytics.Comments"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table identity.Shipments3 "Identity 模組的 Shipments3" in Identity {
  PK  Id          bigint       not null "Shipments3 主鍵"
  UQ  Code        nvarchar(64) not null "業務代碼"
      Quantity    bit          null     default 0 "Quantity 欄位說明"
      StartsAt    datetime2    not null "StartsAt 欄位說明"
      EndsAt      bit          not null default 0 "EndsAt 欄位說明"
      IsActive    datetime2    null     "IsActive 欄位說明"
  FK  DashboardId bigint       not null "參照 billing.Dashboards"
  FK  EventId     bigint       not null "參照 identity.Events"
  FK  CouponId    bigint       not null "參照 shipping.Coupons"
  FK  LedgerId    bigint       not null "參照 inventory.Ledgers"
  IDX CreatedAt   datetime2    not null default "sysutcdatetime()" "建立時間"
}

table identity.Events3 "Identity 模組的 Events3" in Identity {
  PK  Id          bigint           not null "Events3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        nvarchar(50)     not null
      Title       nvarchar(200)    null     "Title 欄位說明"
      Description uniqueidentifier not null "Description 欄位說明"
      Status      bigint           null
      Amount      uniqueidentifier null     "Amount 欄位說明"
      Quantity    uniqueidentifier null
      StartsAt    uniqueidentifier not null
  FK  CartItemId  bigint           not null "參照 billing.CartItems"
  FK  RoleId      bigint           not null "參照 dbo.Roles"
  FK  CategorieId bigint           not null "參照 analytics.Categories"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table identity.Warehouses3 "Identity 模組的 Warehouses3" in Identity {
  PK  Id        bigint           not null "Warehouses3 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      SortOrder nvarchar(200)    not null "SortOrder 欄位說明"
      Metadata  datetime2        not null "Metadata 欄位說明"
      Version   int              null     "Version 欄位說明"
      Notes     nvarchar(200)    null
      Priority  nvarchar(50)     null
      Score     bit              null     default 0
      Name      uniqueidentifier null     "Name 欄位說明"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Orders_Code on identity.Orders(Code)
index IX_Orders_CreatedAt on identity.Orders(CreatedAt)
unique index UX_Shipments_Code on identity.Shipments(Code)
index IX_Shipments_CreatedAt on identity.Shipments(CreatedAt)
index IX_Shipments_SessionId on identity.Shipments(SessionId)
unique index UX_Events_Code on identity.Events(Code)
index IX_Events_CreatedAt on identity.Events(CreatedAt)
index IX_Events_RefundId on identity.Events(RefundId)
index IX_Events_CartId on identity.Events(CartId)
unique index UX_Warehouses_Code on identity.Warehouses(Code)
index IX_Warehouses_CreatedAt on identity.Warehouses(CreatedAt)
unique index UX_Users2_Code on identity.Users2(Code)
index IX_Users2_CreatedAt on identity.Users2(CreatedAt)
index IX_Users2_Approvals2Id on identity.Users2(Approvals2Id)
unique index UX_Orders2_Code on identity.Orders2(Code)
index IX_Orders2_CreatedAt on identity.Orders2(CreatedAt)
index IX_Orders2_LedgerId on identity.Orders2(LedgerId)
index IX_Orders2_Approvals3Id on identity.Orders2(Approvals3Id)
unique index UX_Shipments2_Code on identity.Shipments2(Code)
index IX_Shipments2_CreatedAt on identity.Shipments2(CreatedAt)
unique index UX_Events2_Code on identity.Events2(Code)
index IX_Events2_CreatedAt on identity.Events2(CreatedAt)
index IX_Events2_SessionId on identity.Events2(SessionId)
index IX_Events2_Attachments2Id on identity.Events2(Attachments2Id)
unique index UX_Warehouses2_Code on identity.Warehouses2(Code)
index IX_Warehouses2_CreatedAt on identity.Warehouses2(CreatedAt)
unique index UX_Users3_Code on identity.Users3(Code)
index IX_Users3_CreatedAt on identity.Users3(CreatedAt)
index IX_Users3_TokenId on identity.Users3(TokenId)
unique index UX_Orders3_Code on identity.Orders3(Code)
index IX_Orders3_CreatedAt on identity.Orders3(CreatedAt)
index IX_Orders3_CommentId on identity.Orders3(CommentId)
unique index UX_Shipments3_Code on identity.Shipments3(Code)
index IX_Shipments3_CreatedAt on identity.Shipments3(CreatedAt)
index IX_Shipments3_DashboardId on identity.Shipments3(DashboardId)
index IX_Shipments3_EventId on identity.Shipments3(EventId)
index IX_Shipments3_CouponId on identity.Shipments3(CouponId)
index IX_Shipments3_LedgerId on identity.Shipments3(LedgerId)
unique index UX_Events3_Code on identity.Events3(Code)
index IX_Events3_CreatedAt on identity.Events3(CreatedAt)
index IX_Events3_CartItemId on identity.Events3(CartItemId)
index IX_Events3_RoleId on identity.Events3(RoleId)
index IX_Events3_CategorieId on identity.Events3(CategorieId)
unique index UX_Warehouses3_Code on identity.Warehouses3(Code)
index IX_Warehouses3_CreatedAt on identity.Warehouses3(CreatedAt)
```

## catalog（14 張表）

```dbschema
table catalog.OrderItems "Catalog 模組的 OrderItems" in Catalog {
  PK    Id          bigint           not null "OrderItems 主鍵"
  UQ    Code        nvarchar(64)     not null "業務代碼"
        Description nvarchar(200)    null
        Status      nvarchar(4000)   null     "Status 欄位說明"
        Amount      int              not null
        Quantity    uniqueidentifier null     "Quantity 欄位說明"
        StartsAt    bigint           null
        EndsAt      nvarchar(50)     not null "EndsAt 欄位說明"
        IsActive    bigint           null
        ExternalId  uniqueidentifier null
        Slug        nvarchar(200)    not null
        Locale      nvarchar(4000)   null
        SortOrder   int              null
  FK    RefundId    bigint           not null "參照 content.Refunds"
  FK UQ EventId     bigint           null     "參照 identity.Events"
  IDX   CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Addresses "Catalog 模組的 Addresses" in Catalog {
  PK  Id          bigint           not null "Addresses 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Notes       nvarchar(200)    null
      Priority    datetime2        not null
      Score       uniqueidentifier not null
      Name        nvarchar(4000)   not null "Name 欄位說明"
      Title       uniqueidentifier null     "Title 欄位說明"
      Description decimal(18,2)    null
      Status      bit              not null default 0 "Status 欄位說明"
      Amount      bigint           null     "Amount 欄位說明"
      Quantity    nvarchar(50)     not null
  FK  InvoiceId   bigint           not null "參照 support.Invoices"
  FK  RoleId      bigint           not null "參照 dbo.Roles"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Metrics "Catalog 模組的 Metrics" in Catalog {
  PK  Id           bigint         not null "Metrics 主鍵"
  UQ  Code         nvarchar(64)   not null "業務代碼"
      ExternalId   int            null
      Slug         int            null
      Locale       bigint         not null
      SortOrder    nvarchar(4000) null     "SortOrder 欄位說明"
      Metadata     bit            null     default 0
      Version      decimal(18,2)  null     "Version 欄位說明"
      Notes        bigint         not null "Notes 欄位說明"
      Priority     nvarchar(50)   not null
      Score        int            not null
      Name         decimal(18,2)  null
      Title        bit            not null default 0
  FK  PermissionId bigint         not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Stocks "Catalog 模組的 Stocks" in Catalog {
  PK  Id         bigint         not null "Stocks 主鍵"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      Status     decimal(18,2)  null     "Status 欄位說明"
      Amount     bigint         not null "Amount 欄位說明"
      Quantity   nvarchar(50)   null     "Quantity 欄位說明"
      StartsAt   nvarchar(4000) null
      EndsAt     decimal(18,2)  null     "EndsAt 欄位說明"
      IsActive   bigint         null
      ExternalId bigint         not null "ExternalId 欄位說明"
  FK  CouponId   bigint         not null "參照 shipping.Coupons"
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Roles2 "Catalog 模組的 Roles2" in Catalog {
  PK  Id          bigint           not null "Roles2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Priority    uniqueidentifier null
      Score       bit              null     default 0
      Name        nvarchar(4000)   not null "Name 欄位說明"
      Title       decimal(18,2)    null
      Description nvarchar(4000)   null
      Status      bit              null     default 0
      Amount      bigint           null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.OrderItems2 "Catalog 模組的 OrderItems2" in Catalog {
  PK  Id        bigint        not null "OrderItems2 主鍵"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      Slug      bigint        not null "Slug 欄位說明"
      Locale    bit           null     default 0 "Locale 欄位說明"
      SortOrder int           not null "SortOrder 欄位說明"
      Metadata  nvarchar(200) not null
      Version   bit           not null default 0 "Version 欄位說明"
      Notes     datetime2     not null "Notes 欄位說明"
      Priority  datetime2     null     "Priority 欄位說明"
      Score     datetime2     not null "Score 欄位說明"
  FK  RefundId  bigint        not null "參照 content.Refunds"
  FK  PaymentId bigint        not null "參照 analytics.Payments"
  FK  TokenId   bigint        not null "參照 dbo.Tokens"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table catalog.Addresses2 "Catalog 模組的 Addresses2" in Catalog {
  PK    Id         bigint           not null "Addresses2 主鍵"
  UQ    Code       nvarchar(64)     not null "業務代碼"
        Amount     nvarchar(50)     not null
        Quantity   uniqueidentifier not null "Quantity 欄位說明"
        StartsAt   int              null
  FK UQ CartItemId bigint           null     "參照 billing.CartItems"
  IDX   CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Metrics2 "Catalog 模組的 Metrics2" in Catalog {
  PK  Id          bigint         not null "Metrics2 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       decimal(18,2)  null
      Name        bigint         null     "Name 欄位說明"
      Title       datetime2      not null "Title 欄位說明"
      Description nvarchar(200)  null     "Description 欄位說明"
      Status      int            null     "Status 欄位說明"
      Amount      nvarchar(4000) not null
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Stocks2 "Catalog 模組的 Stocks2" in Catalog {
  PK  Id           bigint           not null "Stocks2 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Locale       uniqueidentifier null     "Locale 欄位說明"
      SortOrder    bigint           not null "SortOrder 欄位說明"
      Metadata     nvarchar(200)    not null
      Version      decimal(18,2)    null
      Notes        datetime2        null
  FK  Purchases3Id bigint           not null "參照 shipping.Purchases3"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Roles3 "Catalog 模組的 Roles3" in Catalog {
  PK  Id         bigint           not null "Roles3 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   nvarchar(4000)   null
      StartsAt   bigint           null     "StartsAt 欄位說明"
      EndsAt     nvarchar(4000)   null     "EndsAt 欄位說明"
      IsActive   bit              null     default 0
      ExternalId uniqueidentifier null
      Slug       uniqueidentifier null
      Locale     decimal(18,2)    null
      SortOrder  decimal(18,2)    null     "SortOrder 欄位說明"
      Metadata   decimal(18,2)    null     "Metadata 欄位說明"
      Version    datetime2        not null "Version 欄位說明"
  FK  Changes3Id bigint           not null "參照 analytics.Changes3"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.OrderItems3 "Catalog 模組的 OrderItems3" in Catalog {
  PK  Id          bigint           not null "OrderItems3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        bit              not null default 0
      Title       uniqueidentifier null
      Description uniqueidentifier null     "Description 欄位說明"
      Status      bigint           null
      Amount      decimal(18,2)    not null "Amount 欄位說明"
  FK  SessionId   bigint           not null "參照 dbo.Sessions"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table catalog.Addresses3 "Catalog 模組的 Addresses3" in Catalog {
  PK  Id          bigint         not null "Addresses3 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      SortOrder   int            not null
      Metadata    datetime2      not null "Metadata 欄位說明"
      Version     bigint         not null "Version 欄位說明"
      Notes       bigint         null     "Notes 欄位說明"
      Priority    datetime2      not null "Priority 欄位說明"
      Score       decimal(18,2)  not null
      Name        nvarchar(50)   null
      Title       nvarchar(4000) null     "Title 欄位說明"
      Description decimal(18,2)  null
  FK  PaymentId   bigint         not null "參照 analytics.Payments"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table catalog.Metrics3 "Catalog 模組的 Metrics3" in Catalog {
  PK  Id          bigint        not null "Metrics3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      StartsAt    nvarchar(50)  null     "StartsAt 欄位說明"
      EndsAt      nvarchar(200) not null "EndsAt 欄位說明"
      IsActive    bit           null     default 0
      ExternalId  int           not null
      Slug        datetime2     not null "Slug 欄位說明"
      Locale      nvarchar(200) null     "Locale 欄位說明"
      SortOrder   int           null     "SortOrder 欄位說明"
      Metadata    bit           not null default 0 "Metadata 欄位說明"
      Version     nvarchar(50)  null
  FK  CategorieId bigint        not null "參照 analytics.Categories"
  FK  OrderId     bigint        not null "參照 identity.Orders"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table catalog.Stocks3 "Catalog 模組的 Stocks3" in Catalog {
  PK  Id          bigint           not null "Stocks3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       bigint           null
      Description bigint           not null "Description 欄位說明"
      Status      bit              not null default 0
      Amount      nvarchar(50)     not null
      Quantity    bit              null     default 0 "Quantity 欄位說明"
      StartsAt    nvarchar(50)     not null
      EndsAt      bigint           not null "EndsAt 欄位說明"
      IsActive    uniqueidentifier null
      ExternalId  nvarchar(200)    null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_OrderItems_Code on catalog.OrderItems(Code)
index IX_OrderItems_CreatedAt on catalog.OrderItems(CreatedAt)
index IX_OrderItems_RefundId on catalog.OrderItems(RefundId)
index IX_OrderItems_EventId on catalog.OrderItems(EventId)
unique index UX_Addresses_Code on catalog.Addresses(Code)
index IX_Addresses_CreatedAt on catalog.Addresses(CreatedAt)
index IX_Addresses_InvoiceId on catalog.Addresses(InvoiceId)
index IX_Addresses_RoleId on catalog.Addresses(RoleId)
unique index UX_Metrics_Code on catalog.Metrics(Code)
index IX_Metrics_CreatedAt on catalog.Metrics(CreatedAt)
index IX_Metrics_PermissionId on catalog.Metrics(PermissionId)
unique index UX_Stocks_Code on catalog.Stocks(Code)
index IX_Stocks_CreatedAt on catalog.Stocks(CreatedAt)
index IX_Stocks_CouponId on catalog.Stocks(CouponId)
unique index UX_Roles2_Code on catalog.Roles2(Code)
index IX_Roles2_CreatedAt on catalog.Roles2(CreatedAt)
unique index UX_OrderItems2_Code on catalog.OrderItems2(Code)
index IX_OrderItems2_CreatedAt on catalog.OrderItems2(CreatedAt)
index IX_OrderItems2_RefundId on catalog.OrderItems2(RefundId)
index IX_OrderItems2_PaymentId on catalog.OrderItems2(PaymentId)
index IX_OrderItems2_TokenId on catalog.OrderItems2(TokenId)
unique index UX_Addresses2_Code on catalog.Addresses2(Code)
index IX_Addresses2_CreatedAt on catalog.Addresses2(CreatedAt)
index IX_Addresses2_CartItemId on catalog.Addresses2(CartItemId)
unique index UX_Metrics2_Code on catalog.Metrics2(Code)
index IX_Metrics2_CreatedAt on catalog.Metrics2(CreatedAt)
unique index UX_Stocks2_Code on catalog.Stocks2(Code)
index IX_Stocks2_CreatedAt on catalog.Stocks2(CreatedAt)
index IX_Stocks2_Purchases3Id on catalog.Stocks2(Purchases3Id)
unique index UX_Roles3_Code on catalog.Roles3(Code)
index IX_Roles3_CreatedAt on catalog.Roles3(CreatedAt)
index IX_Roles3_Changes3Id on catalog.Roles3(Changes3Id)
unique index UX_OrderItems3_Code on catalog.OrderItems3(Code)
index IX_OrderItems3_CreatedAt on catalog.OrderItems3(CreatedAt)
index IX_OrderItems3_SessionId on catalog.OrderItems3(SessionId)
unique index UX_Addresses3_Code on catalog.Addresses3(Code)
index IX_Addresses3_CreatedAt on catalog.Addresses3(CreatedAt)
index IX_Addresses3_PaymentId on catalog.Addresses3(PaymentId)
unique index UX_Metrics3_Code on catalog.Metrics3(Code)
index IX_Metrics3_CreatedAt on catalog.Metrics3(CreatedAt)
index IX_Metrics3_CategorieId on catalog.Metrics3(CategorieId)
index IX_Metrics3_OrderId on catalog.Metrics3(OrderId)
unique index UX_Stocks3_Code on catalog.Stocks3(Code)
index IX_Stocks3_CreatedAt on catalog.Stocks3(CreatedAt)
```

## sales（14 張表）

```dbschema
table sales.Carts "Sales 模組的 Carts" in Sales {
  PK  Id           bigint           not null "Carts 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      ExternalId   uniqueidentifier null
      Slug         nvarchar(200)    null
      Locale       bit              null     default 0 "Locale 欄位說明"
      SortOrder    datetime2        null
      Metadata     datetime2        null
  FK  Trackings3Id bigint           not null "參照 shipping.Trackings3"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Carriers "Sales 模組的 Carriers" in Sales {
  PK    Id           bigint           not null "Carriers 主鍵"
  UQ    Code         nvarchar(64)     not null "業務代碼"
        Status       bit              not null default 0 "Status 欄位說明"
        Amount       nvarchar(4000)   not null
        Quantity     uniqueidentifier not null
        StartsAt     bigint           not null
        EndsAt       int              null
        IsActive     nvarchar(200)    not null
        ExternalId   bigint           null     "ExternalId 欄位說明"
        Slug         uniqueidentifier not null "Slug 欄位說明"
        Locale       datetime2        null
        SortOrder    bit              not null default 0
        Metadata     datetime2        null
        Version      bigint           not null
  FK    PermissionId bigint           not null "參照 dbo.Permissions"
  FK    InvoiceId    bigint           not null "參照 support.Invoices"
  FK    TokenId      bigint           not null "參照 dbo.Tokens"
  FK    CartId       bigint           not null "參照 sales.Carts"
  FK UQ OrderItemId  bigint           null     "參照 catalog.OrderItems"
  IDX   CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Reports "Sales 模組的 Reports" in Sales {
  PK  Id        bigint       not null "Reports 主鍵"
  UQ  Code      nvarchar(64) not null "業務代碼"
      Priority  bit          not null default 0 "Priority 欄位說明"
      Score     int          null     "Score 欄位說明"
      Name      int          null     "Name 欄位說明"
  FK  SessionId bigint       not null "參照 dbo.Sessions"
  FK  OrderId   bigint       not null "參照 identity.Orders"
  IDX CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table sales.Transfers "Sales 模組的 Transfers" in Sales {
  PK  Id        bigint         not null "Transfers 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Slug      int            null     "Slug 欄位說明"
      Locale    nvarchar(50)   null
      SortOrder nvarchar(4000) null     "SortOrder 欄位說明"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Permissions2 "Sales 模組的 Permissions2" in Sales {
  PK  Id          bigint           not null "Permissions2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Amount      nvarchar(50)     null
      Quantity    uniqueidentifier null     "Quantity 欄位說明"
      StartsAt    datetime2        null
      EndsAt      nvarchar(200)    not null
      IsActive    datetime2        null     "IsActive 欄位說明"
  FK  Comments2Id bigint           not null "參照 analytics.Comments2"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Carts2 "Sales 模組的 Carts2" in Sales {
  PK  Id          bigint       not null "Carts2 主鍵"
  UQ  Code        nvarchar(64) not null "業務代碼"
      Score       bigint       not null
      Name        nvarchar(50) null
      Title       datetime2    not null
      Description int          null
      Status      bigint       null
  IDX CreatedAt   datetime2    not null default "sysutcdatetime()" "建立時間"
}

table sales.Carriers2 "Sales 模組的 Carriers2" in Sales {
  PK  Id        bigint           not null "Carriers2 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Locale    decimal(18,2)    not null
      SortOrder datetime2        not null
      Metadata  bit              not null default 0
      Version   uniqueidentifier not null "Version 欄位說明"
      Notes     nvarchar(200)    null     "Notes 欄位說明"
      Priority  nvarchar(50)     null
      Score     nvarchar(50)     null
  FK  PriceId   bigint           not null "參照 audit.Prices"
  FK  TokenId   bigint           not null "參照 dbo.Tokens"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Reports2 "Sales 模組的 Reports2" in Sales {
  PK  Id        bigint           not null "Reports2 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Quantity  uniqueidentifier not null
      StartsAt  nvarchar(200)    not null "StartsAt 欄位說明"
      EndsAt    int              not null
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Transfers2 "Sales 模組的 Transfers2" in Sales {
  PK  Id          bigint           not null "Transfers2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        bit              null     default 0
      Title       nvarchar(50)     not null
      Description uniqueidentifier null
      Status      bigint           null     "Status 欄位說明"
      Amount      bigint           null
  FK  OrderId     bigint           not null "參照 identity.Orders"
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Permissions3 "Sales 模組的 Permissions3" in Sales {
  PK  Id          bigint           not null "Permissions3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      SortOrder   bit              not null default 0
      Metadata    nvarchar(200)    null
      Version     nvarchar(50)     not null
      Notes       uniqueidentifier null
      Priority    datetime2        not null
      Score       int              not null
      Name        int              not null "Name 欄位說明"
      Title       bigint           null
      Description bit              not null default 0 "Description 欄位說明"
      Status      datetime2        not null "Status 欄位說明"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Carts3 "Sales 模組的 Carts3" in Sales {
  PK  Id         bigint           not null "Carts3 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   nvarchar(4000)   not null
      EndsAt     int              null
      IsActive   bit              not null default 0
      ExternalId nvarchar(4000)   not null "ExternalId 欄位說明"
      Slug       decimal(18,2)    not null "Slug 欄位說明"
      Locale     uniqueidentifier null     "Locale 欄位說明"
      SortOrder  decimal(18,2)    null
      Metadata   nvarchar(200)    null     "Metadata 欄位說明"
      Version    decimal(18,2)    null     "Version 欄位說明"
      Notes      decimal(18,2)    not null "Notes 欄位說明"
      Priority   nvarchar(50)     null     "Priority 欄位說明"
      Score      nvarchar(200)    not null "Score 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Carriers3 "Sales 模組的 Carriers3" in Sales {
  PK  Id          bigint           not null "Carriers3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       uniqueidentifier not null "Title 欄位說明"
      Description int              not null "Description 欄位說明"
      Status      bit              not null default 0
      Amount      int              not null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table sales.Reports3 "Sales 模組的 Reports3" in Sales {
  PK  Id        bigint         not null "Reports3 主鍵"
  UQ  Code      nvarchar(64)   not null "業務代碼"
      Metadata  bigint         not null
      Version   int            null     "Version 欄位說明"
      Notes     nvarchar(4000) not null
  FK  VariantId bigint         not null "參照 inventory.Variants"
  IDX CreatedAt datetime2      not null default "sysutcdatetime()" "建立時間"
}

table sales.Transfers3 "Sales 模組的 Transfers3" in Sales {
  PK  Id         bigint         not null "Transfers3 主鍵"
  UQ  Code       nvarchar(64)   not null "業務代碼"
      EndsAt     int            null
      IsActive   bit            not null default 0
      ExternalId nvarchar(4000) null
      Slug       decimal(18,2)  null
      Locale     datetime2      null     "Locale 欄位說明"
      SortOrder  nvarchar(200)  null
      Metadata   bit            null     default 0 "Metadata 欄位說明"
      Version    nvarchar(4000) null
      Notes      bit            null     default 0
      Priority   nvarchar(200)  not null
  IDX CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Carts_Code on sales.Carts(Code)
index IX_Carts_CreatedAt on sales.Carts(CreatedAt)
index IX_Carts_Trackings3Id on sales.Carts(Trackings3Id)
unique index UX_Carriers_Code on sales.Carriers(Code)
index IX_Carriers_CreatedAt on sales.Carriers(CreatedAt)
index IX_Carriers_PermissionId on sales.Carriers(PermissionId)
index IX_Carriers_InvoiceId on sales.Carriers(InvoiceId)
index IX_Carriers_TokenId on sales.Carriers(TokenId)
index IX_Carriers_CartId on sales.Carriers(CartId)
index IX_Carriers_OrderItemId on sales.Carriers(OrderItemId)
unique index UX_Reports_Code on sales.Reports(Code)
index IX_Reports_CreatedAt on sales.Reports(CreatedAt)
index IX_Reports_SessionId on sales.Reports(SessionId)
index IX_Reports_OrderId on sales.Reports(OrderId)
unique index UX_Transfers_Code on sales.Transfers(Code)
index IX_Transfers_CreatedAt on sales.Transfers(CreatedAt)
unique index UX_Permissions2_Code on sales.Permissions2(Code)
index IX_Permissions2_CreatedAt on sales.Permissions2(CreatedAt)
index IX_Permissions2_Comments2Id on sales.Permissions2(Comments2Id)
unique index UX_Carts2_Code on sales.Carts2(Code)
index IX_Carts2_CreatedAt on sales.Carts2(CreatedAt)
unique index UX_Carriers2_Code on sales.Carriers2(Code)
index IX_Carriers2_CreatedAt on sales.Carriers2(CreatedAt)
index IX_Carriers2_PriceId on sales.Carriers2(PriceId)
index IX_Carriers2_TokenId on sales.Carriers2(TokenId)
unique index UX_Reports2_Code on sales.Reports2(Code)
index IX_Reports2_CreatedAt on sales.Reports2(CreatedAt)
unique index UX_Transfers2_Code on sales.Transfers2(Code)
index IX_Transfers2_CreatedAt on sales.Transfers2(CreatedAt)
index IX_Transfers2_OrderId on sales.Transfers2(OrderId)
index IX_Transfers2_OrderItemId on sales.Transfers2(OrderItemId)
unique index UX_Permissions3_Code on sales.Permissions3(Code)
index IX_Permissions3_CreatedAt on sales.Permissions3(CreatedAt)
unique index UX_Carts3_Code on sales.Carts3(Code)
index IX_Carts3_CreatedAt on sales.Carts3(CreatedAt)
unique index UX_Carriers3_Code on sales.Carriers3(Code)
index IX_Carriers3_CreatedAt on sales.Carriers3(CreatedAt)
unique index UX_Reports3_Code on sales.Reports3(Code)
index IX_Reports3_CreatedAt on sales.Reports3(CreatedAt)
index IX_Reports3_VariantId on sales.Reports3(VariantId)
unique index UX_Transfers3_Code on sales.Transfers3(Code)
index IX_Transfers3_CreatedAt on sales.Transfers3(CreatedAt)
```

## billing（14 張表）

```dbschema
table billing.CartItems "Billing 模組的 CartItems" in Billing {
  PK  Id          bigint           not null "CartItems 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Priority    bigint           not null
      Score       int              null
      Name        uniqueidentifier null
      Title       int              not null
      Description nvarchar(200)    null
      Status      nvarchar(50)     not null "Status 欄位說明"
  FK  UserId      bigint           not null "參照 dbo.Users"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Packages "Billing 模組的 Packages" in Billing {
  PK  Id        bigint           not null "Packages 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Slug      bigint           null     "Slug 欄位說明"
      Locale    nvarchar(200)    null     "Locale 欄位說明"
      SortOrder uniqueidentifier null
      Metadata  datetime2        null
      Version   bigint           null
      Notes     int              null
      Priority  nvarchar(200)    null     "Priority 欄位說明"
      Score     decimal(18,2)    not null
      Name      datetime2        not null "Name 欄位說明"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Dashboards "Billing 模組的 Dashboards" in Billing {
  PK  Id          bigint         not null "Dashboards 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Amount      nvarchar(4000) null     "Amount 欄位說明"
      Quantity    bit            null     default 0
      StartsAt    bigint         null
      EndsAt      bigint         not null
  FK  Payments3Id bigint         not null "參照 analytics.Payments3"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Suppliers "Billing 模組的 Suppliers" in Billing {
  PK  Id          bigint           not null "Suppliers 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Score       int              not null
      Name        bigint           null
      Title       uniqueidentifier null     "Title 欄位說明"
      Description nvarchar(50)     not null
      Status      uniqueidentifier not null "Status 欄位說明"
      Amount      nvarchar(200)    null
      Quantity    bigint           not null "Quantity 欄位說明"
      StartsAt    decimal(18,2)    null
      EndsAt      uniqueidentifier not null
      IsActive    decimal(18,2)    null
      ExternalId  datetime2        not null "ExternalId 欄位說明"
  FK  BrandId     bigint           not null "參照 content.Brands"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Sessions2 "Billing 模組的 Sessions2" in Billing {
  PK  Id           bigint         not null "Sessions2 主鍵"
  UQ  Code         nvarchar(64)   not null "業務代碼"
      Locale       bigint         not null
      SortOrder    nvarchar(4000) null
      Metadata     datetime2      null
      Version      nvarchar(200)  null     "Version 欄位說明"
      Notes        bit            null     default 0 "Notes 欄位說明"
  FK  PermissionId bigint         not null "參照 dbo.Permissions"
  FK  CartItemId   bigint         not null "參照 billing.CartItems"
  IDX CreatedAt    datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.CartItems2 "Billing 模組的 CartItems2" in Billing {
  PK  Id         bigint           not null "CartItems2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   uniqueidentifier null     "Quantity 欄位說明"
      StartsAt   nvarchar(50)     not null
      EndsAt     decimal(18,2)    null     "EndsAt 欄位說明"
      IsActive   nvarchar(200)    not null
      ExternalId bit              null     default 0 "ExternalId 欄位說明"
      Slug       nvarchar(4000)   null
      Locale     decimal(18,2)    null
      SortOrder  int              null     "SortOrder 欄位說明"
      Metadata   nvarchar(4000)   null     "Metadata 欄位說明"
  FK  PaymentId  bigint           not null "參照 analytics.Payments"
  FK  TokenId    bigint           not null "參照 dbo.Tokens"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Packages2 "Billing 模組的 Packages2" in Billing {
  PK    Id        bigint       not null "Packages2 主鍵"
  UQ    Code      nvarchar(64) not null "業務代碼"
        Name      nvarchar(50) not null "Name 欄位說明"
        Title     nvarchar(50) null
  FK    TokenId   bigint       not null "參照 dbo.Tokens"
  FK    PaymentId bigint       not null "參照 analytics.Payments"
  FK UQ UserId    bigint       null     "參照 dbo.Users"
  IDX   CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table billing.Dashboards2 "Billing 模組的 Dashboards2" in Billing {
  PK  Id        bigint        not null "Dashboards2 主鍵"
  UQ  Code      nvarchar(64)  not null "業務代碼"
      SortOrder nvarchar(50)  null
      Metadata  nvarchar(50)  null
      Version   decimal(18,2) null     "Version 欄位說明"
      Notes     decimal(18,2) not null "Notes 欄位說明"
  FK  OrderId   bigint        not null "參照 identity.Orders"
  FK  UserId    bigint        not null "參照 dbo.Users"
  IDX CreatedAt datetime2     not null default "sysutcdatetime()" "建立時間"
}

table billing.Suppliers2 "Billing 模組的 Suppliers2" in Billing {
  PK  Id         bigint           not null "Suppliers2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   decimal(18,2)    null
      EndsAt     uniqueidentifier null
      IsActive   nvarchar(200)    null     "IsActive 欄位說明"
      ExternalId nvarchar(200)    null
      Slug       nvarchar(200)    not null
      Locale     bigint           null
      SortOrder  bigint           null     "SortOrder 欄位說明"
      Metadata   nvarchar(4000)   null     "Metadata 欄位說明"
      Version    decimal(18,2)    null
      Notes      decimal(18,2)    null     "Notes 欄位說明"
      Priority   int              null     "Priority 欄位說明"
  FK  Events3Id  bigint           not null "參照 identity.Events3"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Sessions3 "Billing 模組的 Sessions3" in Billing {
  PK  Id          bigint           not null "Sessions3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       int              not null
      Description datetime2        not null "Description 欄位說明"
      Status      int              not null "Status 欄位說明"
      Amount      uniqueidentifier null     "Amount 欄位說明"
      Quantity    uniqueidentifier null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.CartItems3 "Billing 模組的 CartItems3" in Billing {
  PK  Id          bigint           not null "CartItems3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Metadata    nvarchar(200)    null
      Version     datetime2        not null
      Notes       nvarchar(50)     not null
      Priority    nvarchar(50)     null
      Score       nvarchar(50)     not null
      Name        nvarchar(200)    not null
      Title       nvarchar(4000)   null
      Description uniqueidentifier not null "Description 欄位說明"
      Status      decimal(18,2)    null
      Amount      int              null     "Amount 欄位說明"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table billing.Packages3 "Billing 模組的 Packages3" in Billing {
  PK  Id          bigint        not null "Packages3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      EndsAt      int           null
      IsActive    nvarchar(200) null     "IsActive 欄位說明"
      ExternalId  int           null
      Slug        datetime2     null
      Locale      bigint        not null
      SortOrder   nvarchar(200) null
      Metadata    datetime2     null
      Version     decimal(18,2) null     "Version 欄位說明"
      Notes       nvarchar(200) null     "Notes 欄位說明"
  FK  CategorieId bigint        not null "參照 analytics.Categories"
  FK  VariantId   bigint        not null "參照 inventory.Variants"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table billing.Dashboards3 "Billing 模組的 Dashboards3" in Billing {
  PK  Id          bigint         not null "Dashboards3 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(200)  null
      Description nvarchar(200)  not null
      Status      nvarchar(4000) not null "Status 欄位說明"
      Amount      bigint         null
      Quantity    decimal(18,2)  not null "Quantity 欄位說明"
      StartsAt    decimal(18,2)  null     "StartsAt 欄位說明"
      EndsAt      nvarchar(50)   not null "EndsAt 欄位說明"
      IsActive    nvarchar(50)   not null "IsActive 欄位說明"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table billing.Suppliers3 "Billing 模組的 Suppliers3" in Billing {
  PK  Id          bigint           not null "Suppliers3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Version     datetime2        null
      Notes       decimal(18,2)    null     "Notes 欄位說明"
      Priority    decimal(18,2)    null
      Score       datetime2        null     "Score 欄位說明"
      Name        nvarchar(200)    not null
      Title       bit              not null default 0 "Title 欄位說明"
      Description datetime2        null
      Status      bigint           not null
      Amount      int              null     "Amount 欄位說明"
      Quantity    nvarchar(50)     null     "Quantity 欄位說明"
      StartsAt    uniqueidentifier not null "StartsAt 欄位說明"
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_CartItems_Code on billing.CartItems(Code)
index IX_CartItems_CreatedAt on billing.CartItems(CreatedAt)
index IX_CartItems_UserId on billing.CartItems(UserId)
unique index UX_Packages_Code on billing.Packages(Code)
index IX_Packages_CreatedAt on billing.Packages(CreatedAt)
unique index UX_Dashboards_Code on billing.Dashboards(Code)
index IX_Dashboards_CreatedAt on billing.Dashboards(CreatedAt)
index IX_Dashboards_Payments3Id on billing.Dashboards(Payments3Id)
unique index UX_Suppliers_Code on billing.Suppliers(Code)
index IX_Suppliers_CreatedAt on billing.Suppliers(CreatedAt)
index IX_Suppliers_BrandId on billing.Suppliers(BrandId)
unique index UX_Sessions2_Code on billing.Sessions2(Code)
index IX_Sessions2_CreatedAt on billing.Sessions2(CreatedAt)
index IX_Sessions2_PermissionId on billing.Sessions2(PermissionId)
index IX_Sessions2_CartItemId on billing.Sessions2(CartItemId)
unique index UX_CartItems2_Code on billing.CartItems2(Code)
index IX_CartItems2_CreatedAt on billing.CartItems2(CreatedAt)
index IX_CartItems2_PaymentId on billing.CartItems2(PaymentId)
index IX_CartItems2_TokenId on billing.CartItems2(TokenId)
unique index UX_Packages2_Code on billing.Packages2(Code)
index IX_Packages2_CreatedAt on billing.Packages2(CreatedAt)
index IX_Packages2_TokenId on billing.Packages2(TokenId)
index IX_Packages2_PaymentId on billing.Packages2(PaymentId)
index IX_Packages2_UserId on billing.Packages2(UserId)
unique index UX_Dashboards2_Code on billing.Dashboards2(Code)
index IX_Dashboards2_CreatedAt on billing.Dashboards2(CreatedAt)
index IX_Dashboards2_OrderId on billing.Dashboards2(OrderId)
index IX_Dashboards2_UserId on billing.Dashboards2(UserId)
unique index UX_Suppliers2_Code on billing.Suppliers2(Code)
index IX_Suppliers2_CreatedAt on billing.Suppliers2(CreatedAt)
index IX_Suppliers2_Events3Id on billing.Suppliers2(Events3Id)
unique index UX_Sessions3_Code on billing.Sessions3(Code)
index IX_Sessions3_CreatedAt on billing.Sessions3(CreatedAt)
unique index UX_CartItems3_Code on billing.CartItems3(Code)
index IX_CartItems3_CreatedAt on billing.CartItems3(CreatedAt)
unique index UX_Packages3_Code on billing.Packages3(Code)
index IX_Packages3_CreatedAt on billing.Packages3(CreatedAt)
index IX_Packages3_CategorieId on billing.Packages3(CategorieId)
index IX_Packages3_VariantId on billing.Packages3(VariantId)
unique index UX_Dashboards3_Code on billing.Dashboards3(Code)
index IX_Dashboards3_CreatedAt on billing.Dashboards3(CreatedAt)
unique index UX_Suppliers3_Code on billing.Suppliers3(Code)
index IX_Suppliers3_CreatedAt on billing.Suppliers3(CreatedAt)
index IX_Suppliers3_OrderItemId on billing.Suppliers3(OrderItemId)
```

## shipping（14 張表）

```dbschema
table shipping.Coupons "Shipping 模組的 Coupons" in Shipping {
  PK  Id         bigint           not null "Coupons 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Amount     uniqueidentifier null
      Quantity   nvarchar(200)    not null "Quantity 欄位說明"
      StartsAt   int              not null
  FK  CartItemId bigint           not null "參照 billing.CartItems"
  FK  RefundId   bigint           not null "參照 content.Refunds"
  FK  CartId     bigint           not null "參照 sales.Carts"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings "Shipping 模組的 Trackings" in Shipping {
  PK  Id          bigint         not null "Trackings 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Score       nvarchar(4000) null
      Name        int            null
      Title       nvarchar(200)  not null "Title 欄位說明"
      Description nvarchar(50)   not null
  FK  OrderId     bigint         not null "參照 identity.Orders"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Snapshots "Shipping 模組的 Snapshots" in Shipping {
  PK  Id          bigint           not null "Snapshots 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Locale      nvarchar(50)     not null "Locale 欄位說明"
      SortOrder   nvarchar(4000)   null     "SortOrder 欄位說明"
      Metadata    nvarchar(200)    null
      Version     nvarchar(200)    not null
      Notes       decimal(18,2)    not null
      Priority    uniqueidentifier not null "Priority 欄位說明"
      Score       nvarchar(50)     null
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Purchases "Shipping 模組的 Purchases" in Shipping {
  PK  Id         bigint           not null "Purchases 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Quantity   nvarchar(200)    null     "Quantity 欄位說明"
      StartsAt   nvarchar(200)    not null
      EndsAt     int              not null
      IsActive   decimal(18,2)    not null
      ExternalId uniqueidentifier not null "ExternalId 欄位說明"
      Slug       int              not null
      Locale     decimal(18,2)    null
      SortOrder  nvarchar(50)     null
      Metadata   datetime2        not null
      Version    bit              not null default 0
      Notes      nvarchar(50)     null
      Priority   bigint           null
  FK  RefundId   bigint           not null "參照 content.Refunds"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Tokens2 "Shipping 模組的 Tokens2" in Shipping {
  PK  Id          bigint           not null "Tokens2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        uniqueidentifier null     "Name 欄位說明"
      Title       int              null     "Title 欄位說明"
      Description datetime2        null     "Description 欄位說明"
      Status      decimal(18,2)    not null "Status 欄位說明"
      Amount      int              null     "Amount 欄位說明"
      Quantity    nvarchar(4000)   null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Coupons2 "Shipping 模組的 Coupons2" in Shipping {
  PK  Id        bigint           not null "Coupons2 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      SortOrder nvarchar(200)    not null "SortOrder 欄位說明"
      Metadata  int              null     "Metadata 欄位說明"
      Version   int              null
      Notes     uniqueidentifier null
      Priority  decimal(18,2)    null     "Priority 欄位說明"
      Score     bigint           not null "Score 欄位說明"
      Name      uniqueidentifier not null
      Title     bit              null     default 0 "Title 欄位說明"
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings2 "Shipping 模組的 Trackings2" in Shipping {
  PK  Id         bigint           not null "Trackings2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   decimal(18,2)    not null "StartsAt 欄位說明"
      EndsAt     uniqueidentifier not null
      IsActive   datetime2        not null "IsActive 欄位說明"
      ExternalId uniqueidentifier not null
      Slug       uniqueidentifier null
      Locale     nvarchar(4000)   null     "Locale 欄位說明"
      SortOrder  bit              not null default 0
      Metadata   decimal(18,2)    null     "Metadata 欄位說明"
      Version    uniqueidentifier null
      Notes      datetime2        not null "Notes 欄位說明"
  FK  CartId     bigint           not null "參照 sales.Carts"
  FK  RoleId     bigint           not null "參照 dbo.Roles"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Snapshots2 "Shipping 模組的 Snapshots2" in Shipping {
  PK  Id          bigint         not null "Snapshots2 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       bit            null     default 0 "Title 欄位說明"
      Description nvarchar(4000) not null "Description 欄位說明"
      Status      decimal(18,2)  null
      Amount      bit            not null default 0 "Amount 欄位說明"
      Quantity    datetime2      null     "Quantity 欄位說明"
  FK  ProductId   bigint         not null "參照 dbo.Products"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table shipping.Purchases2 "Shipping 模組的 Purchases2" in Shipping {
  PK  Id           bigint           not null "Purchases2 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Metadata     datetime2        not null "Metadata 欄位說明"
      Version      datetime2        not null
      Notes        uniqueidentifier null
      Priority     bigint           null
      Score        datetime2        not null
      Name         uniqueidentifier null
  FK  Changes3Id   bigint           not null "參照 analytics.Changes3"
  FK  StockId      bigint           not null "參照 catalog.Stocks"
  FK  Addresses2Id bigint           not null "參照 catalog.Addresses2"
  FK  SnapshotId   bigint           not null "參照 shipping.Snapshots"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Tokens3 "Shipping 模組的 Tokens3" in Shipping {
  PK  Id         bigint           not null "Tokens3 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     int              null     "EndsAt 欄位說明"
      IsActive   nvarchar(4000)   null
      ExternalId uniqueidentifier not null
      Slug       int              null
      Locale     bigint           not null
      SortOrder  datetime2        null     "SortOrder 欄位說明"
      Metadata   uniqueidentifier not null
      Version    nvarchar(50)     null
      Notes      uniqueidentifier not null "Notes 欄位說明"
      Priority   nvarchar(50)     not null
      Score      uniqueidentifier null
  FK  OrderId    bigint           not null "參照 identity.Orders"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Coupons3 "Shipping 模組的 Coupons3" in Shipping {
  PK  Id          bigint           not null "Coupons3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       nvarchar(200)    not null
      Description bigint           null     "Description 欄位說明"
      Status      nvarchar(200)    not null
      Amount      bit              not null default 0 "Amount 欄位說明"
      Quantity    uniqueidentifier not null "Quantity 欄位說明"
      StartsAt    int              not null
      EndsAt      uniqueidentifier not null
      IsActive    uniqueidentifier null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Trackings3 "Shipping 模組的 Trackings3" in Shipping {
  PK  Id           bigint           not null "Trackings3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Version      uniqueidentifier null
      Notes        nvarchar(50)     not null
      Priority     int              null
      Score        bigint           null
      Name         int              null     "Name 欄位說明"
      Title        uniqueidentifier not null "Title 欄位說明"
      Description  nvarchar(4000)   not null
      Status       decimal(18,2)    null     "Status 欄位說明"
      Amount       datetime2        not null
      Quantity     int              null     "Quantity 欄位說明"
      StartsAt     nvarchar(200)    not null "StartsAt 欄位說明"
  FK  SessionId    bigint           not null "參照 dbo.Sessions"
  FK  OrderItemId  bigint           not null "參照 catalog.OrderItems"
  FK  Shipments3Id bigint           not null "參照 identity.Shipments3"
  FK  PermissionId bigint           not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Snapshots3 "Shipping 模組的 Snapshots3" in Shipping {
  PK  Id           bigint           not null "Snapshots3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      IsActive     nvarchar(200)    null
      ExternalId   nvarchar(50)     not null
      Slug         bit              null     default 0
      Locale       bit              null     default 0
      SortOrder    bit              null     default 0
      Metadata     uniqueidentifier null
  FK  Trackings2Id bigint           not null "參照 shipping.Trackings2"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table shipping.Purchases3 "Shipping 模組的 Purchases3" in Shipping {
  PK  Id          bigint        not null "Purchases3 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Description bit           null     default 0
      Status      bigint        not null
      Amount      decimal(18,2) not null
  FK  InvoiceId   bigint        not null "參照 support.Invoices"
  FK  CouponId    bigint        not null "參照 shipping.Coupons"
  FK  CategorieId bigint        not null "參照 analytics.Categories"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Coupons_Code on shipping.Coupons(Code)
index IX_Coupons_CreatedAt on shipping.Coupons(CreatedAt)
index IX_Coupons_CartItemId on shipping.Coupons(CartItemId)
index IX_Coupons_RefundId on shipping.Coupons(RefundId)
index IX_Coupons_CartId on shipping.Coupons(CartId)
unique index UX_Trackings_Code on shipping.Trackings(Code)
index IX_Trackings_CreatedAt on shipping.Trackings(CreatedAt)
index IX_Trackings_OrderId on shipping.Trackings(OrderId)
unique index UX_Snapshots_Code on shipping.Snapshots(Code)
index IX_Snapshots_CreatedAt on shipping.Snapshots(CreatedAt)
index IX_Snapshots_OrderItemId on shipping.Snapshots(OrderItemId)
unique index UX_Purchases_Code on shipping.Purchases(Code)
index IX_Purchases_CreatedAt on shipping.Purchases(CreatedAt)
index IX_Purchases_RefundId on shipping.Purchases(RefundId)
unique index UX_Tokens2_Code on shipping.Tokens2(Code)
index IX_Tokens2_CreatedAt on shipping.Tokens2(CreatedAt)
unique index UX_Coupons2_Code on shipping.Coupons2(Code)
index IX_Coupons2_CreatedAt on shipping.Coupons2(CreatedAt)
unique index UX_Trackings2_Code on shipping.Trackings2(Code)
index IX_Trackings2_CreatedAt on shipping.Trackings2(CreatedAt)
index IX_Trackings2_CartId on shipping.Trackings2(CartId)
index IX_Trackings2_RoleId on shipping.Trackings2(RoleId)
unique index UX_Snapshots2_Code on shipping.Snapshots2(Code)
index IX_Snapshots2_CreatedAt on shipping.Snapshots2(CreatedAt)
index IX_Snapshots2_ProductId on shipping.Snapshots2(ProductId)
unique index UX_Purchases2_Code on shipping.Purchases2(Code)
index IX_Purchases2_CreatedAt on shipping.Purchases2(CreatedAt)
index IX_Purchases2_Changes3Id on shipping.Purchases2(Changes3Id)
index IX_Purchases2_StockId on shipping.Purchases2(StockId)
index IX_Purchases2_Addresses2Id on shipping.Purchases2(Addresses2Id)
index IX_Purchases2_SnapshotId on shipping.Purchases2(SnapshotId)
unique index UX_Tokens3_Code on shipping.Tokens3(Code)
index IX_Tokens3_CreatedAt on shipping.Tokens3(CreatedAt)
index IX_Tokens3_OrderId on shipping.Tokens3(OrderId)
unique index UX_Coupons3_Code on shipping.Coupons3(Code)
index IX_Coupons3_CreatedAt on shipping.Coupons3(CreatedAt)
unique index UX_Trackings3_Code on shipping.Trackings3(Code)
index IX_Trackings3_CreatedAt on shipping.Trackings3(CreatedAt)
index IX_Trackings3_SessionId on shipping.Trackings3(SessionId)
index IX_Trackings3_OrderItemId on shipping.Trackings3(OrderItemId)
index IX_Trackings3_Shipments3Id on shipping.Trackings3(Shipments3Id)
index IX_Trackings3_PermissionId on shipping.Trackings3(PermissionId)
unique index UX_Snapshots3_Code on shipping.Snapshots3(Code)
index IX_Snapshots3_CreatedAt on shipping.Snapshots3(CreatedAt)
index IX_Snapshots3_Trackings2Id on shipping.Snapshots3(Trackings2Id)
unique index UX_Purchases3_Code on shipping.Purchases3(Code)
index IX_Purchases3_CreatedAt on shipping.Purchases3(CreatedAt)
index IX_Purchases3_InvoiceId on shipping.Purchases3(InvoiceId)
index IX_Purchases3_CouponId on shipping.Purchases3(CouponId)
index IX_Purchases3_CategorieId on shipping.Purchases3(CategorieId)
```

## support（14 張表）

```dbschema
table support.Invoices "Support 模組的 Invoices" in Support {
  PK  Id        bigint           not null "Invoices 主鍵"
  UQ  Code      nvarchar(64)     not null "業務代碼"
      Locale    uniqueidentifier null     "Locale 欄位說明"
      SortOrder bigint           null
      Metadata  nvarchar(50)     not null
      Version   datetime2        null
      Notes     bit              not null default 0 "Notes 欄位說明"
      Priority  nvarchar(50)     not null
      Score     datetime2        null
      Name      nvarchar(200)    null
  IDX CreatedAt datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Tickets "Support 模組的 Tickets" in Support {
  PK  Id          bigint        not null "Tickets 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Quantity    bigint        null     "Quantity 欄位說明"
      StartsAt    nvarchar(200) not null "StartsAt 欄位說明"
      EndsAt      bit           null     default 0
  FK  WarehouseId bigint        not null "參照 identity.Warehouses"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

table support.Posts "Support 模組的 Posts" in Support {
  PK  Id          bigint           not null "Posts 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Name        datetime2        not null
      Title       bit              not null default 0
      Description uniqueidentifier null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.AuditLogs "Support 模組的 AuditLogs" in Support {
  PK  Id          bigint           not null "AuditLogs 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      SortOrder   nvarchar(50)     not null
      Metadata    uniqueidentifier null
      Version     bit              null     default 0 "Version 欄位說明"
      Notes       bit              null     default 0 "Notes 欄位說明"
      Priority    bigint           null
      Score       uniqueidentifier not null "Score 欄位說明"
      Name        int              not null
      Title       bigint           not null
      Description uniqueidentifier null     "Description 欄位說明"
  FK  InvoiceId   bigint           not null "參照 support.Invoices"
  FK  CouponId    bigint           not null "參照 shipping.Coupons"
  FK  Ledgers2Id  bigint           not null "參照 inventory.Ledgers2"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Products2 "Support 模組的 Products2" in Support {
  PK  Id         bigint           not null "Products2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      StartsAt   nvarchar(4000)   not null
      EndsAt     nvarchar(4000)   null     "EndsAt 欄位說明"
      IsActive   nvarchar(200)    not null "IsActive 欄位說明"
      ExternalId uniqueidentifier not null "ExternalId 欄位說明"
      Slug       nvarchar(200)    null     "Slug 欄位說明"
      Locale     nvarchar(50)     not null
      SortOrder  nvarchar(4000)   null     "SortOrder 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Invoices2 "Support 模組的 Invoices2" in Support {
  PK  Id          bigint           not null "Invoices2 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Title       nvarchar(200)    not null
      Description uniqueidentifier not null "Description 欄位說明"
  FK  OrderItemId bigint           not null "參照 catalog.OrderItems"
  FK  CartItemId  bigint           not null "參照 billing.CartItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Tickets2 "Support 模組的 Tickets2" in Support {
  PK  Id            bigint         not null "Tickets2 主鍵"
  UQ  Code          nvarchar(64)   not null "業務代碼"
      Metadata      datetime2      not null
      Version       nvarchar(4000) null
      Notes         datetime2      null
      Priority      nvarchar(4000) null     "Priority 欄位說明"
      Score         int            null
  FK  CartId        bigint         not null "參照 sales.Carts"
  FK  OrderItems3Id bigint         not null "參照 catalog.OrderItems3"
  FK  LedgerId      bigint         not null "參照 inventory.Ledgers"
  FK  OrderItemId   bigint         not null "參照 catalog.OrderItems"
  FK  CategorieId   bigint         not null "參照 analytics.Categories"
  FK  PaymentId     bigint         not null "參照 analytics.Payments"
  IDX CreatedAt     datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Posts2 "Support 模組的 Posts2" in Support {
  PK  Id         bigint           not null "Posts2 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      EndsAt     bigint           null
      IsActive   uniqueidentifier not null "IsActive 欄位說明"
      ExternalId uniqueidentifier null     "ExternalId 欄位說明"
      Slug       bit              null     default 0
      Locale     bit              null     default 0
      SortOrder  nvarchar(4000)   not null "SortOrder 欄位說明"
      Metadata   bigint           not null
      Version    bigint           null
  FK  RefundId   bigint           not null "參照 content.Refunds"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.AuditLogs2 "Support 模組的 AuditLogs2" in Support {
  PK  Id          bigint         not null "AuditLogs2 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(4000) null
      Description nvarchar(4000) not null
      Status      nvarchar(4000) null
      Amount      bit            null     default 0
      Quantity    nvarchar(4000) not null
      StartsAt    bigint         null
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Products3 "Support 模組的 Products3" in Support {
  PK  Id          bigint           not null "Products3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Version     int              not null
      Notes       bit              null     default 0
      Priority    decimal(18,2)    null     "Priority 欄位說明"
      Score       uniqueidentifier not null
      Name        bit              not null default 0
      Title       bigint           not null
      Description nvarchar(200)    null
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Invoices3 "Support 模組的 Invoices3" in Support {
  PK    Id         bigint         not null "Invoices3 主鍵"
  UQ    Code       nvarchar(64)   not null "業務代碼"
        IsActive   nvarchar(50)   null
        ExternalId nvarchar(4000) null
        Slug       bit            not null default 0 "Slug 欄位說明"
        Locale     bigint         not null "Locale 欄位說明"
        SortOrder  nvarchar(50)   null
        Metadata   nvarchar(200)  null
        Version    nvarchar(4000) null     "Version 欄位說明"
        Notes      decimal(18,2)  null     "Notes 欄位說明"
  FK UQ SupplierId bigint         null     "參照 billing.Suppliers"
  IDX   CreatedAt  datetime2      not null default "sysutcdatetime()" "建立時間"
}

table support.Tickets3 "Support 模組的 Tickets3" in Support {
  PK  Id          bigint           not null "Tickets3 主鍵"
  UQ  Code        nvarchar(64)     not null "業務代碼"
      Description uniqueidentifier null
      Status      nvarchar(200)    null
      Amount      nvarchar(200)    not null "Amount 欄位說明"
      Quantity    int              null     "Quantity 欄位說明"
      StartsAt    bigint           null     "StartsAt 欄位說明"
      EndsAt      bit              null     default 0
      IsActive    nvarchar(50)     not null "IsActive 欄位說明"
  FK  CartItemId  bigint           not null "參照 billing.CartItems"
  IDX CreatedAt   datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.Posts3 "Support 模組的 Posts3" in Support {
  PK  Id           bigint           not null "Posts3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Notes        int              null
      Priority     nvarchar(4000)   null     "Priority 欄位說明"
      Score        uniqueidentifier not null
      Name         nvarchar(200)    not null
      Title        bigint           null     "Title 欄位說明"
  FK  CartId       bigint           not null "參照 sales.Carts"
  FK  InvoiceId    bigint           not null "參照 support.Invoices"
  FK  PermissionId bigint           not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table support.AuditLogs3 "Support 模組的 AuditLogs3" in Support {
  PK  Id           bigint           not null "AuditLogs3 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      ExternalId   nvarchar(50)     null
      Slug         uniqueidentifier not null
      Locale       bigint           null
      SortOrder    bit              null     default 0
      Metadata     nvarchar(200)    null     "Metadata 欄位說明"
      Version      int              null
      Notes        nvarchar(50)     null
      Priority     bit              null     default 0
      Score        datetime2        null
      Name         bit              not null default 0 "Name 欄位說明"
  FK  OrderItemId  bigint           not null "參照 catalog.OrderItems"
  FK  AttachmentId bigint           not null "參照 content.Attachments"
  FK  VariantId    bigint           not null "參照 inventory.Variants"
  FK  CommentId    bigint           not null "參照 analytics.Comments"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Invoices_Code on support.Invoices(Code)
index IX_Invoices_CreatedAt on support.Invoices(CreatedAt)
unique index UX_Tickets_Code on support.Tickets(Code)
index IX_Tickets_CreatedAt on support.Tickets(CreatedAt)
index IX_Tickets_WarehouseId on support.Tickets(WarehouseId)
unique index UX_Posts_Code on support.Posts(Code)
index IX_Posts_CreatedAt on support.Posts(CreatedAt)
unique index UX_AuditLogs_Code on support.AuditLogs(Code)
index IX_AuditLogs_CreatedAt on support.AuditLogs(CreatedAt)
index IX_AuditLogs_InvoiceId on support.AuditLogs(InvoiceId)
index IX_AuditLogs_CouponId on support.AuditLogs(CouponId)
index IX_AuditLogs_Ledgers2Id on support.AuditLogs(Ledgers2Id)
unique index UX_Products2_Code on support.Products2(Code)
index IX_Products2_CreatedAt on support.Products2(CreatedAt)
unique index UX_Invoices2_Code on support.Invoices2(Code)
index IX_Invoices2_CreatedAt on support.Invoices2(CreatedAt)
index IX_Invoices2_OrderItemId on support.Invoices2(OrderItemId)
index IX_Invoices2_CartItemId on support.Invoices2(CartItemId)
unique index UX_Tickets2_Code on support.Tickets2(Code)
index IX_Tickets2_CreatedAt on support.Tickets2(CreatedAt)
index IX_Tickets2_CartId on support.Tickets2(CartId)
index IX_Tickets2_OrderItems3Id on support.Tickets2(OrderItems3Id)
index IX_Tickets2_LedgerId on support.Tickets2(LedgerId)
index IX_Tickets2_OrderItemId on support.Tickets2(OrderItemId)
index IX_Tickets2_CategorieId on support.Tickets2(CategorieId)
index IX_Tickets2_PaymentId on support.Tickets2(PaymentId)
unique index UX_Posts2_Code on support.Posts2(Code)
index IX_Posts2_CreatedAt on support.Posts2(CreatedAt)
index IX_Posts2_RefundId on support.Posts2(RefundId)
unique index UX_AuditLogs2_Code on support.AuditLogs2(Code)
index IX_AuditLogs2_CreatedAt on support.AuditLogs2(CreatedAt)
unique index UX_Products3_Code on support.Products3(Code)
index IX_Products3_CreatedAt on support.Products3(CreatedAt)
unique index UX_Invoices3_Code on support.Invoices3(Code)
index IX_Invoices3_CreatedAt on support.Invoices3(CreatedAt)
index IX_Invoices3_SupplierId on support.Invoices3(SupplierId)
unique index UX_Tickets3_Code on support.Tickets3(Code)
index IX_Tickets3_CreatedAt on support.Tickets3(CreatedAt)
index IX_Tickets3_CartItemId on support.Tickets3(CartItemId)
unique index UX_Posts3_Code on support.Posts3(Code)
index IX_Posts3_CreatedAt on support.Posts3(CreatedAt)
index IX_Posts3_CartId on support.Posts3(CartId)
index IX_Posts3_InvoiceId on support.Posts3(InvoiceId)
index IX_Posts3_PermissionId on support.Posts3(PermissionId)
unique index UX_AuditLogs3_Code on support.AuditLogs3(Code)
index IX_AuditLogs3_CreatedAt on support.AuditLogs3(CreatedAt)
index IX_AuditLogs3_OrderItemId on support.AuditLogs3(OrderItemId)
index IX_AuditLogs3_AttachmentId on support.AuditLogs3(AttachmentId)
index IX_AuditLogs3_VariantId on support.AuditLogs3(VariantId)
index IX_AuditLogs3_CommentId on support.AuditLogs3(CommentId)
```

## dbo（6 張表）

```dbschema
table dbo.Users "Identity 模組的 Users" in Identity {
  PK  Id          bigint         not null "Users 主鍵"
  UQ  Code        nvarchar(64)   not null "業務代碼"
      Title       nvarchar(4000) not null
      Description nvarchar(50)   null
      Status      bit            null     default 0
      Amount      datetime2      null
      Quantity    decimal(18,2)  null
      StartsAt    decimal(18,2)  not null
      EndsAt      nvarchar(50)   null
      IsActive    bit            null     default 0
      ExternalId  bit            not null default 0 "ExternalId 欄位說明"
      Slug        bit            not null default 0
      Locale      nvarchar(50)   null
  FK  CartId      bigint         not null "參照 sales.Carts"
  FK  TaxId       bigint         not null "參照 audit.Taxs"
  FK  CategorieId bigint         not null "參照 analytics.Categories"
  IDX CreatedAt   datetime2      not null default "sysutcdatetime()" "建立時間"
}

table dbo.Roles "Catalog 模組的 Roles" in Catalog {
  PK  Id         bigint           not null "Roles 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      IsActive   uniqueidentifier not null
      ExternalId uniqueidentifier not null
      Slug       decimal(18,2)    not null
      Locale     nvarchar(200)    not null
      SortOrder  nvarchar(200)    not null "SortOrder 欄位說明"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table dbo.Permissions "Sales 模組的 Permissions" in Sales {
  PK  Id        bigint       not null "Permissions 主鍵"
  UQ  Code      nvarchar(64) not null "業務代碼"
      Notes     nvarchar(50) null
      Priority  bit          null     default 0
      Score     bigint       not null
      Name      bit          not null default 0
  FK  SessionId bigint       not null "參照 dbo.Sessions"
  IDX CreatedAt datetime2    not null default "sysutcdatetime()" "建立時間"
}

table dbo.Sessions "Billing 模組的 Sessions" in Billing {
  PK  Id         bigint           not null "Sessions 主鍵"
  UQ  Code       nvarchar(64)     not null "業務代碼"
      Status     int              null     "Status 欄位說明"
      Amount     bigint           null
      Quantity   int              not null
      StartsAt   nvarchar(50)     null
      EndsAt     bit              not null default 0 "EndsAt 欄位說明"
      IsActive   bit              not null default 0 "IsActive 欄位說明"
      ExternalId uniqueidentifier null     "ExternalId 欄位說明"
      Slug       nvarchar(4000)   not null "Slug 欄位說明"
      Locale     datetime2        null
  FK  RefundId   bigint           not null "參照 content.Refunds"
  IDX CreatedAt  datetime2        not null default "sysutcdatetime()" "建立時間"
}

table dbo.Tokens "Shipping 模組的 Tokens" in Shipping {
  PK  Id           bigint           not null "Tokens 主鍵"
  UQ  Code         nvarchar(64)     not null "業務代碼"
      Slug         datetime2        null     "Slug 欄位說明"
      Locale       uniqueidentifier not null
      SortOrder    nvarchar(200)    not null "SortOrder 欄位說明"
      Metadata     bigint           not null
      Version      uniqueidentifier not null "Version 欄位說明"
      Notes        bigint           null     "Notes 欄位說明"
  FK  PermissionId bigint           not null "參照 dbo.Permissions"
  IDX CreatedAt    datetime2        not null default "sysutcdatetime()" "建立時間"
}

table dbo.Products "Support 模組的 Products" in Support {
  PK  Id          bigint        not null "Products 主鍵"
  UQ  Code        nvarchar(64)  not null "業務代碼"
      Score       bit           null     default 0
      Name        nvarchar(200) not null
      Title       nvarchar(200) not null
      Description decimal(18,2) not null
      Status      bigint        not null
      Amount      bit           null     default 0
      Quantity    bit           null     default 0 "Quantity 欄位說明"
  FK  MessageId   bigint        not null "參照 analytics.Messages"
  FK  Tags3Id     bigint        not null "參照 inventory.Tags3"
  FK  RoleId      bigint        not null "參照 dbo.Roles"
  IDX CreatedAt   datetime2     not null default "sysutcdatetime()" "建立時間"
}

unique index UX_Users_Code on dbo.Users(Code)
index IX_Users_CreatedAt on dbo.Users(CreatedAt)
index IX_Users_CartId on dbo.Users(CartId)
index IX_Users_TaxId on dbo.Users(TaxId)
index IX_Users_CategorieId on dbo.Users(CategorieId)
unique index UX_Roles_Code on dbo.Roles(Code)
index IX_Roles_CreatedAt on dbo.Roles(CreatedAt)
unique index UX_Permissions_Code on dbo.Permissions(Code)
index IX_Permissions_CreatedAt on dbo.Permissions(CreatedAt)
index IX_Permissions_SessionId on dbo.Permissions(SessionId)
unique index UX_Sessions_Code on dbo.Sessions(Code)
index IX_Sessions_CreatedAt on dbo.Sessions(CreatedAt)
index IX_Sessions_RefundId on dbo.Sessions(RefundId)
unique index UX_Tokens_Code on dbo.Tokens(Code)
index IX_Tokens_CreatedAt on dbo.Tokens(CreatedAt)
index IX_Tokens_PermissionId on dbo.Tokens(PermissionId)
unique index UX_Products_Code on dbo.Products(Code)
index IX_Products_CreatedAt on dbo.Products(CreatedAt)
index IX_Products_MessageId on dbo.Products(MessageId)
index IX_Products_Tags3Id on dbo.Products(Tags3Id)
index IX_Products_RoleId on dbo.Products(RoleId)
```

## 關聯（195 條）

```dbschema
relation FK_Addresses3_Payments {
  catalog.Addresses3.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Snapshots3_Trackings2 {
  shipping.Snapshots3.Trackings2Id N -> 1 shipping.Trackings2.Id
}

relation FK_Medias_Invoices {
  content.Medias.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Comments2_Refunds {
  analytics.Comments2.RefundId N -> 1 content.Refunds.Id
}

relation FK_Addresses2_CartItems {
  catalog.Addresses2.CartItemId 1 -> 1 billing.CartItems.Id
}

relation FK_AuditLogs3_OrderItems {
  support.AuditLogs3.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Addresses_Invoices {
  catalog.Addresses.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Carriers_Permissions {
  sales.Carriers.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Shipments3_Dashboards {
  identity.Shipments3.DashboardId N -> 1 billing.Dashboards.Id
}

relation FK_Notes2_Prices {
  audit.Notes2.PriceId N -> 1 audit.Prices.Id
}

relation FK_Variants_CartItems {
  inventory.Variants.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_Invoices2_OrderItems {
  support.Invoices2.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Metrics3_Categories {
  catalog.Metrics3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Packages2_Tokens {
  billing.Packages2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Orders3_Comments {
  identity.Orders3.CommentId N -> 1 analytics.Comments.Id
}

relation FK_AuditLogs3_Attachments {
  support.AuditLogs3.AttachmentId N -> 1 content.Attachments.Id
}

relation FK_Users_Carts {
  dbo.Users.CartId N -> 1 sales.Carts.Id
}

relation FK_Attachments3_Addresses3 {
  content.Attachments3.Addresses3Id N -> 1 catalog.Addresses3.Id
}

relation FK_Attachments_OrderItems {
  content.Attachments.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Brands3_Carts {
  content.Brands3.CartId N -> N sales.Carts.Id
}

relation FK_Trackings2_Carts {
  shipping.Trackings2.CartId N -> 1 sales.Carts.Id
}

relation FK_Coupons_CartItems {
  shipping.Coupons.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_Ledgers2_Tokens {
  inventory.Ledgers2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Variants3_Categories {
  inventory.Variants3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Taxs2_Templates3 {
  audit.Taxs2.Templates3Id N -> 1 audit.Templates3.Id
}

relation FK_Messages_Tokens2 {
  analytics.Messages.Tokens2Id N -> 1 shipping.Tokens2.Id
}

relation FK_Notes_OrderItems {
  audit.Notes.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Products_Messages {
  dbo.Products.MessageId N -> 1 analytics.Messages.Id
}

relation FK_Policies2_Carriers2 {
  inventory.Policies2.Carriers2Id N -> 1 sales.Carriers2.Id
}

relation FK_Suppliers3_OrderItems {
  billing.Suppliers3.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Events_Refunds {
  identity.Events.RefundId N -> 1 content.Refunds.Id
}

relation FK_Templates2_Roles {
  audit.Templates2.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Packages2_Payments {
  billing.Packages2.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Transfers2_Orders {
  sales.Transfers2.OrderId N -> 1 identity.Orders.Id
}

relation FK_Tickets2_Carts {
  support.Tickets2.CartId N -> 1 sales.Carts.Id
}

relation FK_Purchases3_Invoices {
  shipping.Purchases3.InvoiceId N -> N support.Invoices.Id
}

relation FK_Tokens_Permissions {
  dbo.Tokens.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Carts_Trackings3 {
  sales.Carts.Trackings3Id N -> 1 shipping.Trackings3.Id
}

relation FK_Users_Taxs {
  dbo.Users.TaxId N -> 1 audit.Taxs.Id
}

relation FK_Tags_Users {
  inventory.Tags.UserId N -> 1 dbo.Users.Id
}

relation FK_Categories_Carts {
  analytics.Categories.CartId N -> 1 sales.Carts.Id
}

relation FK_Tokens3_Orders {
  shipping.Tokens3.OrderId N -> 1 identity.Orders.Id
}

relation FK_Snapshots2_Products {
  shipping.Snapshots2.ProductId N -> 1 dbo.Products.Id
}

relation FK_Stocks_Coupons {
  catalog.Stocks.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Prices2_Categories {
  audit.Prices2.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Trackings2_Roles {
  shipping.Trackings2.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Suppliers_Brands {
  billing.Suppliers.BrandId N -> 1 content.Brands.Id
}

relation FK_Changes_Products {
  analytics.Changes.ProductId N -> 1 dbo.Products.Id
}

relation FK_Carriers_Invoices {
  sales.Carriers.InvoiceId N -> N support.Invoices.Id
}

relation FK_Events3_CartItems {
  identity.Events3.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_CartItems2_Payments {
  billing.CartItems2.PaymentId N -> N analytics.Payments.Id
}

relation FK_Ledgers2_Templates2 {
  inventory.Ledgers2.Templates2Id N -> 1 audit.Templates2.Id
}

relation FK_Transfers2_OrderItems {
  sales.Transfers2.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_CartItems2_Tokens {
  billing.CartItems2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Posts3_Carts {
  support.Posts3.CartId N -> 1 sales.Carts.Id
}

relation FK_Categories2_Carts2 {
  analytics.Categories2.Carts2Id N -> 1 sales.Carts2.Id
}

relation FK_Events2_Sessions {
  identity.Events2.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Events_Carts {
  identity.Events.CartId N -> 1 sales.Carts.Id
}

relation FK_Payments2_Coupons {
  analytics.Payments2.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Templates_Payments {
  audit.Templates.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Notes3_Coupons {
  audit.Notes3.CouponId N -> N shipping.Coupons.Id
}

relation FK_Metrics3_Orders {
  catalog.Metrics3.OrderId N -> 1 identity.Orders.Id
}

relation FK_Medias3_Coupons {
  content.Medias3.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Carriers_Tokens {
  sales.Carriers.TokenId N -> N dbo.Tokens.Id
}

relation FK_OrderItems_Refunds {
  catalog.OrderItems.RefundId N -> 1 content.Refunds.Id
}

relation FK_Attachments2_OrderItems {
  content.Attachments2.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Tickets2_OrderItems3 {
  support.Tickets2.OrderItems3Id N -> 1 catalog.OrderItems3.Id
}

relation FK_Trackings_Orders {
  shipping.Trackings.OrderId N -> 1 identity.Orders.Id
}

relation FK_Prices3_Warehouses {
  audit.Prices3.WarehouseId N -> 1 identity.Warehouses.Id
}

relation FK_Messages_Refunds {
  analytics.Messages.RefundId N -> 1 content.Refunds.Id
}

relation FK_Purchases2_Changes3 {
  shipping.Purchases2.Changes3Id N -> 1 analytics.Changes3.Id
}

relation FK_Purchases3_Coupons {
  shipping.Purchases3.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Prices_Permissions {
  audit.Prices.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Shipments3_Events {
  identity.Shipments3.EventId N -> 1 identity.Events.Id
}

relation FK_Messages2_Invoices {
  analytics.Messages2.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Posts2_Refunds {
  support.Posts2.RefundId N -> 1 content.Refunds.Id
}

relation FK_Tickets2_Ledgers {
  support.Tickets2.LedgerId N -> 1 inventory.Ledgers.Id
}

relation FK_Settings_Payments {
  audit.Settings.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Pages_OrderItems3 {
  inventory.Pages.OrderItems3Id N -> 1 catalog.OrderItems3.Id
}

relation FK_OrderItems2_Refunds {
  catalog.OrderItems2.RefundId N -> 1 content.Refunds.Id
}

relation FK_Trackings3_Sessions {
  shipping.Trackings3.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_OrderItems3_Sessions {
  catalog.OrderItems3.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Carriers_Carts {
  sales.Carriers.CartId N -> 1 sales.Carts.Id
}

relation FK_Purchases3_Categories {
  shipping.Purchases3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Dashboards2_Orders {
  billing.Dashboards2.OrderId N -> 1 identity.Orders.Id
}

relation FK_Payments_Sessions3 {
  analytics.Payments.Sessions3Id N -> 1 billing.Sessions3.Id
}

relation FK_Events2_Attachments2 {
  identity.Events2.Attachments2Id N -> 1 content.Attachments2.Id
}

relation FK_OrderItems_Events {
  catalog.OrderItems.EventId 1 -> 1 identity.Events.Id
}

relation FK_OrderItems2_Payments {
  catalog.OrderItems2.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Products_Tags3 {
  dbo.Products.Tags3Id N -> N inventory.Tags3.Id
}

relation FK_Users_Categories {
  dbo.Users.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Policies_Prices {
  inventory.Policies.PriceId N -> 1 audit.Prices.Id
}

relation FK_Snapshots_OrderItems {
  shipping.Snapshots.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Templates3_Products {
  audit.Templates3.ProductId 1 -> 1 dbo.Products.Id
}

relation FK_Packages2_Users {
  billing.Packages2.UserId 1 -> 1 dbo.Users.Id
}

relation FK_Shipments3_Coupons {
  identity.Shipments3.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Policies_Medias3 {
  inventory.Policies.Medias3Id N -> 1 content.Medias3.Id
}

relation FK_Purchases_Refunds {
  shipping.Purchases.RefundId N -> 1 content.Refunds.Id
}

relation FK_Policies3_Purchases2 {
  inventory.Policies3.Purchases2Id N -> 1 shipping.Purchases2.Id
}

relation FK_Taxs2_Orders {
  audit.Taxs2.OrderId N -> 1 identity.Orders.Id
}

relation FK_Settings3_Users {
  audit.Settings3.UserId N -> 1 dbo.Users.Id
}

relation FK_Payments3_Products2 {
  analytics.Payments3.Products2Id N -> 1 support.Products2.Id
}

relation FK_Changes3_Payments {
  analytics.Changes3.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Taxs2_Products {
  audit.Taxs2.ProductId N -> 1 dbo.Products.Id
}

relation FK_Roles3_Changes3 {
  catalog.Roles3.Changes3Id N -> 1 analytics.Changes3.Id
}

relation FK_Templates_Categories {
  audit.Templates.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Brands_Coupons {
  content.Brands.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_Packages3_Categories {
  billing.Packages3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Messages3_Brands {
  analytics.Messages3.BrandId N -> 1 content.Brands.Id
}

relation FK_Brands_Prices {
  content.Brands.PriceId N -> 1 audit.Prices.Id
}

relation FK_Purchases2_Stocks {
  shipping.Purchases2.StockId N -> 1 catalog.Stocks.Id
}

relation FK_Policies3_Tokens {
  inventory.Policies3.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Categories_Carts_2 {
  analytics.Categories.CartId N -> 1 sales.Carts.Id
}

relation FK_Tickets2_OrderItems {
  support.Tickets2.OrderItemId N -> N catalog.OrderItems.Id
}

relation FK_Permissions_Sessions {
  dbo.Permissions.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Pages3_Sessions {
  inventory.Pages3.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Trackings3_OrderItems {
  shipping.Trackings3.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Carriers_OrderItems {
  sales.Carriers.OrderItemId 1 -> 1 catalog.OrderItems.Id
}

relation FK_Settings_Categories {
  audit.Settings.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Purchases2_Addresses2 {
  shipping.Purchases2.Addresses2Id N -> 1 catalog.Addresses2.Id
}

relation FK_AuditLogs_Invoices {
  support.AuditLogs.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Approvals3_Tokens {
  content.Approvals3.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Posts3_Invoices {
  support.Posts3.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Trackings3_Shipments3 {
  shipping.Trackings3.Shipments3Id N -> 1 identity.Shipments3.Id
}

relation FK_Tags3_Categories {
  inventory.Tags3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Policies_Invoices2 {
  inventory.Policies.Invoices2Id N -> N support.Invoices2.Id
}

relation FK_Stocks2_Purchases3 {
  catalog.Stocks2.Purchases3Id N -> 1 shipping.Purchases3.Id
}

relation FK_Shipments_Sessions {
  identity.Shipments.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Policies_Users {
  inventory.Policies.UserId N -> 1 dbo.Users.Id
}

relation FK_Users3_Tokens {
  identity.Users3.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Ledgers2_Permissions {
  inventory.Ledgers2.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Settings3_Products {
  audit.Settings3.ProductId N -> 1 dbo.Products.Id
}

relation FK_Carriers2_Prices {
  sales.Carriers2.PriceId N -> 1 audit.Prices.Id
}

relation FK_Tickets2_Categories {
  support.Tickets2.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_AuditLogs3_Variants {
  support.AuditLogs3.VariantId N -> 1 inventory.Variants.Id
}

relation FK_Tickets2_Payments {
  support.Tickets2.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Categories2_Taxs {
  analytics.Categories2.TaxId N -> 1 audit.Taxs.Id
}

relation FK_Reports_Sessions {
  sales.Reports.SessionId N -> 1 dbo.Sessions.Id
}

relation FK_Changes3_Payments_2 {
  analytics.Changes3.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_CartItems_Users {
  billing.CartItems.UserId N -> 1 dbo.Users.Id
}

relation FK_Events3_Roles {
  identity.Events3.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Trackings3_Permissions {
  shipping.Trackings3.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Carriers2_Tokens {
  sales.Carriers2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Sessions2_Permissions {
  billing.Sessions2.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_AuditLogs3_Comments {
  support.AuditLogs3.CommentId N -> 1 analytics.Comments.Id
}

relation FK_Posts3_Permissions {
  support.Posts3.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Comments2_Tokens {
  analytics.Comments2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Settings2_Roles {
  audit.Settings2.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Reports_Orders {
  sales.Reports.OrderId N -> 1 identity.Orders.Id
}

relation FK_Medias3_Invoices {
  content.Medias3.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Addresses_Roles {
  catalog.Addresses.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Coupons_Refunds {
  shipping.Coupons.RefundId N -> 1 content.Refunds.Id
}

relation FK_Sessions_Refunds {
  dbo.Sessions.RefundId N -> 1 content.Refunds.Id
}

relation FK_Tickets_Warehouses {
  support.Tickets.WarehouseId N -> 1 identity.Warehouses.Id
}

relation FK_Users2_Approvals2 {
  identity.Users2.Approvals2Id N -> 1 content.Approvals2.Id
}

relation FK_OrderItems2_Tokens {
  catalog.OrderItems2.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Reports3_Variants {
  sales.Reports3.VariantId N -> 1 inventory.Variants.Id
}

relation FK_Tickets3_CartItems {
  support.Tickets3.CartItemId N -> N billing.CartItems.Id
}

relation FK_Events3_Categories {
  identity.Events3.CategorieId N -> 1 analytics.Categories.Id
}

relation FK_Tags_OrderItems {
  inventory.Tags.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Purchases2_Snapshots {
  shipping.Purchases2.SnapshotId N -> 1 shipping.Snapshots.Id
}

relation FK_Sessions2_CartItems {
  billing.Sessions2.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_Comments3_Transfers3 {
  analytics.Comments3.Transfers3Id N -> 1 sales.Transfers3.Id
}

relation FK_Tags3_Roles {
  inventory.Tags3.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Changes3_Orders {
  analytics.Changes3.OrderId N -> 1 identity.Orders.Id
}

relation FK_Variants_CartItems_2 {
  inventory.Variants.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_Prices_Stocks {
  audit.Prices.StockId N -> 1 catalog.Stocks.Id
}

relation FK_Policies_OrderItems {
  inventory.Policies.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Changes3_OrderItems {
  analytics.Changes3.OrderItemId N -> 1 catalog.OrderItems.Id
}

relation FK_Taxs_Brands {
  audit.Taxs.BrandId N -> 1 content.Brands.Id
}

relation FK_Policies_Payments {
  inventory.Policies.PaymentId N -> 1 analytics.Payments.Id
}

relation FK_Orders2_Ledgers {
  identity.Orders2.LedgerId N -> 1 inventory.Ledgers.Id
}

relation FK_Invoices3_Suppliers {
  support.Invoices3.SupplierId 1 -> 1 billing.Suppliers.Id
}

relation FK_Permissions2_Comments2 {
  sales.Permissions2.Comments2Id N -> 1 analytics.Comments2.Id
}

relation FK_Coupons_Carts {
  shipping.Coupons.CartId N -> 1 sales.Carts.Id
}

relation FK_Variants3_Products {
  inventory.Variants3.ProductId N -> 1 dbo.Products.Id
}

relation FK_Comments3_Users {
  analytics.Comments3.UserId N -> 1 dbo.Users.Id
}

relation FK_Shipments3_Ledgers {
  identity.Shipments3.LedgerId N -> 1 inventory.Ledgers.Id
}

relation FK_Prices3_Sessions {
  audit.Prices3.SessionId N -> N dbo.Sessions.Id
}

relation FK_Packages3_Variants {
  billing.Packages3.VariantId N -> 1 inventory.Variants.Id
}

relation FK_Changes_Tokens {
  analytics.Changes.TokenId N -> 1 dbo.Tokens.Id
}

relation FK_Payments_Invoices {
  analytics.Payments.InvoiceId N -> 1 support.Invoices.Id
}

relation FK_Settings_CartItems {
  audit.Settings.CartItemId N -> 1 billing.CartItems.Id
}

relation FK_Suppliers2_Events3 {
  billing.Suppliers2.Events3Id N -> 1 identity.Events3.Id
}

relation FK_Dashboards_Payments3 {
  billing.Dashboards.Payments3Id N -> 1 analytics.Payments3.Id
}

relation FK_Metrics_Permissions {
  catalog.Metrics.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Approvals_Payments3 {
  content.Approvals.Payments3Id N -> 1 analytics.Payments3.Id
}

relation FK_Comments2_Variants {
  analytics.Comments2.VariantId 1 -> 1 inventory.Variants.Id
}

relation FK_Orders2_Approvals3 {
  identity.Orders2.Approvals3Id N -> N content.Approvals3.Id
}

relation FK_Products_Roles {
  dbo.Products.RoleId N -> 1 dbo.Roles.Id
}

relation FK_Dashboards2_Users {
  billing.Dashboards2.UserId N -> 1 dbo.Users.Id
}

relation FK_AuditLogs_Coupons {
  support.AuditLogs.CouponId N -> 1 shipping.Coupons.Id
}

relation FK_AuditLogs_Ledgers2 {
  support.AuditLogs.Ledgers2Id N -> 1 inventory.Ledgers2.Id
}

relation FK_Ledgers3_Permissions {
  inventory.Ledgers3.PermissionId N -> 1 dbo.Permissions.Id
}

relation FK_Invoices2_CartItems {
  support.Invoices2.CartItemId N -> 1 billing.CartItems.Id
}
```
