/**
 * Renderer 樣式。
 *
 * 以 VS Code Theme 變數為主、並全部帶 fallback，
 * 因此同一份 renderer 也能在純瀏覽器 / 測試環境跑起來（不依賴 VS Code API）。
 */
export const RENDERER_CSS = `
.dbs-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-editor-foreground, #d4d4d4);
  font-family: var(--vscode-font-family, system-ui, sans-serif);
  font-size: 12px;
  user-select: none;
  cursor: grab;
}
.dbs-root.is-panning { cursor: grabbing; }

.dbs-viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

/* 關聯線畫在卡片「之上」。
   否則長距離的線會被中間的卡片整條蓋掉，使用者根本看不到關聯。
   .dbs-edges 本身 pointer-events: none，只有線本身接受點擊，卡片照常可按。 */
.dbs-edges {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 2;
}
.dbs-nodes {
  position: relative;
  z-index: 1;
}
/* 與線同形的底線，用背景色描粗一點，
   讓線經過卡片時有一圈「空隙」，兩者都還看得清楚。 */
.dbs-edge-halo {
  fill: none;
  stroke: var(--vscode-editor-background, #1e1e1e);
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.75;
  pointer-events: none;
}
.dbs-edge-path {
  fill: none;
  stroke: var(--vscode-editorIndentGuide-activeBackground, #6e7681);
  stroke-width: 1.25;
  pointer-events: stroke;
  cursor: pointer;
}
.dbs-edge-hit { fill: none; stroke: transparent; stroke-width: 10; pointer-events: stroke; cursor: pointer; }
.dbs-edge-label {
  fill: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  font-family: var(--vscode-editor-font-family, monospace);
  pointer-events: none;
}
.dbs-edge.is-highlight .dbs-edge-path {
  stroke: var(--vscode-charts-blue, #4daafc);
  stroke-width: 2;
}
.dbs-edge.is-highlight .dbs-edge-label { fill: var(--vscode-charts-blue, #4daafc); }
.dbs-edge.is-dimmed { opacity: 0.12; }
.dbs-edge.is-hidden { display: none; }
.dbs-edge.is-selected .dbs-edge-path {
  stroke: var(--vscode-charts-orange, #d18616);
  stroke-width: 2.5;
}

.dbs-card {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  border-radius: 5px;
  background: var(--vscode-editorWidget-background, #252526);
  overflow: hidden;
  cursor: pointer;
  contain: layout paint;
}
.dbs-card.is-dimmed { opacity: 0.15; }
/* 拖曳中的卡片浮起來，並讓游標明確表示可以移動。 */
.dbs-card-header { cursor: grab; }
.dbs-card.is-dragging {
  cursor: grabbing;
  z-index: 3;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
  opacity: 0.95;
}
.dbs-card.is-hidden { display: none; }
.dbs-card.is-selected {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4);
}
.dbs-card.is-search-match {
  border-color: var(--vscode-charts-orange, #d18616);
}

.dbs-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  box-sizing: border-box;
  background: var(--vscode-titleBar-activeBackground, #3c3c3c);
  border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.dbs-card-toggle {
  flex: none;
  width: 14px;
  text-align: center;
  color: var(--vscode-descriptionForeground, #9d9d9d);
}
.dbs-card-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dbs-card-schema {
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  flex: none;
}
/* Table 備註與 schema 名稱同一行，不再自成一列。 */
.dbs-card-comment {
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dbs-card-comment::before {
  content: "· ";
}
/* 欄位區用 grid，並讓每一列以 subgrid 共用同一組欄寬。
   這樣同一張卡片裡的名稱、型別、備註一定對齊，
   不會因為某一列的型別或備註比較長就整排歪掉。
   五個 track：標記 / 名稱 / 型別 / null·default / 備註 */
.dbs-card-body {
  padding: 4px 0;
  display: grid;
  grid-template-columns: 50px max-content max-content max-content minmax(0, 1fr);
  column-gap: 8px;
  align-content: start;
}

.dbs-row {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  box-sizing: border-box;
  font-family: var(--vscode-editor-font-family, monospace);
  white-space: nowrap;
}

/* 列與列之間的格線，讓長卡片仍然容易橫向讀。 */
.dbs-row + .dbs-row {
  border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
}
.dbs-row:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.dbs-row.is-highlight {
  background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
}
/* 明確指定每個 span 落在哪一欄。
   否則某一列少了 null/default，備註就會被 auto-placement 塞進那一欄而錯位。 */
.dbs-row-badges {
  grid-column: 1;
  display: flex;
  gap: 3px;
  font-size: 9px;
  font-weight: 700;
}
/* 每個標記各自一個框：PK 與 FK 同時存在時才不會黏成 "PKFK"。 */
.dbs-badge {
  color: var(--vscode-descriptionForeground, #9d9d9d);
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 14px;
  opacity: 0.9;
}
.dbs-badge.pk { color: var(--vscode-charts-yellow, #e2c08d); }
.dbs-badge.fk { color: var(--vscode-charts-blue, #4daafc); }
.dbs-badge.uq { color: var(--vscode-charts-purple, #c586c0); }
.dbs-badge.idx { color: var(--vscode-charts-green, #89d185); }
.dbs-row-name {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dbs-row-type {
  grid-column: 3;
  color: var(--vscode-symbolIcon-typeParameterForeground, #75beff);
  font-size: 11px;
}
/* 欄位用途說明（plan §19：Column Comment 必須直接看得到，不能只放 tooltip）。 */
/* 備註佔最後一個彈性 track，過長時截斷而不是把整列撐開。 */
.dbs-row-comment {
  grid-column: 5;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  font-style: italic;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-left: 1px solid var(--vscode-panel-border, #3c3c3c);
  padding-left: 8px;
}
.dbs-row-flags {
  grid-column: 4;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
}
.dbs-row-more {
  grid-column: 1 / -1;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-style: italic;
}

.dbs-error {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  z-index: 20;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
  background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  color: var(--vscode-editor-foreground, #d4d4d4);
  font-size: 11px;
  max-height: 30%;
  overflow: auto;
  user-select: text;
}
.dbs-error-item { cursor: pointer; padding: 1px 0; }
.dbs-error-item:hover { text-decoration: underline; }

.dbs-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  pointer-events: none;
}
`;
