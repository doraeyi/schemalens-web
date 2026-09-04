import type { Schema, TableId } from "@schemalens/schema-core";

export interface TableSearchHit {
  kind: "table";
  tableId: TableId;
  /** 命中的顯示文字，例如 `dbo.Users` */
  label: string;
  /** 命中的欄位來源：名稱 / 全名 / 註解 */
  matchedOn: "name" | "qualifiedName" | "comment";
  score: number;
}

export interface ColumnSearchHit {
  kind: "column";
  tableId: TableId;
  column: string;
  /** 例如 `Orders.UserId` */
  label: string;
  matchedOn: "name" | "comment" | "type";
  score: number;
}

export type SearchHit = TableSearchHit | ColumnSearchHit;

/** 前綴 > 詞首 > 子字串；分數越高越前面。 */
function matchScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  const idx = h.indexOf(n);
  if (idx < 0) return 0;
  const prev = h[idx - 1];
  if (prev === "_" || prev === "." || prev === " ") return 60;
  return 40;
}

export function searchTables(schema: Schema, query: string, limit = 50): TableSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: TableSearchHit[] = [];
  for (const table of schema.tables) {
    const candidates: Array<[TableSearchHit["matchedOn"], string, number]> = [
      ["name", table.name, 0],
      ["qualifiedName", table.id, -5],
      ["comment", table.comment ?? "", -20],
    ];
    let best: TableSearchHit | undefined;
    for (const [matchedOn, text, bias] of candidates) {
      if (!text) continue;
      const score = matchScore(text, q);
      if (score <= 0) continue;
      const total = score + bias;
      if (!best || total > best.score) {
        best = { kind: "table", tableId: table.id, label: table.id, matchedOn, score: total };
      }
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return hits.slice(0, limit);
}

export function searchColumns(schema: Schema, query: string, limit = 100): ColumnSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: ColumnSearchHit[] = [];
  for (const table of schema.tables) {
    for (const column of table.columns) {
      const candidates: Array<[ColumnSearchHit["matchedOn"], string, number]> = [
        ["name", column.name, 0],
        ["comment", column.comment ?? "", -20],
        ["type", column.type, -30],
      ];
      let best: ColumnSearchHit | undefined;
      for (const [matchedOn, text, bias] of candidates) {
        if (!text) continue;
        const score = matchScore(text, q);
        if (score <= 0) continue;
        const total = score + bias;
        if (!best || total > best.score) {
          best = {
            kind: "column",
            tableId: table.id,
            column: column.name,
            label: `${table.name}.${column.name}`,
            matchedOn,
            score: total,
          };
        }
      }
      if (best) hits.push(best);
    }
  }
  hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return hits.slice(0, limit);
}

export function search(schema: Schema, query: string, limit = 50): SearchHit[] {
  const tables = searchTables(schema, query, limit);
  const columns = searchColumns(schema, query, limit);
  // Table 命中優先於 Column 命中（同分時）。
  const merged: SearchHit[] = [...tables, ...columns];
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.kind !== b.kind) return a.kind === "table" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return merged.slice(0, limit);
}
