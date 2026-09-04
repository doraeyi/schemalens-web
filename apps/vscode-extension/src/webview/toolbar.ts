import type { Schema } from "@schemalens/schema-core";
import { search, type SearchHit } from "@schemalens/schema-graph";
import type { DetailLevel, UnrelatedMode } from "@schemalens/schema-renderer";
import type { TraversalDirection } from "@schemalens/schema-graph";

export const TOOLBAR_CSS = `
.dbs-toolbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 10px;
  background: var(--vscode-editorWidget-background, #252526);
  border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  font-size: 11px;
  color: var(--vscode-editor-foreground, #d4d4d4);
}
.dbs-group { display: flex; align-items: center; gap: 4px; }
.dbs-group-label { color: var(--vscode-descriptionForeground, #9d9d9d); }
.dbs-btn {
  padding: 3px 8px;
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.dbs-btn:hover { background: var(--vscode-toolbar-hoverBackground, #383838); }
.dbs-btn.is-active {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  border-color: transparent;
}
.dbs-search { position: relative; }
.dbs-search input {
  width: 240px;
  padding: 4px 8px;
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 3px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font: inherit;
}
.dbs-results {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  width: 340px;
  max-height: 320px;
  overflow: auto;
  background: var(--vscode-quickInput-background, #252526);
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.dbs-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 10px;
  cursor: pointer;
}
.dbs-result:hover, .dbs-result.is-cursor { background: var(--vscode-list-activeSelectionBackground, #04395e); }
.dbs-result-kind {
  flex: none;
  font-size: 9px;
  font-weight: 700;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  width: 44px;
}
.dbs-result-label { font-family: var(--vscode-editor-font-family, monospace); }
.dbs-result-meta { margin-left: auto; color: var(--vscode-descriptionForeground, #9d9d9d); font-size: 10px; }
.dbs-metrics { margin-left: auto; color: var(--vscode-descriptionForeground, #9d9d9d); }
`;

export interface ToolbarHandlers {
  onDetailLevel(level: DetailLevel): void;
  onDepth(depth: 1 | 2 | null): void;
  onDirection(direction: TraversalDirection): void;
  onUnrelated(mode: UnrelatedMode): void;
  onResetFocus(): void;
  onFitView(): void;
  onPickHit(hit: SearchHit): void;
  onSearchResults(hits: SearchHit[]): void;
}

interface ButtonGroup<T> {
  element: HTMLElement;
  setActive(value: T): void;
}

function buttonGroup<T extends string | number | null>(
  label: string,
  options: Array<{ label: string; value: T }>,
  onPick: (value: T) => void,
): ButtonGroup<T> {
  const group = document.createElement("div");
  group.className = "dbs-group";
  const caption = document.createElement("span");
  caption.className = "dbs-group-label";
  caption.textContent = label;
  group.append(caption);

  const buttons = new Map<T, HTMLButtonElement>();
  for (const option of options) {
    const button = document.createElement("button");
    button.className = "dbs-btn";
    button.textContent = option.label;
    button.addEventListener("click", () => onPick(option.value));
    buttons.set(option.value, button);
    group.append(button);
  }

  return {
    element: group,
    setActive(value: T) {
      for (const [key, button] of buttons) button.classList.toggle("is-active", key === value);
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
  private readonly detailGroup: ButtonGroup<DetailLevel>;
  private readonly depthGroup: ButtonGroup<1 | 2 | null>;
  private readonly directionGroup: ButtonGroup<TraversalDirection>;
  private readonly unrelatedGroup: ButtonGroup<UnrelatedMode>;
  private schema: Schema | null = null;
  private hits: SearchHit[] = [];
  private cursor = -1;

  constructor(private readonly handlers: ToolbarHandlers) {
    this.element = document.createElement("div");
    this.element.className = "dbs-toolbar";

    const searchWrap = document.createElement("div");
    searchWrap.className = "dbs-group dbs-search";
    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.placeholder = "搜尋 Table 或 Column…";
    this.results = document.createElement("div");
    this.results.className = "dbs-results";
    this.results.hidden = true;
    searchWrap.append(this.input, this.results);

    this.detailGroup = buttonGroup<DetailLevel>(
      "View",
      [
        { label: "Overview", value: "overview" },
        { label: "Keys", value: "keys" },
        { label: "Full", value: "full" },
      ],
      handlers.onDetailLevel,
    );
    this.depthGroup = buttonGroup<1 | 2 | null>(
      "Depth",
      [
        { label: "All", value: null },
        { label: "1-Hop", value: 1 },
        { label: "2-Hop", value: 2 },
      ],
      handlers.onDepth,
    );
    this.directionGroup = buttonGroup<TraversalDirection>(
      "Direction",
      [
        { label: "All", value: "all" },
        { label: "Upstream", value: "upstream" },
        { label: "Downstream", value: "downstream" },
      ],
      handlers.onDirection,
    );
    this.unrelatedGroup = buttonGroup<UnrelatedMode>(
      "Unrelated",
      [
        { label: "Dim", value: "dim" },
        { label: "Hide", value: "hide" },
      ],
      handlers.onUnrelated,
    );

    const actions = document.createElement("div");
    actions.className = "dbs-group";
    const reset = document.createElement("button");
    reset.className = "dbs-btn";
    reset.textContent = "Reset Focus";
    reset.addEventListener("click", () => handlers.onResetFocus());
    const fit = document.createElement("button");
    fit.className = "dbs-btn";
    fit.textContent = "Fit View";
    fit.addEventListener("click", () => handlers.onFitView());
    actions.append(reset, fit);

    this.metrics = document.createElement("div");
    this.metrics.className = "dbs-metrics";

    this.element.append(
      searchWrap,
      this.detailGroup.element,
      this.depthGroup.element,
      this.directionGroup.element,
      this.unrelatedGroup.element,
      actions,
      this.metrics,
    );

    this.bindSearch();
  }

  setSchema(schema: Schema): void {
    this.schema = schema;
    this.input.value = "";
    this.renderResults([]);
  }

  setMetrics(text: string): void {
    this.metrics.textContent = text;
  }

  setActive(state: {
    detailLevel: DetailLevel;
    depth: 1 | 2 | null;
    direction: TraversalDirection;
    unrelated: UnrelatedMode;
  }): void {
    this.detailGroup.setActive(state.detailLevel);
    this.depthGroup.setActive(state.depth);
    this.directionGroup.setActive(state.direction);
    this.unrelatedGroup.setActive(state.unrelated);
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
      kind.textContent = hit.kind === "table" ? "TABLE" : "COLUMN";
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
