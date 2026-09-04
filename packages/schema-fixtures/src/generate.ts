import {
  DEFAULT_SCHEMA_NAME,
  SCHEMA_VERSION,
  deriveColumnFlags,
  makeTableId,
  type Cardinality,
  type Column,
  type Index,
  type Relation,
  type Schema,
  type Table,
} from "@schemalens/schema-core";

/**
 * Stage 0 用的合成 Schema。
 *
 * 目的是壓測 Viewer（20 / 50 / 100 / 200 Tables），
 * 讓我們在投入完整 DSL Parser 前先確認 UX 與效能可行（plan §46、約束 #11）。
 * 這裡刻意不做隨機：同一個 seed 永遠產生同一份 schema，測試才穩定。
 */

/** 確定性的 PRNG（mulberry32），避免測試 flaky。 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODULES = [
  "Identity",
  "Catalog",
  "Sales",
  "Billing",
  "Shipping",
  "Support",
  "Analytics",
  "Content",
  "Inventory",
  "Audit",
];

const ENTITIES = [
  "User", "Role", "Permission", "Session", "Token",
  "Product", "Category", "Brand", "Variant", "Price",
  "Order", "OrderItem", "Cart", "CartItem", "Coupon",
  "Invoice", "Payment", "Refund", "Ledger", "Tax",
  "Shipment", "Address", "Carrier", "Package", "Tracking",
  "Ticket", "Message", "Attachment", "Tag", "Note",
  "Event", "Metric", "Report", "Dashboard", "Snapshot",
  "Post", "Comment", "Media", "Page", "Template",
  "Warehouse", "Stock", "Transfer", "Supplier", "Purchase",
  "AuditLog", "Change", "Approval", "Policy", "Setting",
];

const TYPES: Array<{ type: string; length?: number; precision?: number; scale?: number }> = [
  { type: "bigint" },
  { type: "int" },
  { type: "nvarchar", length: 50 },
  { type: "nvarchar", length: 200 },
  { type: "nvarchar", length: 4000 },
  { type: "decimal", precision: 18, scale: 2 },
  { type: "datetime2" },
  { type: "bit" },
  { type: "uniqueidentifier" },
];

const COLUMN_NAMES = [
  "Name", "Code", "Title", "Description", "Status", "Amount", "Quantity",
  "StartsAt", "EndsAt", "IsActive", "ExternalId", "Slug", "Locale",
  "SortOrder", "Metadata", "Version", "Notes", "Priority", "Score",
];

function pluralize(name: string): string {
  if (name.endsWith("y")) return `${name.slice(0, -1)}ies`;
  if (name.endsWith("s")) return `${name}es`;
  return `${name}s`;
}

export interface GenerateOptions {
  tableCount: number;
  seed?: number;
  /** 每張表的欄位數（含 PK / 稽核欄位）。 */
  minColumns?: number;
  maxColumns?: number;
  /** 每張表平均要產生幾條 FK。 */
  relationsPerTable?: number;
  /** 是否加入少量 N:M 與 1:1，讓 cardinality 顯示有覆蓋到。 */
  includeExoticCardinality?: boolean;
}

function tableName(i: number): string {
  const entity = ENTITIES[i % ENTITIES.length]!;
  const round = Math.floor(i / ENTITIES.length);
  return round === 0 ? pluralize(entity) : `${pluralize(entity)}${round + 1}`;
}

function schemaName(i: number): string {
  // 前幾張表放 dbo，讓 `dbo.Users` 這種預設情境一定存在。
  if (i < 6) return DEFAULT_SCHEMA_NAME;
  return MODULES[i % MODULES.length]!.toLowerCase();
}

/**
 * 產生一份可重現的大型 Schema。
 *
 * 結構刻意做成「少數 hub 表被大量參照」，因為真實資料庫就是這樣，
 * 這也是 1-Hop / 2-Hop / Upstream / Downstream 最需要被驗證的形狀。
 */
export function generateSchema(options: GenerateOptions): Schema {
  const {
    tableCount,
    seed = 42,
    minColumns = 5,
    maxColumns = 14,
    relationsPerTable = 1.3,
    includeExoticCardinality = true,
  } = options;

  const random = rng(seed);
  const tables: Table[] = [];

  for (let i = 0; i < tableCount; i++) {
    const name = tableName(i);
    const schema = schemaName(i);
    const id = makeTableId(schema, name);
    const columnCount = minColumns + Math.floor(random() * (maxColumns - minColumns + 1));

    const columns: Column[] = [
      {
        name: "Id",
        type: "bigint",
        nullable: false,
        primaryKey: true,
        foreignKey: false,
        unique: false,
        indexed: false,
        comment: `${name} 主鍵`,
      },
    ];

    // 每張表一個 UQ，讓 Keys 檢視有東西可看。
    columns.push({
      name: "Code",
      type: "nvarchar",
      length: 64,
      nullable: false,
      primaryKey: false,
      foreignKey: false,
      unique: true,
      indexed: false,
      comment: "業務代碼",
    });

    for (let c = columns.length; c < columnCount; c++) {
      const spec = TYPES[Math.floor(random() * TYPES.length)]!;
      const columnName = `${COLUMN_NAMES[(i * 7 + c) % COLUMN_NAMES.length]!}${c > COLUMN_NAMES.length ? c : ""}`;
      if (columns.some((existing) => existing.name === columnName)) continue;
      columns.push({
        name: columnName,
        type: spec.type,
        length: spec.length,
        precision: spec.precision,
        scale: spec.scale,
        nullable: random() > 0.45,
        defaultValue: spec.type === "bit" ? "0" : undefined,
        comment: random() > 0.6 ? `${columnName} 欄位說明` : undefined,
        primaryKey: false,
        foreignKey: false,
        unique: false,
        indexed: false,
      });
    }

    // 稽核欄位：Column Search（US6）常見的查詢目標。
    columns.push({
      name: "CreatedAt",
      type: "datetime2",
      nullable: false,
      defaultValue: "sysutcdatetime()",
      primaryKey: false,
      foreignKey: false,
      unique: false,
      indexed: false,
      comment: "建立時間",
    });

    const indexes: Index[] = [
      { name: `UX_${name}_Code`, columns: ["Code"], unique: true },
      { name: `IX_${name}_CreatedAt`, columns: ["CreatedAt"], unique: false },
    ];

    tables.push({
      id,
      schema,
      name,
      comment: `${MODULES[i % MODULES.length]!} 模組的 ${name}`,
      columns,
      indexes,
    });
  }

  const relations: Relation[] = [];
  const seenRelationNames = new Set<string>();
  const hubCount = Math.max(1, Math.round(tableCount * 0.12));

  const addRelation = (
    source: Table,
    target: Table,
    columnName: string,
    cardinality: Cardinality,
  ): void => {
    if (source.id === target.id) return;
    let relationName = `FK_${source.name}_${target.name}`;
    let suffix = 2;
    while (seenRelationNames.has(relationName)) relationName = `FK_${source.name}_${target.name}_${suffix++}`;
    seenRelationNames.add(relationName);

    if (!source.columns.some((c) => c.name === columnName)) {
      source.columns.splice(source.columns.length - 1, 0, {
        name: columnName,
        type: "bigint",
        nullable: cardinality === "1:1",
        primaryKey: false,
        foreignKey: true,
        unique: cardinality === "1:1",
        indexed: false,
        comment: `參照 ${target.id}`,
      });
      source.indexes.push({ name: `IX_${source.name}_${columnName}`, columns: [columnName], unique: false });
    }

    relations.push({
      name: relationName,
      sourceTable: source.id,
      sourceColumns: [columnName],
      targetTable: target.id,
      targetColumns: ["Id"],
      cardinality,
    });
  };

  const totalRelations = Math.round(tableCount * relationsPerTable);
  for (let r = 0; r < totalRelations; r++) {
    const source = tables[Math.floor(random() * tables.length)]!;
    // 70% 指向 hub 表，模擬真實 DB 的星狀依賴。
    const targetIndex =
      random() < 0.7 ? Math.floor(random() * hubCount) : Math.floor(random() * tables.length);
    const target = tables[targetIndex]!;
    if (source.id === target.id) continue;

    let cardinality: Cardinality = "N:1";
    if (includeExoticCardinality) {
      const roll = random();
      if (roll > 0.96) cardinality = "1:1";
      else if (roll > 0.92) cardinality = "N:M";
    }
    addRelation(source, target, `${target.name.replace(/s$/, "")}Id`, cardinality);
  }

  const schema: Schema = {
    version: SCHEMA_VERSION,
    metadata: { name: `Synthetic ${tableCount} Tables`, defaultSchema: DEFAULT_SCHEMA_NAME },
    tables,
    relations,
  };
  deriveColumnFlags(schema);
  return schema;
}

/** Stage 0 / Large Schema Test 的標準尺寸（plan §59）。 */
export const FIXTURE_SIZES = [20, 50, 100, 200] as const;
export type FixtureSize = (typeof FIXTURE_SIZES)[number];
