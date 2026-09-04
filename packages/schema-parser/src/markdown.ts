import type { SchemaDiagnostic } from "@schemalens/schema-core";
import { parseSchema, type ParseSchemaResult } from "./parseSchema.js";

export interface DbschemaBlock {
  /** 區塊內的 DSL 原文。 */
  source: string;
  /** ```dbschema 那一行的行號（1-based）。 */
  fenceLine: number;
  /** 區塊第一行 DSL 在 Markdown 檔中的行號（1-based）。 */
  startLine: number;
  /** 區塊最後一行 DSL 的行號（1-based）。 */
  endLine: number;
}

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/;

/**
 * 取出 Markdown 裡的 ```dbschema 區塊（plan §57、§2.2）。
 *
 * 只做必要的圍欄掃描，不引入 Markdown 解析器：
 * 對「找出程式碼區塊」這件事來說，行導向掃描已經足夠且不會誤判行號。
 */
export function extractDbschemaBlocks(markdown: string): DbschemaBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: DbschemaBlock[] = [];

  let index = 0;
  while (index < lines.length) {
    const match = FENCE.exec(lines[index] ?? "");
    if (!match) {
      index++;
      continue;
    }

    const [, , fence, language] = match;
    const closing = new RegExp(`^\\s*${fence![0]}{${fence!.length},}\\s*$`);
    const fenceLine = index + 1;
    const body: string[] = [];
    let cursor = index + 1;

    while (cursor < lines.length && !closing.test(lines[cursor] ?? "")) {
      body.push(lines[cursor] ?? "");
      cursor++;
    }

    if (language?.toLowerCase() === "dbschema") {
      blocks.push({
        source: body.join("\n"),
        fenceLine,
        startLine: fenceLine + 1,
        endLine: fenceLine + body.length,
      });
    }

    // 未閉合的圍欄：吃到檔尾就結束，不要回頭重掃造成無限迴圈。
    index = cursor + 1;
  }

  return blocks;
}

/**
 * Markdown → Schema。
 *
 * 多個區塊會被串成同一份 Schema（一份文件描述一個資料庫），
 * 且診斷的行號會被平移回 Markdown 的實際位置，
 * 這樣 Problems Panel 點下去才會跳到正確的那一行。
 */
export function parseMarkdownSchema(markdown: string, file?: string): ParseSchemaResult {
  const blocks = extractDbschemaBlocks(markdown);
  if (blocks.length === 0) {
    return parseSchema("", file);
  }

  // 用空行把各區塊接起來，並記錄每個區塊在合併後文本中的起始行，以便回推行號。
  const parts: string[] = [];
  const offsets: Array<{ mergedStart: number; markdownStart: number }> = [];
  let mergedLine = 1;

  for (const block of blocks) {
    const blockLines = block.source.split("\n");
    offsets.push({ mergedStart: mergedLine, markdownStart: block.startLine });
    parts.push(block.source);
    mergedLine += blockLines.length + 1;
  }

  const result = parseSchema(parts.join("\n\n"), file);
  const remap = (line: number): number => {
    let shift = 0;
    for (const offset of offsets) {
      if (line >= offset.mergedStart) shift = offset.markdownStart - offset.mergedStart;
      else break;
    }
    return line + shift;
  };

  const diagnostics: SchemaDiagnostic[] = result.diagnostics.map((diagnostic) =>
    diagnostic.location
      ? {
          ...diagnostic,
          location: {
            ...diagnostic.location,
            line: remap(diagnostic.location.line),
            endLine: diagnostic.location.endLine ? remap(diagnostic.location.endLine) : undefined,
          },
        }
      : diagnostic,
  );

  for (const table of result.schema.tables) {
    if (table.location) table.location.line = remap(table.location.line);
    for (const column of table.columns) {
      if (column.location) column.location.line = remap(column.location.line);
    }
    for (const index of table.indexes) {
      if (index.location) index.location.line = remap(index.location.line);
    }
  }
  for (const relation of result.schema.relations) {
    if (relation.location) relation.location.line = remap(relation.location.line);
  }

  return { schema: result.schema, diagnostics };
}
