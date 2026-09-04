import { describe, expect, it } from "vitest";
import type { Column, Table } from "@schemalens/schema-core";
import {
  CARD_METRICS,
  DEFAULT_VIEW_STATE,
  buildCardModel,
  columnBadges,
  formatType,
  rowCenterOffset,
  visibleColumns,
  type ViewState,
} from "@schemalens/schema-renderer";

function column(partial: Partial<Column> & { name: string }): Column {
  return {
    type: "bigint",
    nullable: false,
    primaryKey: false,
    foreignKey: false,
    unique: false,
    indexed: false,
    ...partial,
  };
}

const users: Table = {
  id: "dbo.Users",
  schema: "dbo",
  name: "Users",
  comment: "系統使用者",
  columns: [
    column({ name: "Id", primaryKey: true }),
    column({ name: "Email", type: "nvarchar", length: 255, unique: true }),
    column({ name: "DisplayName", type: "nvarchar", length: 100, nullable: true }),
    column({ name: "TenantId", foreignKey: true }),
    column({ name: "CreatedAt", type: "datetime2", defaultValue: "sysutcdatetime()", indexed: true }),
  ],
  indexes: [{ name: "IX_Users_CreatedAt", columns: ["CreatedAt"], unique: false }],
};

const state = (patch: Partial<ViewState> = {}): ViewState => ({ ...DEFAULT_VIEW_STATE, ...patch });

describe("formatType", () => {
  it("帶長度", () => {
    expect(formatType(column({ name: "x", type: "nvarchar", length: 255 }))).toBe("nvarchar(255)");
  });
  it("帶精度與小數位", () => {
    expect(formatType(column({ name: "x", type: "decimal", precision: 18, scale: 2 }))).toBe("decimal(18,2)");
  });
  it("沒有修飾時只回型別名", () => {
    expect(formatType(column({ name: "x", type: "bigint" }))).toBe("bigint");
  });
});

describe("columnBadges", () => {
  it("PK 優先，不重複標 UQ", () => {
    expect(columnBadges(column({ name: "Id", primaryKey: true, unique: true }))).toEqual(["PK"]);
  });
  it("FK 與 UQ 可以並存", () => {
    expect(columnBadges(column({ name: "x", foreignKey: true, unique: true }))).toEqual(["FK", "UQ"]);
  });
  it("只有 index 時標 IDX", () => {
    expect(columnBadges(column({ name: "x", indexed: true }))).toEqual(["IDX"]);
  });
});

describe("visibleColumns", () => {
  it("Full 顯示所有欄位（約束 #16）", () => {
    expect(visibleColumns(users, "full")).toHaveLength(5);
  });
  it("Keys 只留 PK / FK / UQ / IDX", () => {
    const names = visibleColumns(users, "keys").map((c) => c.name);
    expect(names).toEqual(["Id", "Email", "TenantId", "CreatedAt"]);
    expect(names).not.toContain("DisplayName");
  });
  it("Overview 不顯示欄位", () => {
    expect(visibleColumns(users, "overview")).toHaveLength(0);
  });
});

describe("buildCardModel", () => {
  it("預設 Full：直接看得到欄位、型別與註解（AC-05）", () => {
    const card = buildCardModel(users, state());
    expect(card.detailLevel).toBe("full");
    expect(card.rows).toHaveLength(5);
    expect(card.showComment).toBe(true);
    expect(card.rows[1]!.typeLabel).toBe("nvarchar(255)");
    expect(card.rows[0]!.badges).toEqual(["PK"]);
  });

  it("Keys 會記錄被藏起來的欄位數，讓使用者知道還有東西", () => {
    const card = buildCardModel(users, state({ detailLevel: "keys" }));
    expect(card.hiddenColumnCount).toBe(1);
  });

  it("Collapse 後只剩標題高度（plan §31）", () => {
    const card = buildCardModel(users, state({ collapsed: new Set(["dbo.Users"]) }));
    expect(card.rows).toHaveLength(0);
    expect(card.height).toBe(CARD_METRICS.compactHeight);
  });

  it("卡片高度等於實際列數，layout 與繪製不會對不上", () => {
    const card = buildCardModel(users, state());
    const expected =
      CARD_METRICS.headerHeight +
      CARD_METRICS.commentHeight +
      CARD_METRICS.bodyPaddingY * 2 +
      5 * CARD_METRICS.rowHeight;
    expect(card.height).toBe(expected);
  });

  it("寬度被夾在 min / max 之間", () => {
    const card = buildCardModel(users, state());
    expect(card.width).toBeGreaterThanOrEqual(CARD_METRICS.minWidth);
    expect(card.width).toBeLessThanOrEqual(CARD_METRICS.maxWidth);
  });
});

describe("rowCenterOffset", () => {
  it("回傳該欄位 Row 的中心，讓 Relation 連到真正的欄位", () => {
    const card = buildCardModel(users, state());
    const top = CARD_METRICS.headerHeight + CARD_METRICS.commentHeight + CARD_METRICS.bodyPaddingY;
    expect(rowCenterOffset(card, "Id")).toBe(top + CARD_METRICS.rowHeight / 2);
    expect(rowCenterOffset(card, "Email")).toBe(top + CARD_METRICS.rowHeight * 1.5);
  });

  it("欄位在目前檢視看不到時退回卡片中心，線不會斷", () => {
    const card = buildCardModel(users, state({ detailLevel: "overview" }));
    expect(rowCenterOffset(card, "Email")).toBe(card.height / 2);
  });
});
