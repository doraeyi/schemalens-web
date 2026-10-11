import { groupNames, type Schema } from "@schemalens/schema-core";
import { search, type SearchHit } from "@schemalens/schema-graph";
import type {
  DetailLevel,
  LayoutMode,
  Locale,
  RendererStrings,
  UnrelatedMode,
} from "@schemalens/schema-renderer";
import type { TraversalDirection } from "@schemalens/schema-graph";

/**
 * 跟網頁版（apps/web/src/app.css 的 .sl-chip / .sl-button）同一套元件造型：
 * 膠囊形的切換鈕、選中是淡色底＋強調色字、聚焦後才出現的進階設定。
 * 顏色一律吃 VS Code 主題變數，這樣在任何佈景主題下都自然；網頁版則用自己的色票。
 */
export const TOOLBAR_CSS = `
.dbs-toolbar {
  --dbs-accent: var(--vscode-textLink-foreground, var(--vscode-focusBorder, #3794ff));
  --dbs-line: var(--vscode-widget-border, var(--vscode-panel-border, #3c3c3c));
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 12px;
  background: var(--vscode-editorWidget-background, #252526);
  border-bottom: 1px solid var(--dbs-line);
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  font-size: 12px;
  color: var(--vscode-editor-foreground, #d4d4d4);
}
.dbs-group { display: flex; flex: none; align-items: center; gap: 4px; }
.dbs-group-label { margin-right: 2px; color: var(--vscode-descriptionForeground, #9d9d9d); }
.dbs-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 10px;
  border: 1px solid var(--dbs-line);
  border-radius: 999px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.dbs-btn:hover { color: var(--vscode-editor-foreground, #d4d4d4); border-color: var(--vscode-descriptionForeground, #9d9d9d); }
.dbs-btn.is-active,
.dbs-btn.is-active:hover {
  border-color: color-mix(in srgb, var(--dbs-accent) 55%, transparent);
  background: color-mix(in srgb, var(--dbs-accent) 16%, transparent);
  color: var(--dbs-accent);
  font-weight: 600;
}
/* 動作類按鈕（全部顯示、匯出、比較）：跟切換鈕同形，但用前景色，看得出是「做一件事」而不是狀態。 */
.dbs-btn.dbs-action { color: var(--vscode-editor-foreground, #d4d4d4); }
.dbs-btn:focus-visible,
.dbs-search input:focus-visible,
.dbs-select:focus-visible {
  outline: 2px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: 2px;
}
.dbs-search { position: relative; }
.dbs-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--vscode-input-border, var(--dbs-line));
  border-radius: 999px;
  background: var(--vscode-input-background, #3c3c3c);
  padding: 0 6px 0 12px;
}
.dbs-search input {
  width: 220px;
  padding: 4px 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--vscode-input-foreground, #ccc);
  font: inherit;
}
.dbs-kbd {
  flex: none;
  border: 1px solid var(--dbs-line);
  border-radius: 4px;
  padding: 0 4px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 10px;
  color: var(--vscode-descriptionForeground, #9d9d9d);
}
.dbs-results {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  width: 340px;
  max-height: 320px;
  overflow: auto;
  background: var(--vscode-quickInput-background, #252526);
  border: 1px solid var(--dbs-line);
  border-radius: 10px;
  box-shadow: 0 12px 28px -12px rgba(0,0,0,0.5);
}
.dbs-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 12px;
  cursor: pointer;
}
.dbs-result:hover, .dbs-result.is-cursor { background: var(--vscode-list-activeSelectionBackground, #04395e); }
.dbs-result-kind {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  width: 44px;
}
.dbs-result-label { font-family: var(--vscode-editor-font-family, monospace); }
.dbs-result-meta { margin-left: auto; color: var(--vscode-descriptionForeground, #9d9d9d); font-size: 11px; }
.dbs-step { min-width: 24px; justify-content: center; padding: 0 6px; }
.dbs-btn:disabled { opacity: 0.35; cursor: default; }
.dbs-depth-value {
  min-width: 46px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
/* 切到「全部」時，層數只是記住的值，不該看起來還在生效。 */
.dbs-group.is-unlimited .dbs-depth-value { opacity: 0.4; }
/* 聚焦某張表之後才出現的設定：深度、方向、不相關、取消聚焦——沒有聚焦時按了也沒效果。 */
/* 浮在畫布上（工具列正下方置中），不參與工具列的排版——聚焦時工具列不會變高、畫布不會跳。
   跟網頁版的 FocusBar 同一個做法。 */
.dbs-focus-cluster {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  max-width: calc(100vw - 24px);
  overflow-x: auto;
  align-items: center;
  gap: 6px 12px;
  border-radius: 999px;
  padding: 5px 6px 5px 12px;
  white-space: nowrap;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid color-mix(in srgb, var(--dbs-accent) 40%, var(--dbs-line));
  box-shadow: 0 12px 28px -16px rgba(0, 0, 0, 0.6);
  scrollbar-width: none;
}
/* 元件都有自己的 display，要明確讓 hidden 屬性贏，不然隱藏的按鈕會變成空框露出來。 */
.dbs-toolbar [hidden] { display: none !important; }
.dbs-focus-hint { color: var(--vscode-descriptionForeground, #9d9d9d); }
.dbs-select {
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--vscode-dropdown-border, var(--dbs-line));
  border-radius: 999px;
  background: var(--vscode-dropdown-background, #3c3c3c);
  color: var(--vscode-dropdown-foreground, #ccc);
  font: inherit;
  max-width: 220px;
}
.dbs-column-focus {
  margin-left: auto;
  border-color: color-mix(in srgb, var(--dbs-accent) 55%, transparent);
  background: color-mix(in srgb, var(--dbs-accent) 16%, transparent);
  color: var(--dbs-accent);
}
.dbs-metrics { margin-left: auto; color: var(--vscode-descriptionForeground, #9d9d9d); font-variant-numeric: tabular-nums; }
`;

export interface ToolbarHandlers {
  onDetailLevel(level: DetailLevel): void;
  /** 往外展開幾層；null 代表不限制。 */
  onDepth(depth: number | null): void;
  onDirection(direction: TraversalDirection): void;
  onUnrelated(mode: UnrelatedMode): void;
  /** 欄位備註要截斷成 … 還是完整展開成多行。 */
  onComments(expanded: boolean): void;
  /** 只顯示某個群組；null 代表全部。 */
  onGroupFilter(group: string | null): void;
  /** 依群組聚攏排版，還是純依關聯排版。 */
  onLayoutMode(mode: LayoutMode): void;
  /** 取消欄位聚焦。 */
  onClearColumnFocus(): void;
  onResetFocus(): void;
  onFitView(): void;
  /** 開啟匯出選單（SQL／DSL／JSON／PNG／SVG），選單由 Extension 端顯示。 */
  onExport(): void;
  /** 開啟比較選單（跟 git 裡的哪個版本比），選單由 Extension 端顯示。 */
  onCompare(): void;
  /** 完整模式（依關聯排版的卡片）或精簡模式（依群組分區、只顯示表名，點表看詳情）——跟網頁版相同。 */
  onViewMode(mode: ViewMode): void;
  /** 丟掉手動拖曳的位置，回到 Auto Layout。 */
  onResetLayout(): void;
  onPickHit(hit: SearchHit): void;
  onSearchResults(hits: SearchHit[]): void;
  /** 切換介面語系；會寫回 dbschema.language 設定。 */
  onLocale(locale: Locale): void;
}

/** 深度上限。再深就與「全部」幾乎沒有差別，卻讓按鈕變得難按。 */
const MAX_DEPTH = 9;

interface DepthStepper {
  element: HTMLElement;
  setValue(depth: number | null): void;
}

/**
 * 層數控制：`− 3 層 + 全部`。
 *
 * 原本只給 1 / 2 / 全部三個選項，中型 schema 常常需要 3～4 層才看得到全貌，
 * 選 1、2 太少、選全部又整片攤開。改成可自由增減。
 */
function depthStepper(
  strings: RendererStrings,
  onDepth: (depth: number | null) => void,
): DepthStepper {
  const element = document.createElement("div");
  element.className = "dbs-group";

  const caption = document.createElement("span");
  caption.className = "dbs-group-label";
  caption.textContent = strings.depthGroup;

  const minus = document.createElement("button");
  minus.className = "dbs-btn dbs-step";
  minus.textContent = "−";
  minus.title = strings.depthDecrease;

  const readout = document.createElement("span");
  readout.className = "dbs-depth-value";

  const plus = document.createElement("button");
  plus.className = "dbs-btn dbs-step";
  plus.textContent = "+";
  plus.title = strings.depthIncrease;

  const all = document.createElement("button");
  all.className = "dbs-btn";
  all.textContent = strings.depthAll;

  // 記住切到「全部」之前的層數，切回來時不用重新按。
  let levels = 1;
  let unlimited = false;

  const paint = (): void => {
    readout.textContent = strings.depthLevels(levels);
    all.classList.toggle("is-active", unlimited);
    all.setAttribute("aria-pressed", String(unlimited));
    element.classList.toggle("is-unlimited", unlimited);
    minus.disabled = unlimited || levels <= 1;
    plus.disabled = unlimited || levels >= MAX_DEPTH;
  };

  minus.addEventListener("click", () => {
    if (unlimited || levels <= 1) return;
    onDepth(levels - 1);
  });
  plus.addEventListener("click", () => {
    if (unlimited || levels >= MAX_DEPTH) return;
    onDepth(levels + 1);
  });
  all.addEventListener("click", () => onDepth(unlimited ? levels : null));

  element.append(caption, minus, readout, plus, all);

  return {
    element,
    setValue(depth) {
      unlimited = depth === null;
      if (depth !== null) levels = Math.min(MAX_DEPTH, Math.max(1, depth));
      paint();
    },
  };
}

export type ViewMode = "full" | "compact";
/** 工具列「顯示」的選項：compact 是分區總覽（精簡模式），其餘是完整模式下的欄位密度。 */
type DisplayMode = "compact" | DetailLevel;

interface ButtonGroup<T> {
  element: HTMLElement;
  setActive(value: T): void;
}

function buttonGroup<T extends string | number | boolean | null>(
  label: string,
  options: Array<{ label: string; value: T; hint?: string }>,
  onPick: (value: T) => void,
): ButtonGroup<T> {
  const group = document.createElement("div");
  group.className = "dbs-group";
  group.setAttribute("role", "group");
  if (label) group.setAttribute("aria-label", label);
  const caption = document.createElement("span");
  caption.className = "dbs-group-label";
  caption.textContent = label;
  group.append(caption);

  const buttons = new Map<T, HTMLButtonElement>();
  for (const option of options) {
    const button = document.createElement("button");
    button.className = "dbs-btn";
    button.textContent = option.label;
    if (option.hint) button.title = option.hint;
    button.addEventListener("click", () => onPick(option.value));
    buttons.set(option.value, button);
    group.append(button);
  }

  return {
    element: group,
    setActive(value: T) {
      for (const [key, button] of buttons) {
        button.classList.toggle("is-active", key === value);
        button.setAttribute("aria-pressed", String(key === value));
      }
    },
  };
}

/**
 * Preview Toolbar（plan §41）。
 *
 * Search 放在最前面且永遠可見 —— 在 100+ Table 的情境下，
 * 「找得到」比「畫得漂亮」重要（約束 #10、US3/US6）。
 */
export class Toolbar {
  readonly element: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly results: HTMLElement;
  private readonly metrics: HTMLElement;
  private readonly resetLayoutButton: HTMLButtonElement;
  private readonly exportButton: HTMLButtonElement;
  private readonly displayGroup: ButtonGroup<DisplayMode>;
  private readonly depthControl: DepthStepper;
  private readonly directionGroup: ButtonGroup<TraversalDirection>;
  private readonly unrelatedGroup: ButtonGroup<UnrelatedMode>;
  private readonly layoutModeGroup: ButtonGroup<LayoutMode>;
  private readonly commentsGroup: ButtonGroup<boolean>;
  private readonly groupSelect: HTMLSelectElement;
  private readonly groupWrap: HTMLElement;
  private readonly columnFocusChip: HTMLElement;
  private readonly localeGroup: ButtonGroup<Locale>;
  private readonly focusCluster: HTMLElement;
  private readonly focusHint: HTMLElement;
  private schema: Schema | null = null;
  private hits: SearchHit[] = [];
  private cursor = -1;

  constructor(
    private readonly handlers: ToolbarHandlers,
    private strings: RendererStrings,
  ) {
    this.element = document.createElement("div");
    this.element.className = "dbs-toolbar";
    this.element.setAttribute("role", "toolbar");

    const searchWrap = document.createElement("div");
    searchWrap.className = "dbs-group dbs-search";
    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.placeholder = this.strings.searchPlaceholder;
    this.input.setAttribute("aria-label", this.strings.searchPlaceholder);
    this.results = document.createElement("div");
    this.results.className = "dbs-results";
    this.results.hidden = true;
    const searchBox = document.createElement("div");
    searchBox.className = "dbs-search-box";
    const kbd = document.createElement("kbd");
    kbd.className = "dbs-kbd";
    kbd.textContent = "Ctrl F";
    searchBox.append(this.input, kbd);
    searchWrap.append(searchBox, this.results);

    // 「顯示」一組：分區總覽（精簡模式）＋三種欄位密度。之前是「檢視：完整／精簡」跟「欄位：…」
    // 兩組各管一半，意思重疊——跟網頁版一起併成一組。
    this.displayGroup = buttonGroup<DisplayMode>(
      this.strings.displayGroup,
      [
        { label: this.strings.displayZones, value: "compact" },
        { label: this.strings.viewOverview, value: "overview", hint: this.strings.viewOverviewHint },
        { label: this.strings.viewKeys, value: "keys", hint: this.strings.viewKeysHint },
        { label: this.strings.viewFull, value: "full", hint: this.strings.viewFullHint },
      ],
      (value) => (value === "compact" ? handlers.onViewMode("compact") : handlers.onDetailLevel(value)),
    );
    this.depthControl = depthStepper(this.strings, handlers.onDepth);
    this.directionGroup = buttonGroup<TraversalDirection>(
      this.strings.directionGroup,
      [
        { label: this.strings.directionAll, value: "all", hint: this.strings.directionAllHint },
        {
          label: this.strings.directionUpstream,
          value: "upstream",
          hint: this.strings.directionUpstreamHint,
        },
        {
          label: this.strings.directionDownstream,
          value: "downstream",
          hint: this.strings.directionDownstreamHint,
        },
      ],
      handlers.onDirection,
    );
    this.unrelatedGroup = buttonGroup<UnrelatedMode>(
      this.strings.unrelatedGroup,
      [
        { label: this.strings.unrelatedDim, value: "dim" },
        { label: this.strings.unrelatedHide, value: "hide" },
      ],
      handlers.onUnrelated,
    );

    // 依群組聚攏會讓跨群組的線拉得比較遠；純依關聯排版線最短，
    // 但同群組的表會散開。兩種各有適用場合，交給使用者切換。
    this.layoutModeGroup = buttonGroup<LayoutMode>(
      this.strings.layoutGroup,
      [
        { label: this.strings.layoutByGroup, value: "group" },
        { label: this.strings.layoutByRelation, value: "relation" },
      ],
      handlers.onLayoutMode,
    );

    // 群組是動態的（來自 Schema），用下拉而不是按鈕列，
    // 否則 10 個以上的模組會把 Toolbar 撐爆。
    const groupWrap = document.createElement("div");
    groupWrap.className = "dbs-group";
    const groupCaption = document.createElement("span");
    groupCaption.className = "dbs-group-label";
    groupCaption.textContent = this.strings.groupLabel;
    this.groupSelect = document.createElement("select");
    this.groupSelect.className = "dbs-select";
    this.groupSelect.addEventListener("change", () => {
      const value = this.groupSelect.value;
      handlers.onGroupFilter(value === "" ? null : value);
    });
    groupWrap.append(groupCaption, this.groupSelect);
    this.groupWrap = groupWrap;

    this.commentsGroup = buttonGroup<boolean>(
      this.strings.commentsGroup,
      [
        { label: this.strings.commentsTruncate, value: false, hint: this.strings.commentsTruncateHint },
        { label: this.strings.commentsExpand, value: true, hint: this.strings.commentsExpandHint },
      ],
      handlers.onComments,
    );

    // 語系鈕的標籤永遠寫成該語言本身，切到看不懂的語言時才找得回來。
    this.localeGroup = buttonGroup<Locale>(
      "",
      [
        { label: "EN", value: "en" },
        { label: "中文", value: "zh-hant" },
      ],
      handlers.onLocale,
    );

    const actions = document.createElement("div");
    actions.className = "dbs-group";
    const reset = document.createElement("button");
    reset.className = "dbs-btn dbs-action";
    reset.textContent = this.strings.resetFocus;
    reset.title = "Esc";
    reset.addEventListener("click", () => handlers.onResetFocus());
    const fit = document.createElement("button");
    fit.className = "dbs-btn dbs-action";
    fit.textContent = this.strings.fitView;
    fit.addEventListener("click", () => handlers.onFitView());
    this.exportButton = document.createElement("button");
    this.exportButton.className = "dbs-btn dbs-action";
    this.exportButton.textContent = this.strings.exportAction;
    this.exportButton.addEventListener("click", () => handlers.onExport());
    const compare = document.createElement("button");
    compare.className = "dbs-btn dbs-action";
    compare.textContent = this.strings.compareAction;
    compare.addEventListener("click", () => handlers.onCompare());

    // 只有真的拖曳過才出現，平常不佔用 Toolbar 空間。
    this.resetLayoutButton = document.createElement("button");
    this.resetLayoutButton.className = "dbs-btn dbs-action";
    this.resetLayoutButton.textContent = this.strings.resetLayout;
    this.resetLayoutButton.hidden = true;
    this.resetLayoutButton.addEventListener("click", () => handlers.onResetLayout());

    actions.append(fit, this.exportButton, compare, this.resetLayoutButton);

    // 聚焦某張表之後才有意義的設定收在一起；沒有聚焦時換成一行提示（跟網頁版一樣）。
    this.focusCluster = document.createElement("div");
    this.focusCluster.className = "dbs-focus-cluster";
    this.focusCluster.append(
      this.depthControl.element,
      this.directionGroup.element,
      this.unrelatedGroup.element,
      reset,
    );
    this.focusCluster.hidden = true;
    this.focusHint = document.createElement("span");
    this.focusHint.className = "dbs-focus-hint";
    this.focusHint.textContent = this.strings.focusHint;

    // 欄位聚焦的狀態要看得見，否則使用者會不知道畫面為什麼變暗。
    this.columnFocusChip = document.createElement("button");
    this.columnFocusChip.className = "dbs-btn dbs-column-focus";
    this.columnFocusChip.hidden = true;
    this.columnFocusChip.addEventListener("click", () => handlers.onClearColumnFocus());

    this.metrics = document.createElement("div");
    this.metrics.className = "dbs-metrics";

    this.element.append(
      searchWrap,
      this.displayGroup.element,
      this.focusCluster,
      this.focusHint,
      this.layoutModeGroup.element,
      this.groupWrap,
      this.commentsGroup.element,
      actions,
      this.columnFocusChip,
      this.metrics,
      this.localeGroup.element,
    );

    this.bindSearch();
  }

  setSchema(schema: Schema): void {
    this.schema = schema;
    this.input.value = "";
    this.renderResults([]);
    this.renderGroups(schema);
  }

  /** 沒有任何群組時整組隱藏，不佔 Toolbar 空間。 */
  private renderGroups(schema: Schema): void {
    const names = groupNames(schema);
    this.groupWrap.hidden = names.length === 0;
    this.groupSelect.replaceChildren();

    const all = document.createElement("option");
    all.value = "";
    all.textContent = this.strings.allGroups;
    this.groupSelect.append(all);

    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      const description = schema.groups?.find((g) => g.name === name)?.description;
      option.textContent = description ? `${name} — ${description}` : name;
      this.groupSelect.append(option);
    }
  }

  setMetrics(text: string): void {
    this.metrics.textContent = text;
  }

  /** 顯示目前聚焦的欄位；null 代表沒有聚焦。 */
  setColumnFocus(label: string | null): void {
    this.columnFocusChip.hidden = label === null;
    this.columnFocusChip.textContent = label ? `${this.strings.columnFocus}: ${label} ✕` : "";
  }

  /** 有聚焦某張表才顯示深度／方向／不相關／取消聚焦，沒有的話換成一行提示。 */
  setHasFocus(hasFocus: boolean): void {
    this.focusCluster.hidden = !hasFocus;
    this.focusHint.hidden = hasFocus;
  }

  setLayoutDirty(dirty: boolean): void {
    this.resetLayoutButton.hidden = !dirty;
  }

  setActive(state: {
    detailLevel: DetailLevel;
    depth: number | null;
    direction: TraversalDirection;
    unrelated: UnrelatedMode;
    expandComments: boolean;
    layoutMode: LayoutMode;
    groupFilter: string | null;
    locale: Locale;
    viewMode: ViewMode;
  }): void {
    this.displayGroup.setActive(state.viewMode === "compact" ? "compact" : state.detailLevel);
    this.depthControl.setValue(state.depth);
    this.directionGroup.setActive(state.direction);
    this.unrelatedGroup.setActive(state.unrelated);
    this.commentsGroup.setActive(state.expandComments);
    this.layoutModeGroup.setActive(state.layoutMode);
    this.groupSelect.value = state.groupFilter ?? "";
    this.localeGroup.setActive(state.locale);
  }

  focusSearch(): void {
    this.input.focus();
    this.input.select();
  }

  private bindSearch(): void {
    let timer: number | undefined;
    this.input.addEventListener("input", () => {
      window.clearTimeout(timer);
      // 200 表時每次按鍵都全掃仍然很快，但 debounce 可避免 IME 輸入抖動。
      timer = window.setTimeout(() => this.runSearch(this.input.value), 80);
    });

    this.input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (this.hits.length === 0) return;
        this.cursor =
          (this.cursor + (event.key === "ArrowDown" ? 1 : -1) + this.hits.length) % this.hits.length;
        this.paintCursor();
      } else if (event.key === "Enter") {
        const hit = this.hits[this.cursor >= 0 ? this.cursor : 0];
        if (hit) this.pick(hit);
      } else if (event.key === "Escape") {
        this.results.hidden = true;
      }
    });
  }

  private runSearch(query: string): void {
    if (!this.schema || !query.trim()) {
      this.renderResults([]);
      this.handlers.onSearchResults([]);
      return;
    }
    const hits = search(this.schema, query, 60);
    this.renderResults(hits);
    this.handlers.onSearchResults(hits);
  }

  private renderResults(hits: SearchHit[]): void {
    this.hits = hits;
    this.cursor = hits.length ? 0 : -1;
    this.results.replaceChildren();
    if (hits.length === 0) {
      this.results.hidden = true;
      return;
    }
    for (const hit of hits) {
      const item = document.createElement("div");
      item.className = "dbs-result";
      const kind = document.createElement("span");
      kind.className = "dbs-result-kind";
      kind.textContent = hit.kind === "table" ? this.strings.resultTable : this.strings.resultColumn;
      const label = document.createElement("span");
      label.className = "dbs-result-label";
      label.textContent = hit.label;
      const meta = document.createElement("span");
      meta.className = "dbs-result-meta";
      meta.textContent = hit.kind === "column" ? hit.tableId : hit.matchedOn;
      item.append(kind, label, meta);
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        this.pick(hit);
      });
      this.results.append(item);
    }
    this.results.hidden = false;
    this.paintCursor();
  }

  private paintCursor(): void {
    [...this.results.children].forEach((child, i) => {
      child.classList.toggle("is-cursor", i === this.cursor);
    });
  }

  private pick(hit: SearchHit): void {
    this.results.hidden = true;
    this.handlers.onPickHit(hit);
  }
}
