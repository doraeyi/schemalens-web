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
.dbs-card-body { padding: 4px 0; }

.dbs-row {
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  box-sizing: border-box;
  gap: 6px;
  font-family: var(--vscode-editor-font-family, monospace);
  white-space: nowrap;
}
.dbs-row:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.dbs-row.is-highlight {
  background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
}
.dbs-row-badges {
  flex: none;
  width: 50px;
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
.dbs-row-name { flex: none; }
.dbs-row-type {
  color: var(--vscode-symbolIcon-typeParameterForeground, #75beff);
  margin-left: auto;
  font-size: 11px;
  flex: none;
}
/* 欄位用途說明（plan §19：Column Comment 必須直接看得到，不能只放 tooltip）。 */
.dbs-row-comment {
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  font-style: italic;
  max-width: 45%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dbs-row-comment::before {
  content: "— ";
}
.dbs-row-flags {
  flex: none;
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
}
.dbs-row-more {
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
