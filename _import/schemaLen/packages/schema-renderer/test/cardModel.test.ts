import { describe, expect, it } from "vitest";
import type { Column, Table } from "@schemalens/schema-core";
import {
  CARD_METRICS,
  DEFAULT_VIEW_STATE,
  buildCardModel,
  columnBadges,
  formatType,
  rowCenterOffset,
  textWidth,
  visibleColumns,
  wrapComment,
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
    // Table 備註與 schema 同一行，不佔額外高度。
    expect(card.height).toBe(
      CARD_METRICS.headerHeight + CARD_METRICS.bodyPaddingY * 2 + 5 * CARD_METRICS.rowHeight,
    );
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
      CARD_METRICS.headerHeight + CARD_METRICS.bodyPaddingY * 2 + 5 * CARD_METRICS.rowHeight;
    expect(card.height).toBe(expected);
  });

  it("有沒有 Table 備註都不影響卡片高度（備註在標題列上）", () => {
    const withComment = buildCardModel(users, state());
    const withoutComment = buildCardModel({ ...users, comment: undefined }, state());
    expect(withComment.height).toBe(withoutComment.height);
    expect(withoutComment.showComment).toBe(false);
  });

  it("Overview 仍保留 Table 備註（不佔高度，所以沒有理由藏起來）", () => {
    const card = buildCardModel(users, state({ detailLevel: "overview" }));
    expect(card.showComment).toBe(true);
    expect(card.height).toBe(CARD_METRICS.compactHeight);
  });

  it("欄位備註會被算進卡片寬度，才不會整排被截斷", () => {
    const verbose = {
      ...users,
      columns: users.columns.map((c) =>
        c.name === "Email" ? { ...c, comment: "使用者登入用的電子郵件地址，必須唯一" } : c,
      ),
    };
    expect(buildCardModel(verbose, state()).width).toBeGreaterThan(
      buildCardModel(users, state()).width,
    );
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
    const top = CARD_METRICS.headerHeight + CARD_METRICS.bodyPaddingY;
    expect(rowCenterOffset(card, "Id")).toBe(top + CARD_METRICS.rowHeight / 2);
    expect(rowCenterOffset(card, "Email")).toBe(top + CARD_METRICS.rowHeight * 1.5);
  });

  it("欄位在目前檢視看不到時退回卡片中心，線不會斷", () => {
    const card = buildCardModel(users, state({ detailLevel: "overview" }));
    expect(rowCenterOffset(card, "Email")).toBe(card.height / 2);
  });
});

describe("wrapComment", () => {
  it("每 6 個字換一行", () => {
    expect(wrapComment("使用者登入用的電子郵件")).toEqual(["使用者登入用", "的電子郵件"]);
  });

  it("短於一行時不切", () => {
    expect(wrapComment("帳號")).toEqual(["帳號"]);
  });

  it("空字串不產生行", () => {
    expect(wrapComment("")).toEqual([]);
    expect(wrapComment("   ")).toEqual([]);
  });

  it("每行字數可調整", () => {
    expect(wrapComment("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("備註展開", () => {
  const longComment = "使用者登入用的電子郵件地址";
  const table: Table = {
    ...users,
    columns: users.columns.map((c) => (c.name === "Email" ? { ...c, comment: longComment } : c)),
  };

  it("預設不展開：備註單行，列高維持 22", () => {
    const card = buildCardModel(table, state());
    expect(card.commentsExpanded).toBe(false);
    const email = card.rows.find((r) => r.column.name === "Email")!;
    expect(email.commentLines).toEqual([]);
    expect(email.height).toBe(CARD_METRICS.rowHeight);
  });

  it("展開後備註切成多行，該列變高", () => {
    const card = buildCardModel(table, state({ expandComments: true }));
    const email = card.rows.find((r) => r.column.name === "Email")!;
    expect(email.commentLines).toEqual(["使用者登入用", "的電子郵件地", "址"]);
    expect(email.height).toBeGreaterThan(CARD_METRICS.rowHeight);
    expect(email.height).toBe(3 * CARD_METRICS.commentLineHeight + 6);
  });

  it("沒有備註的欄位不會變高", () => {
    const card = buildCardModel(table, state({ expandComments: true }));
    const displayName = card.rows.find((r) => r.column.name === "DisplayName")!;
    expect(displayName.height).toBe(CARD_METRICS.rowHeight);
  });

  it("卡片高度等於各列高度總和，layout 與繪製才不會對不上", () => {
    const card = buildCardModel(table, state({ expandComments: true }));
    const sum = card.rows.reduce((total, row) => total + row.height, 0);
    expect(card.height).toBe(CARD_METRICS.headerHeight + CARD_METRICS.bodyPaddingY * 2 + sum);
  });

  it("錨點會累加前面每一列的實際高度（否則關聯線會接歪）", () => {
    const card = buildCardModel(table, state({ expandComments: true }));
    const top = CARD_METRICS.headerHeight + CARD_METRICS.bodyPaddingY;
    const idRow = card.rows[0]!;
    const emailRow = card.rows[1]!;

    expect(rowCenterOffset(card, "Id")).toBe(top + idRow.height / 2);
    expect(rowCenterOffset(card, "Email")).toBe(top + idRow.height + emailRow.height / 2);
    // 第三列必須被前面變高的 Email 推下去。
    expect(rowCenterOffset(card, "DisplayName")).toBe(
      top + idRow.height + emailRow.height + card.rows[2]!.height / 2,
    );
  });

  it("只有 Full 檢視會展開；Keys 仍是截斷", () => {
    const card = buildCardModel(table, state({ expandComments: true, detailLevel: "keys" }));
    expect(card.commentsExpanded).toBe(false);
    expect(card.rows.every((row) => row.commentLines.length === 0)).toBe(true);
  });

  it("展開時備註欄固定寬度，卡片不會被長註解撐爆", () => {
    const truncated = buildCardModel(table, state());
    const expanded = buildCardModel(table, state({ expandComments: true }));
    expect(expanded.width).toBeLessThan(truncated.width);
  });
});

describe("textWidth（全形字寬度）", () => {
  it("半形字算 1", () => {
    expect(textWidth("Email")).toBe(5);
  });

  it("中文字算 2", () => {
    expect(textWidth("留言者")).toBe(6);
  });

  it("中英混排逐字累加", () => {
    // 作者指向 4 字 + 全形逗號 = 5 個全形字（10）+ 半形空格（1）+ Users（5）
    expect(textWidth("作者，指向 Users")).toBe(5 * 2 + 1 + 5);
  });

  it("全形標點也算 2", () => {
    expect(textWidth("，。！")).toBe(6);
  });

  it("空字串為 0", () => {
    expect(textWidth("")).toBe(0);
  });
});

describe("中文備註的卡片寬度", () => {
  const chineseTable: Table = {
    id: "dbo.Comments",
    schema: "dbo",
    name: "Comments",
    comment: "留言",
    columns: [
      column({ name: "Id", primaryKey: true, comment: "留言 ID" }),
      column({ name: "PostId", foreignKey: true, comment: "所屬文章" }),
      column({ name: "AuthorId", foreignKey: true, comment: "留言者" }),
      column({ name: "CreatedAt", type: "datetime2", comment: "留言時間" }),
    ],
    indexes: [],
  };

  it("短中文備註不會被低估，卡片寬到放得下", () => {
    const card = buildCardModel(chineseTable, state());
    // 最寬的一列：AuthorId(8) + bigint(6) + 留言者(6) + null(5) + 間隔
    const needed =
      (textWidth("AuthorId") + textWidth("bigint") + textWidth("留言者") + 5 + 3) *
        CARD_METRICS.charWidth +
      CARD_METRICS.badgeColumnWidth +
      CARD_METRICS.columnGaps +
      CARD_METRICS.horizontalPadding;
    expect(card.width).toBeGreaterThanOrEqual(Math.min(needed, CARD_METRICS.maxWidth));
  });

  it("同樣字數的中文備註，卡片比英文備註寬", () => {
    const english: Table = {
      ...chineseTable,
      columns: chineseTable.columns.map((c) => ({ ...c, comment: "abc" })),
    };
    const chinese: Table = {
      ...chineseTable,
      columns: chineseTable.columns.map((c) => ({ ...c, comment: "中文字" })),
    };
    expect(buildCardModel(chinese, state()).width).toBeGreaterThan(
      buildCardModel(english, state()).width,
    );
  });
});
