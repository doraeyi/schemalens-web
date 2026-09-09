import type { SchemaDiagnostic, SourceLocation } from "@schemalens/schema-core";
import { isKeyword, type Token } from "./tokens.js";

export interface LexResult {
  tokens: Token[];
  diagnostics: SchemaDiagnostic[];
}

const PUNCT = new Set(["{", "}", "(", ")", ",", ".", "-", ">"]);

/**
 * DSL Lexer。
 *
 * 換行是有意義的 token（一個 column 定義佔一行），
 * 因此不會像一般語言那樣把空白全部吃掉。
 *
 * Lexer 不丟例外：遇到壞字元就記診斷並跳過，讓 Parser 仍能繼續（US10）。
 */
export function tokenize(source: string, file?: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: SchemaDiagnostic[] = [];

  let index = 0;
  let line = 1;
  let column = 1;

  const at = (offset = 0): string => source[index + offset] ?? "";
  const loc = (startLine: number, startColumn: number, endColumn: number): SourceLocation => ({
    file,
    line: startLine,
    column: startColumn,
    endLine: startLine,
    endColumn,
  });
  const advance = (count = 1): void => {
    for (let i = 0; i < count; i++) {
      if (source[index] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      index++;
    }
  };

  while (index < source.length) {
    const char = at();

    if (char === "\r") {
      advance();
      continue;
    }
    if (char === "\n") {
      tokens.push({ type: "newline", value: "\n", location: loc(line, column, column + 1) });
      advance();
      continue;
    }
    if (char === " " || char === "\t") {
      advance();
      continue;
    }

    // 註解吃到行尾，但不吃掉換行本身（換行是 token）。
    if (char === "/" && at(1) === "/") {
      while (index < source.length && at() !== "\n") advance();
      continue;
    }

    if (char === '"') {
      const startLine = line;
      const startColumn = column;
      advance();
      let value = "";
      let terminated = false;
      while (index < source.length) {
        const current = at();
        if (current === "\\" && at(1) === '"') {
          value += '"';
          advance(2);
          continue;
        }
        if (current === '"') {
          advance();
          terminated = true;
          break;
        }
        // 字串不允許跨行，避免一個漏掉的引號吃掉整份檔案。
        if (current === "\n") break;
        value += current;
        advance();
      }
      if (!terminated) {
        diagnostics.push({
          code: "SCHEMA_PARSE_ERROR",
          severity: "error",
          message: "字串沒有結束的雙引號",
          location: loc(startLine, startColumn, column),
        });
      }
      tokens.push({ type: "string", value, location: loc(startLine, startColumn, column) });
      continue;
    }

    if (/[0-9]/.test(char)) {
      const startColumn = column;
      let value = "";
      while (index < source.length && /[0-9]/.test(at())) {
        value += at();
        advance();
      }
      tokens.push({ type: "number", value, location: loc(line, startColumn, column) });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const startColumn = column;
      let value = "";
      while (index < source.length && /[A-Za-z0-9_]/.test(at())) {
        value += at();
        advance();
      }
      tokens.push({
        type: isKeyword(value) ? "keyword" : "identifier",
        value,
        location: loc(line, startColumn, column),
      });
      continue;
    }

    if (PUNCT.has(char)) {
      const startColumn = column;
      // `->` 併成單一 token，讓 relation 的解析單純。
      if (char === "-" && at(1) === ">") {
        advance(2);
        tokens.push({ type: "punct", value: "->", location: loc(line, startColumn, column) });
        continue;
      }
      advance();
      tokens.push({ type: "punct", value: char, location: loc(line, startColumn, column) });
      continue;
    }

    diagnostics.push({
      code: "SCHEMA_PARSE_ERROR",
      severity: "error",
      message: `無法辨識的字元 '${char}'`,
      location: loc(line, column, column + 1),
    });
    advance();
  }

  tokens.push({ type: "eof", value: "", location: loc(line, column, column) });
  return { tokens, diagnostics };
}
