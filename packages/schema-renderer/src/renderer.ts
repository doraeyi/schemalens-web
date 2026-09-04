import type { Relation, Schema, SchemaDiagnostic, TableId } from "@schemalens/schema-core";
import { buildGraph, type SchemaGraph } from "@schemalens/schema-graph";
import {
  layeredLayout,
  type LayoutEngine,
  type PositionedGraph,
} from "@schemalens/schema-layout";
import { buildCardModels, toLayoutNodes, type CardModel } from "./cardModel.js";
import { stringsFor, type Locale, type RendererStrings } from "./i18n.js";
import { describeRelation, renderEdge, routeRelation } from "./relationRenderer.js";
import { RENDERER_CSS } from "./styles.js";
import { renderCard, type CardElements } from "./tableRenderer.js";
import { DEFAULT_VIEW_STATE, type ViewState } from "./viewState.js";
import { resolveVisibility } from "./visibility.js";

export interface RendererEvents {
  /** 單擊 Table：Focus。 */
  tableSelected(tableId: TableId): void;
  /** 雙擊 Table / Column：回跳 DSL Source（US9）。 */
  openSource(target: { tableId: TableId; column?: string }): void;
  relationSelected(relation: Relation): void;
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
  private edgeElements = new Map<string, SVGGElement>();
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

    this.nodeLayer = document.createElement("div");
    this.nodeLayer.className = "dbs-nodes";

    this.errorLayer = document.createElement("div");
    this.errorLayer.className = "dbs-error";
    this.errorLayer.hidden = true;

    this.viewport.append(this.edgeLayer, this.nodeLayer);
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
    const geometryChanged =
      patch.detailLevel !== undefined && patch.detailLevel !== previous.detailLevel;
    const collapseChanged = patch.collapsed !== undefined && patch.collapsed !== previous.collapsed;

    if (geometryChanged || collapseChanged) this.rebuild();
    else this.applyEmphasis();
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

  dispose(): void {
    this.root.remove();
    this.errorLayer.remove();
  }

  // ---------------------------------------------------------------- 內部繪製

  /** 幾何有變才做：重算卡片模型 → Layout → 重建 DOM。 */
  private rebuild(): void {
    if (!this.schema || !this.graph) return;
    this.cards = buildCardModels(this.schema, this.state);
    this.positioned = this.layoutEngine.layout({
      nodes: toLayoutNodes(this.cards),
      edges: this.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    });
    this.renderNodes();
    this.renderEdges();
    this.applyEmphasis();
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
    for (const relation of this.schema.relations) {
      const routed = routeRelation(relation, this.cards, this.positioned.positionById);
      if (!routed) continue;
      const { root } = renderEdge(relation, routed);
      root.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectedRelation = relation.name;
        this.events.relationSelected?.(relation);
        this.applyEmphasis();
      });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = describeRelation(relation);
      root.append(title);
      this.edgeElements.set(relation.name, root);
      fragment.append(root);
    }
    this.edgeLayer.replaceChildren(fragment);
  }

  /** 只切 class，不動幾何 —— Focus / Dim / Hide 在大型 schema 也維持即時。 */
  private applyEmphasis(): void {
    if (!this.graph) return;
    const visibility = resolveVisibility(this.graph, this.state);
    const highlight = this.state.highlightedColumn;

    for (const [tableId, elements] of this.cardElements) {
      const emphasis = visibility.tables.get(tableId) ?? "active";
      const root = elements.root;
      root.classList.toggle("is-selected", emphasis === "selected");
      root.classList.toggle("is-dimmed", emphasis === "dimmed");
      root.classList.toggle("is-hidden", emphasis === "hidden");
      root.classList.toggle("is-search-match", this.state.searchMatches.has(tableId));

      for (const [column, rowEl] of elements.rowByColumn) {
        rowEl.classList.toggle(
          "is-highlight",
          highlight !== null && highlight.tableId === tableId && highlight.column === column,
        );
      }
    }

    for (const [relationName, edgeEl] of this.edgeElements) {
      const emphasis = visibility.edges.get(relationName) ?? "normal";
      edgeEl.classList.toggle("is-highlight", emphasis === "highlight");
      edgeEl.classList.toggle("is-dimmed", emphasis === "dimmed");
      edgeEl.classList.toggle("is-hidden", emphasis === "hidden");
      edgeEl.classList.toggle("is-selected", this.selectedRelation === relationName);
    }
  }

  private applyTransform(): void {
    this.viewport.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  // ---------------------------------------------------------------- 互動

  private bindPointerEvents(): void {
    let panning = false;
    let lastX = 0;
    let lastY = 0;

    this.root.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest(".dbs-card")) return;
      panning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      this.root.classList.add("is-panning");
      this.root.setPointerCapture(event.pointerId);
    });
    this.root.addEventListener("pointermove", (event) => {
      if (!panning) return;
      this.tx += event.clientX - lastX;
      this.ty += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      this.applyTransform();
    });
    const endPan = (event: PointerEvent): void => {
      if (!panning) return;
      panning = false;
      this.root.classList.remove("is-panning");
      this.root.releasePointerCapture(event.pointerId);
    };
    this.root.addEventListener("pointerup", endPan);
    this.root.addEventListener("pointercancel", endPan);

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
