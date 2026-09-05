import {
  SCHEMA_VERSION,
  deriveColumnFlags,
  makeTableId,
  type Cardinality,
  type Column,
  type Index,
  type Relation,
  type Schema,
  type Table,
  type TableGroup,
} from "@schemalens/schema-core";

/**
 * 合成 Schema。
 *
 * 用途有兩個：壓測 Viewer（20 / 50 / 100 / 200 Tables），以及產生
 * examples/large-schema.schema.md 讓人工驗收 AC-20。
 *
 * 因為它會被當成「範例」看，資料必須是**語意合理**的：
 * 型別要配得上欄位名（IsActive 是 bit 而不是 nvarchar(4000)）、
 * 資料表要落在對的模組（Payment 屬於 Billing 而不是 Analytics）、
 * 備註要真的說明用途而不是「XXX 欄位說明」。
 * 一份看起來像亂碼的範例，沒辦法用來判斷 Viewer 顯示得對不對。
 *
 * 不做隨機化的部分：同一個 seed 永遠產生同一份 schema，測試才穩定。
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

interface EntitySpec {
  /** 單數英文名，例如 `Order`。 */
  name: string;
  /** 中文名，讓 Table 備註有實際意義（也順便測 CJK 寬度）。 */
  zh: string;
}

interface ModuleSpec {
  /** 群組名稱（功能模組）。 */
  name: string;
  /** 資料庫 schema 名稱。 */
  schema: string;
  description: string;
  entities: EntitySpec[];
}

/**
 * 模組與其資料表。
 *
 * 實體綁在模組底下，而不是各自獨立輪詢——
 * 否則會產生 `analytics.Payments` 這種「付款表歸在分析模組」的怪組合。
 */
const MODULES: ModuleSpec[] = [
  {
    name: "Identity",
    schema: "identity",
    description: "使用者、角色與登入",
    entities: [
      { name: "User", zh: "使用者" },
      { name: "Role", zh: "角色" },
      { name: "Permission", zh: "權限" },
      { name: "Session", zh: "登入工作階段" },
      { name: "Token", zh: "存取權杖" },
    ],
  },
  {
    name: "Catalog",
    schema: "catalog",
    description: "商品目錄與定價",
    entities: [
      { name: "Product", zh: "商品" },
      { name: "Category", zh: "分類" },
      { name: "Brand", zh: "品牌" },
      { name: "Variant", zh: "商品規格" },
      { name: "Price", zh: "價格" },
    ],
  },
  {
    name: "Sales",
    schema: "sales",
    description: "訂單與購物車",
    entities: [
      { name: "Order", zh: "訂單" },
      { name: "OrderItem", zh: "訂單明細" },
      { name: "Cart", zh: "購物車" },
      { name: "CartItem", zh: "購物車項目" },
      { name: "Coupon", zh: "折價券" },
    ],
  },
  {
    name: "Billing",
    schema: "billing",
    description: "帳務與金流",
    entities: [
      { name: "Invoice", zh: "發票" },
      { name: "Payment", zh: "付款" },
      { name: "Refund", zh: "退款" },
      { name: "Ledger", zh: "分類帳" },
      { name: "Tax", zh: "稅務設定" },
    ],
  },
  {
    name: "Shipping",
    schema: "shipping",
    description: "出貨與物流",
    entities: [
      { name: "Shipment", zh: "出貨單" },
      { name: "Address", zh: "地址" },
      { name: "Carrier", zh: "物流商" },
      { name: "Package", zh: "包裹" },
      { name: "Tracking", zh: "追蹤紀錄" },
    ],
  },
  {
    name: "Support",
    schema: "support",
    description: "客服工單",
    entities: [
      { name: "Ticket", zh: "工單" },
      { name: "Message", zh: "訊息" },
      { name: "Attachment", zh: "附件" },
      { name: "Tag", zh: "標籤" },
      { name: "Note", zh: "內部註記" },
    ],
  },
  {
    name: "Analytics",
    schema: "analytics",
    description: "事件與報表",
    entities: [
      { name: "Event", zh: "事件" },
      { name: "Metric", zh: "指標" },
      { name: "Report", zh: "報表" },
      { name: "Dashboard", zh: "儀表板" },
      { name: "Snapshot", zh: "快照" },
    ],
  },
  {
    name: "Content",
    schema: "content",
    description: "文章與版面",
    entities: [
      { name: "Post", zh: "文章" },
      { name: "Comment", zh: "留言" },
      { name: "Media", zh: "媒體檔案" },
      { name: "Page", zh: "頁面" },
      { name: "Template", zh: "版型" },
    ],
  },
  {
    name: "Inventory",
    schema: "inventory",
    description: "庫存與採購",
    entities: [
      { name: "Warehouse", zh: "倉庫" },
      { name: "Stock", zh: "庫存" },
      { name: "Transfer", zh: "調撥" },
      { name: "Supplier", zh: "供應商" },
      { name: "Purchase", zh: "採購單" },
    ],
  },
  {
    name: "Audit",
    schema: "audit",
    description: "稽核與設定",
    entities: [
      { name: "AuditLog", zh: "稽核紀錄" },
      { name: "Change", zh: "異動" },
      { name: "Approval", zh: "簽核" },
      { name: "Policy", zh: "政策" },
      { name: "Setting", zh: "設定" },
    ],
  },
];

interface ColumnSpec {
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  comment: string;
}

/**
 * 可選欄位池。
 *
 * 型別與欄位名是配好的，不是隨機挑的——
 * `IsActive bit`、`SortOrder int`、`Notes nvarchar(1000)`，
 * 而不是 `IsActive nvarchar(4000)` 這種明顯錯誤的組合。
 */
const OPTIONAL_COLUMNS: ColumnSpec[] = [
  { name: "Name", type: "nvarchar", length: 200, nullable: false, comment: "名稱" },
  { name: "Title", type: "nvarchar", length: 200, nullable: false, comment: "標題" },
  { name: "Description", type: "nvarchar", length: 4000, nullable: true, comment: "描述" },
  {
    name: "Status",
    type: "nvarchar",
    length: 20,
    nullable: false,
    defaultValue: "active",
    comment: "狀態：active / inactive",
  },
  { name: "Amount", type: "decimal", precision: 18, scale: 2, nullable: false, defaultValue: "0", comment: "金額" },
  { name: "Quantity", type: "int", nullable: false, defaultValue: "0", comment: "數量" },
  { name: "StartsAt", type: "datetime2", nullable: true, comment: "生效時間" },
  { name: "EndsAt", type: "datetime2", nullable: true, comment: "失效時間" },
  { name: "IsActive", type: "bit", nullable: false, defaultValue: "1", comment: "是否啟用" },
  { name: "ExternalId", type: "uniqueidentifier", nullable: true, comment: "外部系統識別碼" },
  { name: "Slug", type: "nvarchar", length: 120, nullable: true, comment: "網址代稱" },
  { name: "Locale", type: "nvarchar", length: 10, nullable: false, defaultValue: "zh-TW", comment: "語系" },
  { name: "SortOrder", type: "int", nullable: false, defaultValue: "0", comment: "排序順序" },
  { name: "Metadata", type: "nvarchar", length: 4000, nullable: true, comment: "附加資料（JSON）" },
  { name: "Version", type: "int", nullable: false, defaultValue: "1", comment: "版本號" },
  { name: "Notes", type: "nvarchar", length: 1000, nullable: true, comment: "備註" },
  { name: "Priority", type: "int", nullable: false, defaultValue: "0", comment: "優先順序" },
  { name: "Score", type: "decimal", precision: 9, scale: 2, nullable: true, comment: "評分" },
];

function toColumn(spec: ColumnSpec): Column {
  return {
    name: spec.name,
    type: spec.type,
    length: spec.length,
    precision: spec.precision,
    scale: spec.scale,
    nullable: spec.nullable,
    defaultValue: spec.defaultValue,
    comment: spec.comment,
    primaryKey: false,
    foreignKey: false,
    unique: false,
    indexed: false,
  };
}

function pluralize(name: string): string {
  if (name.endsWith("y")) return `${name.slice(0, -1)}ies`;
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("ch")) return `${name}es`;
  return `${name}s`;
}

export interface GenerateOptions {
  tableCount: number;
  seed?: number;
  /** 每張表的欄位數（含 PK 與稽核欄位）。 */
  minColumns?: number;
  maxColumns?: number;
  /** 每張表平均要產生幾條 FK。 */
  relationsPerTable?: number;
  /** 是否加入少量 1:1（唯一外鍵）。 */
  includeExoticCardinality?: boolean;
}

/** 第 i 張表落在哪個模組的哪個實體；輪完一輪後加上序號。 */
function tableSpecAt(index: number): { module: ModuleSpec; entity: EntitySpec; round: number } {
  const module = MODULES[index % MODULES.length]!;
  const withinModule = Math.floor(index / MODULES.length);
  const entity = module.entities[withinModule % module.entities.length]!;
  const round = Math.floor(withinModule / module.entities.length);
  return { module, entity, round };
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
    minColumns = 6,
    maxColumns = 14,
    relationsPerTable = 1.3,
    includeExoticCardinality = true,
  } = options;

  const random = rng(seed);
  const tables: Table[] = [];
  /**
   * table id → 單數名（含輪次序號），用來組 FK 欄位名。
   *
   * 從複數表名反推單數永遠有例外（Warehouses → Warehous、Categories → Categorie），
   * 建表時本來就知道單數名，直接記下來就不必猜。
   */
  const singularById = new Map<string, string>();

  for (let i = 0; i < tableCount; i++) {
    const { module, entity, round } = tableSpecAt(i);
    const base = pluralize(entity.name);
    const name = round === 0 ? base : `${base}${round + 1}`;
    const id = makeTableId(module.schema, name);
    singularById.set(id, round === 0 ? entity.name : `${entity.name}${round + 1}`);

    const columns: Column[] = [
      {
        name: "Id",
        type: "bigint",
        nullable: false,
        primaryKey: true,
        foreignKey: false,
        unique: false,
        indexed: false,
        comment: `${entity.zh}識別碼`,
      },
      {
        name: "Code",
        type: "nvarchar",
        length: 64,
        nullable: false,
        primaryKey: false,
        foreignKey: false,
        unique: true,
        indexed: false,
        comment: "業務代碼",
      },
    ];

    // 從欄位池取一段連續區間，確保同一個 seed 的結果穩定，
    // 且同一張表不會出現重複欄位。
    const target = minColumns + Math.floor(random() * (maxColumns - minColumns + 1));
    const start = Math.floor(random() * OPTIONAL_COLUMNS.length);
    for (let n = 0; columns.length < target - 1 && n < OPTIONAL_COLUMNS.length; n++) {
      const spec = OPTIONAL_COLUMNS[(start + n) % OPTIONAL_COLUMNS.length]!;
      // Name 與 Title 是同一件事的兩種叫法，同時出現在一張表上是設計異味。
      const conflicts =
        (spec.name === "Title" && columns.some((c) => c.name === "Name")) ||
        (spec.name === "Name" && columns.some((c) => c.name === "Title"));
      if (conflicts) continue;
      columns.push(toColumn(spec));
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
      schema: module.schema,
      name,
      comment: entity.zh,
      // 群組 = 功能模組，與 schema（資料庫命名空間）是不同維度。
      group: module.name,
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
    const sourceIndex = Math.floor(random() * tables.length);
    // 索引 0 是最基礎的表，不參照任何人。
    if (sourceIndex === 0) continue;

    // 只允許參照索引更小的表：FK 圖因此無環，方向也才合理
    // （使用者表不會反過來指向付款表）。前面的表同時是 hub。
    const targetIndex =
      random() < 0.7
        ? Math.floor(random() * Math.min(hubCount, sourceIndex))
        : Math.floor(random() * sourceIndex);

    const source = tables[sourceIndex]!;
    const target = tables[targetIndex]!;
    if (source.id === target.id) continue;

    // 只產生 N:1 與少量 1:1（唯一外鍵）。
    // 單一外鍵欄位表達不了 N:M——那需要中介表，
    // 硬標成 N:M 會讓範例本身變成錯誤示範。
    const cardinality: Cardinality =
      includeExoticCardinality && random() > 0.94 ? "1:1" : "N:1";
    addRelation(source, target, `${singularById.get(target.id)!}Id`, cardinality);
  }

  const usedModules = new Set(tables.map((table) => table.group!));
  const groups: TableGroup[] = MODULES.filter((module) => usedModules.has(module.name)).map(
    (module) => ({ name: module.name, description: module.description }),
  );

  const schema: Schema = {
    version: SCHEMA_VERSION,
    metadata: { name: `Synthetic ${tableCount} Tables`, defaultSchema: MODULES[0]!.schema },
    tables,
    relations,
    groups,
  };
  deriveColumnFlags(schema);
  return schema;
}

/** Stage 0 / Large Schema Test 的標準尺寸（plan §59）。 */
export const FIXTURE_SIZES = [20, 50, 100, 200] as const;
export type FixtureSize = (typeof FIXTURE_SIZES)[number];
