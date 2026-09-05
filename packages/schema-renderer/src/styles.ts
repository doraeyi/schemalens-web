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

/* 關聯線的疊放層級隨狀態改變。
   預設在卡片「之下」：100+ 張表時線非常多，疊在上面會把欄位內容整片蓋掉。
   一旦聚焦（點表或點欄位），無關的線已經被淡化，
   剩下的正是使用者要看的，這時才浮到卡片之上以免被擋住。
   .dbs-edges 本身 pointer-events: none，只有線接受點擊，卡片照常可按。 */
.dbs-edges {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}
.dbs-edges.is-above { z-index: 3; }
.dbs-nodes {
  position: relative;
  z-index: 2;
}
/* 群組外框在最底層：只圈範圍，不擋卡片也不擋線。 */
.dbs-groups {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
}
.dbs-group-box {
  position: absolute;
  box-sizing: border-box;
  border: 2px dashed;
  border-radius: 10px;
}
.dbs-group-box.is-filtered-out { opacity: 0.12; }
.dbs-group-box-label {
  position: absolute;
  top: 10px;
  left: 14px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 10px;
  background: var(--vscode-editor-background, #1e1e1e);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.dbs-group-box-desc {
  color: var(--vscode-descriptionForeground, #9d9d9d);
  font-size: 10px;
  font-weight: 400;
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
.dbs-card.has-group { border-left-width: 3px; }
.dbs-card-group {
  flex: none;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 8px;
  white-space: nowrap;
}
/* 被群組篩選排除的表：比 dim 更弱，但仍看得到輪廓，
   使用者才知道「還有東西在那裡」而不是以為資料不見了。 */
.dbs-card.is-filtered-out { opacity: 0.06; }
.dbs-edge.is-filtered-out { opacity: 0.05; }

.dbs-card.is-dimmed { opacity: 0.15; }
/* 量測用：算「不含備註時至少需要多寬」。
   欄位名稱與型別永遠不該被截斷，備註才可以。 */
.dbs-card.is-measuring-essential .dbs-row-comment,
.dbs-card.is-measuring-essential .dbs-card-comment {
  display: none;
}
/* 拖曳中的卡片浮起來，並讓游標明確表示可以移動。 */
.dbs-card-header { cursor: grab; }
/* 淡化的表不可拖曳，游標也要說清楚——否則使用者會以為拖不動是壞掉。 */
.dbs-card.is-dimmed .dbs-card-header,
.dbs-card.is-filtered-out .dbs-card-header {
  cursor: pointer;
}
.dbs-card.is-dragging {
  cursor: grabbing;
  z-index: 3;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
  opacity: 0.95;
}
.dbs-card.is-hidden { display: none; }
/* 邊框強調：同一時間只有一個會被套上（由 renderer 決定），
   因此這三條規則不會互相打架。 */
.dbs-card.is-selected {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 2px var(--vscode-focusBorder, #007fd4);
}
/* 因聚焦而被點亮的相關表：比焦點弱，但明顯有別於「沒被淡化」。 */
.dbs-card.is-related {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px rgba(0, 127, 212, 0.45);
}
/* 搜尋命中用 outline，與 border 是不同屬性，可以和上面並存。 */
.dbs-card.is-search-match {
  outline: 1px dashed var(--vscode-charts-orange, #d18616);
  outline-offset: 2px;
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
/* 欄位聚焦：起點最亮、對應欄位次之、其餘視為雜訊。
   用降低不相關欄位的方式而不是隱藏——欄位一旦消失，
   使用者會誤以為這張表沒有那些欄位。 */
/* 用與「高亮關聯線」同一個藍色系：亮起的欄位與亮起的線一眼就對得起來。
   先前用 list-activeSelectionBackground，在多數深色主題下與卡片底色幾乎同色，
   看起來只有「其他變暗」而沒有「這個亮起」。
   rgba 先寫一次當後備，色彩混合不支援時仍有底色。 */
.dbs-row.is-column-focus {
  background: rgba(77, 170, 252, 0.3);
  background: color-mix(in srgb, var(--vscode-charts-blue, #4daafc) 30%, transparent);
  box-shadow: inset 3px 0 0 var(--vscode-charts-blue, #4daafc);
  font-weight: 700;
}
.dbs-row.is-column-related {
  background: rgba(77, 170, 252, 0.14);
  background: color-mix(in srgb, var(--vscode-charts-blue, #4daafc) 14%, transparent);
  box-shadow: inset 3px 0 0 rgba(77, 170, 252, 0.55);
}
.dbs-row.is-column-muted { opacity: 0.2; }

/* 哪幾張卡片裡有亮起的欄位——150 張表時，
   沒有這個標示根本找不到亮在哪。 */
.dbs-card.is-column-participant {
  border-color: var(--vscode-charts-blue, #4daafc);
  box-shadow: 0 0 0 1px var(--vscode-charts-blue, #4daafc);
}

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
/* 備註佔最後一個彈性 track。
   預設單行、過長截斷成 …；展開時改為多行（行的切分由 cardModel 算好）。 */
.dbs-row-comment.is-expanded {
  display: flex;
  flex-direction: column;
  justify-content: center;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}
.dbs-comment-line {
  line-height: 14px;
  white-space: nowrap;
}
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
