/**
 * Renderer 的 DOM 驗收測試。
 *
 * 這裡刻意驗「打開 Preview 預設看到什麼」——也就是約束 #15 / #16 與 AC-05：
 * 預設不得只有 Table 名稱，必須直接有 Column / Type / Key 標記與欄位級 Relation。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { generateSchema } from "@schemalens/schema-fixtures";
import { SCHEMA_VERSION, type Schema } from "@schemalens/schema-core";
import { SchemaRenderer } from "@schemalens/schema-renderer";

const blogSchema: Schema = {
  version: SCHEMA_VERSION,
  metadata: { defaultSchema: "dbo" },
  tables: [
    {
      id: "dbo.Users",
      schema: "dbo",
      name: "Users",
      comment: "系統使用者",
      columns: [
        { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
        { name: "Email", type: "nvarchar", length: 255, nullable: false, primaryKey: false, foreignKey: false, unique: true, indexed: false },
      ],
      indexes: [],
    },
    {
      id: "dbo.Posts",
      schema: "dbo",
      name: "Posts",
      comment: "文章",
      columns: [
        { name: "Id", type: "bigint", nullable: false, primaryKey: true, foreignKey: false, unique: false, indexed: false },
        { name: "AuthorId", type: "bigint", nullable: false, primaryKey: false, foreignKey: true, unique: false, indexed: false },
        { name: "Title", type: "nvarchar", length: 200, nullable: false, primaryKey: false, foreignKey: false, unique: false, indexed: false },
      ],
      indexes: [],
    },
  ],
  relations: [
    {
      name: "FK_Posts_Users",
      sourceTable: "dbo.Posts",
      sourceColumns: ["AuthorId"],
      targetTable: "dbo.Users",
      targetColumns: ["Id"],
      cardinality: "N:1",
    },
  ],
};

function mount(): { host: HTMLElement; renderer: SchemaRenderer } {
  const host = document.createElement("div");
  // jsdom 沒有版面計算，給一個尺寸讓 fitView 有東西可算。
  host.getBoundingClientRect = () => ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
  document.body.append(host);
  return { host, renderer: new SchemaRenderer(host) };
}

describe("SchemaRenderer 預設畫面", () => {
  let host: HTMLElement;
  let renderer: SchemaRenderer;

  beforeEach(() => {
    document.body.replaceChildren();
    ({ host, renderer } = mount());
    renderer.setSchema(blogSchema);
  });

  it("每張表都畫成一張卡片", () => {
    expect(host.querySelectorAll(".dbs-card")).toHaveLength(2);
  });

  it("預設就顯示欄位、型別與 PK / FK / UQ 標記（AC-05）", () => {
    const posts = host.querySelector('[data-table-id="dbo.Posts"]')!;
    const rows = [...posts.querySelectorAll(".dbs-row")];
    expect(rows).toHaveLength(3);

    const authorRow = posts.querySelector('[data-column="AuthorId"]')!;
    expect(authorRow.querySelector(".dbs-badge.fk")?.textContent).toBe("FK");
    expect(authorRow.querySelector(".dbs-row-type")?.textContent).toBe("bigint");

    const users = host.querySelector('[data-table-id="dbo.Users"]')!;
    expect(users.querySelector('[data-column="Email"] .dbs-row-type')?.textContent).toBe("nvarchar(255)");
    expect(users.querySelector('[data-column="Email"] .dbs-badge.uq')?.textContent).toBe("UQ");
  });

  it("顯示 Table Comment", () => {
    const users = host.querySelector('[data-table-id="dbo.Users"]')!;
    expect(users.querySelector(".dbs-card-comment")?.textContent).toBe("系統使用者");
  });

  it("Relation 畫出來，且標了 cardinality 的兩端（AC-06）", () => {
    const edge = host.querySelector('[data-relation="FK_Posts_Users"]')!;
    expect(edge).not.toBeNull();
    const labels = [...edge.querySelectorAll(".dbs-edge-label")].map((n) => n.textContent);
    expect(labels).toEqual(["N", "1"]);
  });

  it("Edge 的錨點落在實際欄位 Row 上，不是卡片中心（AC-05A）", () => {
    const edge = host.querySelector('[data-relation="FK_Posts_Users"] .dbs-edge-path')!;
    const d = edge.getAttribute("d")!;
    const [, startY] = /^M ([\d.-]+) ([\d.-]+)/.exec(d)!.slice(1).map(Number);

    const posts = host.querySelector<HTMLElement>('[data-table-id="dbo.Posts"]')!;
    const top = Number.parseFloat(posts.style.top);
    const height = Number.parseFloat(posts.style.height);
    // AuthorId 是第二列，所以錨點必須高於卡片垂直中心。
    expect(startY).toBeGreaterThan(top);
    expect(startY).not.toBeCloseTo(top + height / 2, 1);
  });

  it("Relation 的 tooltip 帶出完整欄位對應", () => {
    const title = host.querySelector('[data-relation="FK_Posts_Users"] title')!;
    expect(title.textContent).toContain("dbo.Posts.AuthorId → dbo.Users.Id");
    expect(title.textContent).toContain("Cardinality: N:1");
  });
});

describe("SchemaRenderer 探索行為", () => {
  let host: HTMLElement;
  let renderer: SchemaRenderer;

  beforeEach(() => {
    document.body.replaceChildren();
    ({ host, renderer } = mount());
    renderer.setSchema(generateSchema({ tableCount: 30 }));
  });

  it("Overview 只留標題，不再畫欄位（US7）", () => {
    renderer.setViewState({ detailLevel: "overview" });
    expect(host.querySelectorAll(".dbs-row")).toHaveLength(0);
    expect(host.querySelectorAll(".dbs-card").length).toBeGreaterThan(0);
  });

  it("Keys 的欄位數少於 Full", () => {
    const full = host.querySelectorAll(".dbs-row").length;
    renderer.setViewState({ detailLevel: "keys" });
    expect(host.querySelectorAll(".dbs-row").length).toBeLessThan(full);
  });

  it("focus 後不相關的卡片被 dim", () => {
    const target = host.querySelector<HTMLElement>(".dbs-card")!.dataset.tableId!;
    renderer.focusTable(target);
    expect(host.querySelector(`[data-table-id="${target}"]`)!.classList.contains("is-selected")).toBe(true);
    expect(host.querySelectorAll(".dbs-card.is-dimmed").length).toBeGreaterThan(0);
    expect(host.querySelectorAll(".dbs-card.is-hidden")).toHaveLength(0);
  });

  it("切到 Hide 後不相關的卡片改為隱藏", () => {
    const target = host.querySelector<HTMLElement>(".dbs-card")!.dataset.tableId!;
    renderer.focusTable(target);
    renderer.setViewState({ unrelated: "hide" });
    expect(host.querySelectorAll(".dbs-card.is-hidden").length).toBeGreaterThan(0);
  });

  it("revealColumn 會 focus 該表並高亮欄位（US6）", () => {
    renderer.setSchema(blogSchema);
    renderer.revealColumn("dbo.Posts", "AuthorId");
    const row = host.querySelector('[data-table-id="dbo.Posts"] [data-column="AuthorId"]')!;
    expect(row.classList.contains("is-highlight")).toBe(true);
    expect(host.querySelector('[data-table-id="dbo.Posts"]')!.classList.contains("is-selected")).toBe(true);
  });

  it("雙擊欄位會發出 openSource（US9）", () => {
    document.body.replaceChildren();
    const targets: Array<{ tableId: string; column?: string }> = [];
    const host2 = document.createElement("div");
    host2.getBoundingClientRect = () => ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
    document.body.append(host2);
    const r = new SchemaRenderer(host2, { events: { openSource: (t) => targets.push(t) } });
    r.setSchema(blogSchema);

    host2
      .querySelector('[data-table-id="dbo.Posts"] [data-column="AuthorId"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(targets).toEqual([{ tableId: "dbo.Posts", column: "AuthorId" }]);
  });

  it("setDiagnostics 顯示錯誤但保留既有畫面（US10）", () => {
    renderer.setDiagnostics([
      {
        code: "SCHEMA_RELATION_TARGET_NOT_FOUND",
        severity: "error",
        message: "Unknown target: dbo.Unknown.Id",
        location: { file: "database.dbschema", line: 42, column: 18 },
      },
    ]);
    const banner = host.querySelector(".dbs-error")!;
    expect((banner as HTMLElement).hidden).toBe(false);
    expect(banner.textContent).toContain("SCHEMA_RELATION_TARGET_NOT_FOUND");
    expect(host.querySelectorAll(".dbs-card").length).toBeGreaterThan(0);
  });
});

describe("大型 Schema", () => {
  it("100 表可以在 3 秒內完成 layout + render（AC-20）", () => {
    document.body.replaceChildren();
    const { host, renderer } = mount();
    const schema = generateSchema({ tableCount: 100 });

    const start = performance.now();
    renderer.setSchema(schema);
    const elapsed = performance.now() - start;

    expect(host.querySelectorAll(".dbs-card")).toHaveLength(100);
    expect(elapsed).toBeLessThan(3000);
  });

  it("focus 切換只改 class，不重建 DOM（大型 schema 的互動要即時）", () => {
    document.body.replaceChildren();
    const { host, renderer } = mount();
    renderer.setSchema(generateSchema({ tableCount: 100 }));

    const firstCard = host.querySelector(".dbs-card")!;
    renderer.focusTable(firstCard.getAttribute("data-table-id")!);
    // 同一個節點物件仍在畫面上 → 沒有重建。
    expect(host.querySelector(".dbs-card")).toBe(firstCard);
  });
});
