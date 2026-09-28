import type { Schema, SourceComments, SourceLocation, Table } from "@schemalens/schema-core";
import type { CommentToken } from "./lexer.js";

/** 可以掛註解的頂層語句：表、index、relation、group。 */
interface Statement {
  start: number;
  end: number;
  target: { sourceComments?: SourceComments };
  table?: Table;
}

function range(location: SourceLocation | undefined): { start: number; end: number } | null {
  if (!location) return null;
  return { start: location.line, end: location.endLine ?? location.line };
}

function addLeading(target: { sourceComments?: SourceComments }, text: string): void {
  target.sourceComments = { ...target.sourceComments, leading: [...(target.sourceComments?.leading ?? []), text] };
}

function addTrailing(target: { sourceComments?: SourceComments }, text: string): void {
  const existing = target.sourceComments?.trailing;
  target.sourceComments = { ...target.sourceComments, trailing: existing === undefined ? text : `${existing} //${text}` };
}

function addFooter(table: Table, text: string): void {
  table.sourceComments = { ...table.sourceComments, footer: [...(table.sourceComments?.footer ?? []), text] };
}

/**
 * 把 `//` 註解依行號掛回 Schema 上最接近的定義（就地修改）。
 *
 * - 寫在某一行尾端的 → 那一行的欄位／表頭／語句的 `trailing`
 * - 獨立成行、在表的大括號裡 → 下一個欄位的 `leading`；後面沒有欄位了 → 表的 `footer`
 * - 獨立成行、在頂層 → 下一個語句的 `leading`；後面沒有語句了 → `schema.trailingComments`
 *
 * 只是為了重新序列化時不弄丟註解，不追求把空行、語句順序也原樣保留。
 */
export function attachComments(schema: Schema, comments: readonly CommentToken[]): void {
  if (comments.length === 0) return;

  const statements: Statement[] = [];
  for (const table of schema.tables) {
    const r = range(table.location);
    if (r) statements.push({ ...r, target: table, table });
    for (const index of table.indexes) {
      const ir = range(index.location);
      if (ir) statements.push({ ...ir, target: index });
    }
  }
  for (const relation of schema.relations) {
    const r = range(relation.location);
    if (r) statements.push({ ...r, target: relation });
  }
  for (const group of schema.groups ?? []) {
    const r = range(group.location);
    if (r) statements.push({ ...r, target: group });
  }
  statements.sort((a, b) => a.start - b.start);

  for (const comment of comments) {
    const enclosing = statements.find((s) => s.start <= comment.line && comment.line <= s.end);

    if (enclosing?.table) {
      const table = enclosing.table;
      const columnOnLine = table.columns.find((c) => c.location?.line === comment.line);
      if (!comment.ownLine && columnOnLine) {
        addTrailing(columnOnLine, comment.text);
      } else if (!comment.ownLine && comment.line === enclosing.start) {
        addTrailing(table, comment.text);
      } else {
        const nextColumn = table.columns.find((c) => (c.location?.line ?? 0) > comment.line);
        if (nextColumn && comment.line < enclosing.end) addLeading(nextColumn, comment.text);
        else addFooter(table, comment.text);
      }
      continue;
    }

    if (enclosing) {
      // index／relation／group 語句本身或它的區塊裡：尾端的算 trailing，區塊內獨立成行的算在語句前面。
      if (!comment.ownLine && comment.line === enclosing.start) addTrailing(enclosing.target, comment.text);
      else addLeading(enclosing.target, comment.text);
      continue;
    }

    const next = statements.find((s) => s.start > comment.line);
    if (next) addLeading(next.target, comment.text);
    else schema.trailingComments = [...(schema.trailingComments ?? []), comment.text];
  }
}
