import type { SourceLocation } from "@schemalens/schema-core";

export type TokenType =
  | "identifier"
  | "number"
  | "string"
  | "keyword"
  | "punct"
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  /** 原始文字；string token 則是已解逸出的內容。 */
  value: string;
  location: SourceLocation;
}

/** 關鍵字比對不分大小寫，但保留原文於 token.value。 */
export const KEYWORDS = new Set([
  "table",
  "index",
  "relation",
  "on",
  "unique",
  "not",
  "null",
  "default",
  "pk",
  "fk",
  "uq",
  "idx",
]);

export function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toLowerCase());
}
