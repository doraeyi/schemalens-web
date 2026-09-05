import { columnRef, type Relation, type Schema, type SchemaDiagnostic, type TableId } from "@schemalens/schema-core";
import { buildGraph, getRelatedColumns, type SchemaGraph } from "@schemalens/schema-graph";
import {
  computeBounds,
  layeredLayout,
  type LayoutEngine,
  type PositionedGraph,
  type Point,
  type Rect,
} from "@schemalens/schema-layout";
import { CARD_METRICS, buildCardModels, toLayoutNodes, type CardModel } from "./cardModel.js";
import { groupBorderColor, groupColor, groupTintColor } from "./groupColor.js";
import { stringsFor, type Locale, type RendererStrings } from "./i18n.js";
import {
  describeRelation,
  renderEdge,
  routeRelation,
  updateEdgeGeometry,
  type EdgeElements,
} from "./relationRenderer.js";
import { RENDERER_CSS } from "./styles.js";
import { renderCard, type CardElements } from "./tableRenderer.js";
import { DEFAULT_VIEW_STATE, type ViewState } from "./viewState.js";
import { resolveVisibility } from "./visibility.js";

export interface RendererEvents {
  /** 單擊 Table：Focus。 */
  tableSelected(tableId: TableId): void;
  /** 單擊欄位：欄位級聚焦；null 代表取消。 */
  columnSelected(target: { tableId: TableId; column: string } | null): void;
  /** 雙擊 Table / Column：回跳 DSL Source（US9）。 */
  openSource(target: { tableId: TableId; column?: string }): void;
  relationSelected(relation: Relation): void;
  /** 使用者拖曳過卡片，版面已偏離 Auto Layout。 */
  layoutChanged(): void;
  /** 使用者在卡片上按了展開 / 摺疊。 */
  viewStateChanged(state: ViewState): void;
  diagnosticSelected(diagnostic: SchemaDiagnostic): void;
}

export interface RendererOptions {
  layoutEngine?: LayoutEngine;
  events?: Partial<RendererEvents>;
  /** 介面語系；Extension 端依設定決定後傳進來。 */
  locale?: Locale;
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 2.5;

/**
 * 群組外框的邊距與標題高度。
 *
 * 同一組數值同時交給 Layout（保留空間）與 Renderer（畫外框），
 * 分開寫就會漂移，外框會壓到卡片。
 */
const GROUP_BOX = { padding: 28, headerHeight: 46 } as const;

/**
 * DBSchema Renderer。
 *
 * Technical Spike 結論：**DOM 卡片 + 單一 SVG Edge Overlay + CSS transform 視口**。
 * 理由見 docs/stage-0-spike.md。這裡完全不依賴 VS Code API（約束 #6），
 * 也不自己做 traversal（約束 #7）；layout 走 LayoutEngine 介面（約束 #8）。
 */
export class SchemaRenderer {
  private readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly edgeLayer: SVGSVGElement;
  private readonly groupLayer: HTMLElement;
  private readonly nodeLayer: HTMLElement;
  private readonly errorLayer: HTMLElement;
  private readonly layoutEngine: LayoutEngine;
  private readonly events: Partial<RendererEvents>;
  private strings: RendererStrings;

  private schema: Schema | null = null;
  private graph: SchemaGraph | null = null;
  private state: ViewState = DEFAULT_VIEW_STATE;
  private cards: Map<TableId, CardModel> = new Map();
  private positioned: PositionedGraph | null = null;
  private cardElements = new Map<TableId, CardElements>();
  private edgeElements = new Map<string, { elements: EdgeElements; relation: Relation }>();
  private edgesByTable = new Map<TableId, string[]>();
  private groupElements = new Map<string, HTMLElement>();
  private groupMembers = new Map<string, TableId[]>();
  /** 使用者手動拖曳過的卡片位置，覆寫 Auto Layout 的結果。 */
  private manualPositions = new Map<TableId, Point>();
  private selectedRelation: string | null = null;

  private tx = 0;
  private ty = 0;
  private scale = 1;

  constructor(host: HTMLElement, options: RendererOptions = {}) {
    this.host = host;
    this.layoutEngine = options.layoutEngine ?? layeredLayout;
    this.events = options.events ?? {};
    this.strings = stringsFor(options.locale);

    const style = document.createElement("style");
    style.textContent = RENDERER_CSS;
    host.append(style);

    this.root = document.createElement("div");
    this.root.className = "dbs-root";

    this.viewport = document.createElement("div");
    this.viewport.className = "dbs-viewport";

    this.edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.edgeLayer.setAttribute("class", "dbs-edges");

    this.groupLayer = document.createElement("div");
    this.groupLayer.className = "dbs-groups";

    this.nodeLayer = document.createElement("div");
    this.nodeLayer.className = "dbs-nodes";

    this.errorLayer = document.createElement("div");
    this.errorLayer.className = "dbs-error";
    this.errorLayer.hidden = true;

    this.viewport.append(this.groupLayer, this.edgeLayer, this.nodeLayer);
    this.root.append(this.viewport);
    host.append(this.root, this.errorLayer);

    this.bindPointerEvents();
  }

  // ---------------------------------------------------------------- 資料輸入

  setSchema(schema: Schema): void {
    this.schema = schema;
    this.graph = buildGraph(schema);
    this.rebuild();
    this.fitView();
  }

  getViewState(): ViewState {
    return this.state;
  }

  /**
   * 切換介面語系。
   * 卡片內的 "+N more" 也會跟著換，所以要重建；純 class 切換不夠。
   */
  setLocale(locale: Locale): void {
    this.strings = stringsFor(locale);
    if (this.schema) this.rebuild();
  }

  getStrings(): RendererStrings {
    return this.strings;
  }

  /**
   * 更新檢視狀態。
   *
   * 只有會改變卡片幾何的欄位（detailLevel / collapsed）需要重排版；
   * Focus / Dim / Hide / Search 只切 class，因此 100+ Table 也不會卡。
   */
  setViewState(patch: Partial<ViewState>): void {
    const previous = this.state;
    this.state = { ...previous, ...patch };
    const layoutModeChanged =
      patch.layoutMode !== undefined && patch.layoutMode !== previous.layoutMode;
    // 換排版依據等於整張圖重新擺過，先前手動拖曳的位置已經沒有意義，
    // 留著只會讓卡片停在奇怪的地方甚至互相重疊。
    if (layoutModeChanged) this.manualPositions.clear();

    const geometryChanged =
      layoutModeChanged ||
      (patch.detailLevel !== undefined && patch.detailLevel !== previous.detailLevel) ||
      (patch.expandComments !== undefined && patch.expandComments !== previous.expandComments);
    const collapseChanged = patch.collapsed !== undefined && patch.collapsed !== previous.collapsed;

    if (geometryChanged || collapseChanged) {
      this.rebuild();
      if (layoutModeChanged) this.fitView();
    } else {
      this.applyEmphasis();
    }
  }

  /**
   * 顯示驗證錯誤，但**不清空畫面**（US10：DSL 有錯不得讓 Preview 變白或 crash）。
   */
  setDiagnostics(diagnostics: readonly SchemaDiagnostic[]): void {
    this.errorLayer.replaceChildren();
    if (diagnostics.length === 0) {
      this.errorLayer.hidden = true;
      return;
    }
    const title = document.createElement("div");
    title.textContent = this.strings.diagnosticsTitle(diagnostics.length);
    title.style.fontWeight = "600";
    this.errorLayer.append(title);

    for (const diagnostic of diagnostics.slice(0, 20)) {
      const item = document.createElement("div");
      item.className = "dbs-error-item";
      const loc = diagnostic.location ? `:${diagnostic.location.line}:${diagnostic.location.column}` : "";
      item.textContent = `${diagnostic.code}${loc} — ${diagnostic.message}`;
      item.addEventListener("click", () => this.events.diagnosticSelected?.(diagnostic));
      this.errorLayer.append(item);
    }
    this.errorLayer.hidden = false;
  }

  // ---------------------------------------------------------------- 探索操作

  focusTable(tableId: TableId, patch: Partial<ViewState["focus"]> = {}): void {
    this.setViewState({ focus: { ...this.state.focus, ...patch, tableId } });
    this.centerOn(tableId);
  }

  /** Column Search 命中後的 Jump + Highlight + Focus（US6）。 */
  revealColumn(tableId: TableId, column: string): void {
    this.setViewState({
      focus: { ...this.state.focus, tableId },
      highlightedColumn: { tableId, column },
      searchMatches: new Set([tableId]),
    });
    this.centerOn(tableId);
  }

  setSearchMatches(tableIds: readonly TableId[]): void {
    this.setViewState({ searchMatches: new Set(tableIds) });
  }

  /**
   * 聚焦單一欄位：只亮起它與透過 FK 對應到的欄位。
   *
   * 這回答的是「這個欄位跟誰有關」，與 Table Focus（這張表跟誰有關）不同層級，
   * 因此兩者可以同時存在。
   */
  focusColumn(tableId: TableId, column: string): void {
    this.setViewState({ columnFocus: { tableId, column } });
  }

  clearColumnFocus(): void {
    if (!this.state.columnFocus) return;
    this.setViewState({ columnFocus: null });
  }

  /** 目前欄位聚焦所涵蓋的欄位（含起點）；沒有聚焦時為空集合。 */
  getFocusedColumns(): ReadonlySet<string> {
    if (!this.schema || !this.graph || !this.state.columnFocus) return new Set();
    const { tableId, column } = this.state.columnFocus;
    return getRelatedColumns(this.schema, this.graph, tableId, column).columns;
  }

  // ---------------------------------------------------------------- 視口操作

  fitView(padding = 40): void {
    if (!this.positioned || this.positioned.nodes.length === 0) return;
    const { width, height } = this.host.getBoundingClientRect();
    const bounds = this.positioned.bounds;
    if (width === 0 || height === 0 || bounds.width === 0 || bounds.height === 0) return;

    const scale = Math.min(
      (width - padding * 2) / bounds.width,
      (height - padding * 2) / bounds.height,
    );
    this.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    this.tx = (width - bounds.width * this.scale) / 2 - bounds.x * this.scale;
    this.ty = (height - bounds.height * this.scale) / 2 - bounds.y * this.scale;
    this.applyTransform();
  }

  resetView(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  }

  zoomBy(factor: number, anchor?: { x: number; y: number }): void {
    const rect = this.host.getBoundingClientRect();
    const point = anchor ?? { x: rect.width / 2, y: rect.height / 2 };
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    // 以 anchor 為不動點縮放，游標下的內容不會亂跑。
    this.tx = point.x - ((point.x - this.tx) / this.scale) * next;
    this.ty = point.y - ((point.y - this.ty) / this.scale) * next;
    this.scale = next;
    this.applyTransform();
  }

  /** 把某張表移到畫面中央；縮太小時自動放大到看得清欄位的程度。 */
  centerOn(tableId: TableId, minScale = 0.6): void {
    const node = this.positioned?.positionById.get(tableId);
    if (!node) return;
    const rect = this.host.getBoundingClientRect();
    if (this.scale < minScale) this.scale = minScale;
    this.tx = rect.width / 2 - (node.x + node.width / 2) * this.scale;
    this.ty = rect.height / 2 - (node.y + node.height / 2) * this.scale;
    this.applyTransform();
  }

  /** 是否有手動調整過的位置，供 Toolbar 決定要不要顯示「還原版面」。 */
  hasManualPositions(): boolean {
    return this.manualPositions.size > 0;
  }

  /** 丟掉所有手動位置，回到 Auto Layout 的結果。 */
  resetLayout(): void {
    if (this.manualPositions.size === 0) return;
    this.manualPositions.clear();
    this.rebuild();
    this.fitView();
  }

  dispose(): void {
    this.root.remove();
    this.errorLayer.remove();
  }

  // ---------------------------------------------------------------- 內部繪製

  /** 幾何有變才做：重算卡片模型 → Layout → 重建 DOM。 */
  private rebuild(): void {
    if (!this.schema || !this.graph) return;
    this.cards = buildCardModels(this.schema, this.state);
    this.positioned = this.layoutEngine.layout(
      {
        nodes: toLayoutNodes(this.cards),
        edges: this.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      },
      {
        clusterByGroup: this.state.layoutMode === "group",
        groupPadding: GROUP_BOX.padding,
        groupHeaderHeight: GROUP_BOX.headerHeight,
      },
    );
    this.applyManualPositions();
    this.renderGroupBoxes();
    this.renderNodes();

    // 估算只是起點；實際寬度取決於使用者的字型，量到之後要重排一次，
    // 否則卡片會太窄而把欄位名稱或型別截掉。
    if (this.measureCardWidths()) {
      this.positioned = this.layoutEngine.layout(
        {
          nodes: toLayoutNodes(this.cards),
          edges: this.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        },
        {
        clusterByGroup: this.state.layoutMode === "group",
        groupPadding: GROUP_BOX.padding,
        groupHeaderHeight: GROUP_BOX.headerHeight,
      },
      );
      this.applyManualPositions();
      this.repositionNodes();
      this.renderGroupBoxes();
    }

    this.renderEdges();
    this.applyEmphasis();
  }

  /**
   * 量測卡片實際需要的寬度，並回寫到 CardModel。
   *
   * 規則：**欄位名稱與型別永遠不截斷**，只有備註可以。
   * 因此先量「不含備註」的必要寬度當下限，再讓備註使用剩餘空間，
   * 上限是 maxWidth——除非必要寬度本身就超過它。
   *
   * 讀寫分批進行，避免每張卡片各觸發一次 reflow（200 張表時差很多）。
   * 回傳是否有任何寬度改變。
   */
  private measureCardWidths(): boolean {
    const entries = [...this.cardElements];
    if (entries.length === 0) return false;

    // 沒有版面計算的環境（例如 jsdom 測試）量不到東西，維持估算值。
    if (entries[0]![1].root.offsetWidth === 0) return false;

    const { minWidth, maxWidth } = CARD_METRICS;

    // 寫入：先切成「內容自然寬度」且暫時隱藏備註。
    for (const [, elements] of entries) {
      elements.root.style.width = "max-content";
      elements.root.classList.add("is-measuring-essential");
    }
    // 讀取：不含備註的必要寬度。
    const essential = entries.map(([, elements]) => elements.root.offsetWidth);

    // 寫入：放回備註。
    for (const [, elements] of entries) elements.root.classList.remove("is-measuring-essential");
    // 讀取：含備註的自然寬度。
    const natural = entries.map(([, elements]) => elements.root.offsetWidth);

    let changed = false;
    entries.forEach(([tableId, elements], index) => {
      const need = Math.max(essential[index]!, minWidth);
      // 備註可以被截斷，但不能讓卡片窄到連欄位名稱都放不下。
      const width = Math.round(Math.max(need, Math.min(natural[index]!, Math.max(maxWidth, need))));

      elements.root.style.width = `${width}px`;
      const card = this.cards.get(tableId);
      if (card && card.width !== width) {
        card.width = width;
        changed = true;
      }
    });

    return changed;
  }

  /**
   * 畫群組外框。
   *
   * 外框是獨立圖層且疊在卡片之下，只負責圈出範圍：
   * 邊線與底色都取群組色，底色透明度極低。
   * 卡片自己有不透明背景，所以底色只會出現在卡片之間的縫隙。
   * 先前試過點陣底紋，但 10 個群組同時出現時整片畫面都是點，反而更難讀。
   */
  private renderGroupBoxes(): void {
    this.groupElements.clear();
    this.groupMembers.clear();
    if (!this.positioned || !this.schema) {
      this.groupLayer.replaceChildren();
      return;
    }

    for (const table of this.schema.tables) {
      if (!table.group) continue;
      const list = this.groupMembers.get(table.group);
      if (list) list.push(table.id);
      else this.groupMembers.set(table.group, [table.id]);
    }

    const fragment = document.createDocumentFragment();
    for (const [group, rect] of this.positioned.groupBounds) {
      const box = document.createElement("div");
      box.className = "dbs-group-box";
      box.dataset.group = group;
      box.style.borderColor = groupBorderColor(group);
      box.style.backgroundColor = groupTintColor(group);

      const label = document.createElement("div");
      label.className = "dbs-group-box-label";
      label.style.color = groupColor(group);
      label.style.borderColor = groupBorderColor(group);
      label.textContent = group;

      const description = this.schema.groups?.find((g) => g.name === group)?.description;
      if (description) {
        const hint = document.createElement("span");
        hint.className = "dbs-group-box-desc";
        hint.textContent = description;
        label.append(hint);
      }

      box.append(label);
      this.groupElements.set(group, box);
      fragment.append(box);
      this.placeGroupBox(group, rect);
    }
    this.groupLayer.replaceChildren(fragment);
  }

  private placeGroupBox(group: string, rect: Rect): void {
    const box = this.groupElements.get(group);
    if (!box) return;
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  /**
   * 依成員目前的位置重算某個群組的外框。
   * 拖曳卡片後外框要跟著長大，否則卡片會跑到框外。
   */
  private refreshGroupBox(group: string): void {
    const members = this.groupMembers.get(group);
    if (!members || !this.positioned) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of members) {
      const node = this.positioned.positionById.get(id);
      if (!node) continue;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    if (!Number.isFinite(minX)) return;

    this.placeGroupBox(group, {
      x: minX - GROUP_BOX.padding,
      y: minY - GROUP_BOX.headerHeight,
      width: maxX - minX + GROUP_BOX.padding * 2,
      height: maxY - minY + GROUP_BOX.headerHeight + GROUP_BOX.padding,
    });
  }

  /** 重排後只更新位置，不重建 DOM。 */
  private repositionNodes(): void {
    if (!this.positioned) return;
    for (const [tableId, elements] of this.cardElements) {
      const node = this.positioned.positionById.get(tableId);
      if (!node) continue;
      elements.root.style.left = `${node.x}px`;
      elements.root.style.top = `${node.y}px`;
    }
  }

  private renderNodes(): void {
    if (!this.schema || !this.positioned) return;
    // 一次性換掉整層，避免逐張 diff 造成多次 reflow。
    const fragment = document.createDocumentFragment();
    this.cardElements.clear();
    for (const table of this.schema.tables) {
      const card = this.cards.get(table.id);
      const position = this.positioned.positionById.get(table.id);
      if (!card || !position) continue;
      const elements = renderCard(card, position, this.strings);
      this.cardElements.set(table.id, elements);
      fragment.append(elements.root);
    }
    this.nodeLayer.replaceChildren(fragment);
  }

  private renderEdges(): void {
    if (!this.schema || !this.positioned) return;
    const bounds = this.positioned.bounds;
    this.edgeLayer.setAttribute("width", String(Math.max(1, bounds.x + bounds.width)));
    this.edgeLayer.setAttribute("height", String(Math.max(1, bounds.y + bounds.height)));

    const fragment = document.createDocumentFragment();
    this.edgeElements.clear();
    this.edgesByTable.clear();
    for (const relation of this.schema.relations) {
      const routed = routeRelation(relation, this.cards, this.positioned.positionById);
      if (!routed) continue;
      const elements = renderEdge(relation, routed);
      const root = elements.root;
      root.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectedRelation = relation.name;
        this.events.relationSelected?.(relation);
        this.applyEmphasis();
      });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = describeRelation(relation);
      root.append(title);
      this.edgeElements.set(relation.name, { elements, relation });

      // 拖曳時只需要更新相鄰的線，先建好索引。
      for (const tableId of [relation.sourceTable, relation.targetTable]) {
        const list = this.edgesByTable.get(tableId);
        if (list) list.push(relation.name);
        else this.edgesByTable.set(tableId, [relation.name]);
      }
      fragment.append(root);
    }
    this.edgeLayer.replaceChildren(fragment);
  }

  /** 只切 class，不動幾何 —— Focus / Dim / Hide 在大型 schema 也維持即時。 */
  private applyEmphasis(): void {
    if (!this.graph) return;
    const visibility = resolveVisibility(this.graph, this.state, this.schema ?? undefined);
    const highlight = this.state.highlightedColumn;

    const columnFocus = this.state.columnFocus;
    const focused =
      columnFocus && this.schema
        ? getRelatedColumns(this.schema, this.graph, columnFocus.tableId, columnFocus.column)
        : null;
    const focusedColumns = focused?.columns ?? new Set<string>();
    const rootRef = columnFocus ? columnRef(columnFocus.tableId, columnFocus.column) : "";

    for (const [tableId, elements] of this.cardElements) {
      const emphasis = visibility.tables.get(tableId) ?? "active";
      const root = elements.root;

      // 淡化／隱藏是一個軸（透明度與顯示），邊框強調是另一個軸。
      root.classList.toggle("is-dimmed", emphasis === "dimmed");
      root.classList.toggle("is-hidden", emphasis === "hidden");
      root.classList.toggle("is-filtered-out", emphasis === "filtered");

      // 邊框同一時間只能由一個狀態擁有。
      // 先前 is-selected / is-column-participant / is-search-match 各自設 border 與
      // box-shadow，同時成立時互相蓋掉，卡片看起來就會前後不一致。
      const owner =
        emphasis === "selected"
          ? "selected"
          : (focused?.tables.has(tableId) ?? false)
            ? "participant"
            : emphasis === "related"
              ? "related"
              : null;
      root.classList.toggle("is-selected", owner === "selected");
      root.classList.toggle("is-column-participant", owner === "participant");
      root.classList.toggle("is-related", owner === "related");

      // 搜尋命中改用 outline，與邊框不同屬性，才能和上面三種並存。
      root.classList.toggle("is-search-match", this.state.searchMatches.has(tableId));

      for (const [column, rowEl] of elements.rowByColumn) {
        rowEl.classList.toggle(
          "is-highlight",
          highlight !== null && highlight.tableId === tableId && highlight.column === column,
        );

        if (!columnFocus) {
          rowEl.classList.remove("is-column-focus", "is-column-related", "is-column-muted");
          continue;
        }
        const ref = columnRef(tableId, column);
        const isRoot = ref === rootRef;
        const isRelated = !isRoot && focusedColumns.has(ref);
        rowEl.classList.toggle("is-column-focus", isRoot);
        rowEl.classList.toggle("is-column-related", isRelated);
        // 其餘欄位就是雜訊。
        rowEl.classList.toggle("is-column-muted", !isRoot && !isRelated);
      }
    }

    // 有聚焦時線才浮到卡片之上——此時無關的線已被淡化，不會蓋住內容。
    this.edgeLayer.classList.toggle(
      "is-above",
      this.state.focus.tableId !== null || this.state.columnFocus !== null,
    );

    for (const [group, box] of this.groupElements) {
      const filtered = this.state.groupFilter !== null && this.state.groupFilter !== group;
      box.classList.toggle("is-filtered-out", filtered);
    }

    for (const [relationName, edge] of this.edgeElements) {
      let emphasis = visibility.edges.get(relationName) ?? "normal";
      // 欄位聚焦時，沒有參與這組欄位的線一律降噪——
      // 否則一堆無關的線仍然橫在畫面上，等於沒聚焦。
      if (focused && emphasis !== "hidden" && emphasis !== "filtered") {
        emphasis = focused.relations.has(relationName) ? "highlight" : "dimmed";
      }
      const root = edge.elements.root;
      root.classList.toggle("is-highlight", emphasis === "highlight");
      root.classList.toggle("is-dimmed", emphasis === "dimmed");
      root.classList.toggle("is-hidden", emphasis === "hidden");
      root.classList.toggle("is-filtered-out", emphasis === "filtered");
      root.classList.toggle("is-selected", this.selectedRelation === relationName);
    }
  }

  /**
   * 套用使用者拖曳過的位置。
   *
   * Auto Layout 仍然是每次重排的基礎（切換檢視層級、Collapse 都會重排），
   * 手動位置只是覆寫在上面，因此「一開始用預設版面、之後自己微調」兩者不衝突。
   */
  private applyManualPositions(): void {
    if (!this.positioned || this.manualPositions.size === 0) return;
    for (const [tableId, point] of this.manualPositions) {
      const node = this.positioned.positionById.get(tableId);
      if (!node) continue;
      node.x = point.x;
      node.y = point.y;
    }
    this.positioned = {
      ...this.positioned,
      bounds: computeBounds(this.positioned.nodes),
    };
  }

  /** 把某張卡片移到新的圖座標，並即時更新相鄰的關聯線。 */
  private moveCard(tableId: TableId, x: number, y: number): void {
    const node = this.positioned?.positionById.get(tableId);
    const card = this.cardElements.get(tableId);
    if (!node || !card) return;

    node.x = x;
    node.y = y;
    this.manualPositions.set(tableId, { x, y });
    card.root.style.left = `${x}px`;
    card.root.style.top = `${y}px`;

    const group = this.cards.get(tableId)?.group;
    if (group) this.refreshGroupBox(group);

    // 只重算這張表相鄰的線；整層重建在 200 張表時會掉幀。
    for (const relationName of this.edgesByTable.get(tableId) ?? []) {
      const edge = this.edgeElements.get(relationName);
      if (!edge || !this.positioned) continue;
      const routed = routeRelation(edge.relation, this.cards, this.positioned.positionById);
      if (routed) updateEdgeGeometry(edge.elements, edge.relation, routed);
    }
  }

  private applyTransform(): void {
    this.viewport.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  // ---------------------------------------------------------------- 互動

  private bindPointerEvents(): void {
    let panning = false;
    let panMoved = false;
    let panPointerId: number | null = null;
    let panStartX = 0;
    let panStartY = 0;
    let lastX = 0;
    let lastY = 0;

    // 拖曳卡片：調整檢視版面用，不會改動 Schema
    // （與約束 #5 禁止的 Drag & Drop Schema Editor 是兩回事）。
    let dragTableId: TableId | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragMoved = false;
    let dragPointerId: number | null = null;
    /** 拖曳後要吃掉隨之而來的 click，否則放開手就會誤觸 Focus。 */
    let suppressClick = false;

    const DRAG_THRESHOLD = 4;

    this.root.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const card = (event.target as HTMLElement).closest<HTMLElement>(".dbs-card");
      // 被淡化的表（Focus 之外、或被群組篩掉）不給拖：
      // 它們是背景資訊，使用者在密集畫面上很容易誤拉到。
      // 但**不能就此中止**——聚焦時淡化的卡片佔了大半畫面，
      // 中止的話那一大片就變成連視窗都平移不了的死區，所以往下走 pan。
      const draggableCard =
        card &&
        !card.classList.contains("is-dimmed") &&
        !card.classList.contains("is-filtered-out")
          ? card
          : null;

      if (card) {
        // 摺疊鈕與 "+N more" 有自己的行為，既不拖卡片也不平移。
        if ((event.target as HTMLElement).closest("[data-action]")) return;
      }

      if (draggableCard) {
        const tableId = draggableCard.dataset.tableId!;
        const node = this.positioned?.positionById.get(tableId);
        if (node) {
          dragTableId = tableId;
          dragStartX = event.clientX;
          dragStartY = event.clientY;
          dragOriginX = node.x;
          dragOriginY = node.y;
          dragMoved = false;
          dragPointerId = event.pointerId;
          // 這裡**不能**立刻 setPointerCapture：指標被捕捉後，瀏覽器會把後續的
          // click 重新指向捕捉元素，卡片的 click 就再也收不到，Focus / Dim / Hide
          // 會整組失效。等真的開始拖曳（超過門檻）再捕捉。
          return;
        }
      }

      panning = true;
      panMoved = false;
      panPointerId = event.pointerId;
      panStartX = event.clientX;
      panStartY = event.clientY;
      lastX = event.clientX;
      lastY = event.clientY;
      // 同樣延後捕捉：從淡化卡片起手的單純點擊仍要能把焦點移過去。
    });

    this.root.addEventListener("pointermove", (event) => {
      if (dragTableId) {
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        if (!dragMoved) {
          dragMoved = true;
          this.cardElements.get(dragTableId)?.root.classList.add("is-dragging");
          // 真的在拖了才捕捉，這樣指標移出視窗也還能繼續拖。
          if (dragPointerId !== null) this.root.setPointerCapture?.(dragPointerId);
        }
        // 螢幕位移換算回圖座標，縮放後拖曳才會跟手。
        this.moveCard(dragTableId, dragOriginX + dx / this.scale, dragOriginY + dy / this.scale);
        return;
      }

      if (!panning) return;

      if (!panMoved) {
        const moved = Math.hypot(event.clientX - panStartX, event.clientY - panStartY);
        if (moved < DRAG_THRESHOLD) return;
        panMoved = true;
        this.root.classList.add("is-panning");
        if (panPointerId !== null) this.root.setPointerCapture?.(panPointerId);
      }

      this.tx += event.clientX - lastX;
      this.ty += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      this.applyTransform();
    });

    const endPointer = (event: PointerEvent): void => {
      if (dragTableId) {
        this.cardElements.get(dragTableId)?.root.classList.remove("is-dragging");
        suppressClick = dragMoved;
        if (dragMoved) {
          this.events.layoutChanged?.();
          // 只有拖曳時才捕捉過，因此也只在這時釋放。
          this.root.releasePointerCapture?.(event.pointerId);
        }
        dragTableId = null;
        dragMoved = false;
        dragPointerId = null;
        return;
      }
      if (!panning) return;
      panning = false;
      this.root.classList.remove("is-panning");
      if (panMoved) {
        // 平移過就吃掉隨後的 click，否則從淡化卡片起手平移，
        // 放開手會誤把焦點跳過去。
        suppressClick = true;
        this.root.releasePointerCapture?.(event.pointerId);
      }
      panMoved = false;
      panPointerId = null;
    };
    this.root.addEventListener("pointerup", endPointer);
    this.root.addEventListener("pointercancel", endPointer);

    // 在捕捉階段吃掉拖曳後的 click，避免傳到卡片的 Focus 處理。
    this.root.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.stopPropagation();
      },
      true,
    );

    this.root.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = this.host.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (event.ctrlKey || event.metaKey) {
          this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, anchor);
        } else {
          // 無修飾鍵時捲動 = 平移，符合看大圖的直覺。
          this.tx -= event.deltaX;
          this.ty -= event.deltaY;
          this.applyTransform();
        }
      },
      { passive: false },
    );

    this.root.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const card = target.closest<HTMLElement>(".dbs-card");
      if (!card) {
        this.selectedRelation = null;
        return;
      }
      const tableId = card.dataset.tableId!;

      if (target.closest('[data-action="toggle-collapse"]')) {
        const collapsed = new Set(this.state.collapsed);
        if (collapsed.has(tableId)) collapsed.delete(tableId);
        else collapsed.add(tableId);
        this.setViewState({ collapsed });
        this.events.viewStateChanged?.(this.state);
        return;
      }
      if (target.closest('[data-action="expand-detail"]')) {
        this.setViewState({ detailLevel: "full" });
        this.events.viewStateChanged?.(this.state);
        return;
      }

      // 點在欄位上 → 欄位級聚焦；點在標題上 → 只做 table 級聚焦。
      const column = target.closest<HTMLElement>(".dbs-row")?.dataset.column;
      if (column) {
        // 再點同一個欄位就取消，不必特地去按 Reset。
        const current = this.state.columnFocus;
        const same = current?.tableId === tableId && current.column === column;
        if (same) {
          this.clearColumnFocus();
          this.events.columnSelected?.(null);
        } else {
          this.focusColumn(tableId, column);
          this.events.columnSelected?.({ tableId, column });
        }
        return;
      }

      this.clearColumnFocus();
      this.events.columnSelected?.(null);
      this.focusTable(tableId);
      this.events.tableSelected?.(tableId);
    });

    this.root.addEventListener("dblclick", (event) => {
      const target = event.target as HTMLElement;
      const card = target.closest<HTMLElement>(".dbs-card");
      if (!card) return;
      const column = target.closest<HTMLElement>(".dbs-row")?.dataset.column;
      this.events.openSource?.({ tableId: card.dataset.tableId!, column });
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
