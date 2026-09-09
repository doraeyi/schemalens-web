# 訂單模組設計

這份文件同時是設計說明與可視覺化的 Schema 來源。
在編輯器右上角按 Open Preview，或執行 `DBSchema: Open Preview`。

## 資料表

```dbschema
table Orders "訂單" {
  PK Id         bigint        not null
  FK UserId     bigint        not null
     Status     nvarchar(20)  not null default "pending"
     TotalPrice decimal(18,2) not null default 0
     CreatedAt  datetime2     not null
}

table OrderItems "訂單明細" {
  PK Id        bigint        not null
  FK OrderId   bigint        not null
     Quantity  int           not null default 1
     UnitPrice decimal(18,2) not null
}
```

## 使用者

```dbschema
table Users "使用者" {
  PK Id    bigint        not null
  UQ Email nvarchar(255) not null
}
```

## 關聯

```dbschema
relation FK_Orders_Users {
  Orders.UserId N -> 1 Users.Id
}

relation FK_OrderItems_Orders {
  OrderItems.OrderId N -> 1 Orders.Id
}
```
