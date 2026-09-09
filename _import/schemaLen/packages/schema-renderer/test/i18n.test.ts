import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  RENDERER_STRINGS,
  resolveLocale,
  stringsFor,
} from "@schemalens/schema-renderer";

describe("resolveLocale", () => {
  it("中文的各種變體都對應到繁體中文", () => {
    for (const language of ["zh", "zh-tw", "zh-TW", "zh-hant", "zh-CN"]) {
      expect(resolveLocale(language)).toBe("zh-hant");
    }
  });

  it("其餘語言一律 English", () => {
    for (const language of ["en", "en-US", "ja", "de", "fr"]) {
      expect(resolveLocale(language)).toBe("en");
    }
  });

  it("未知或未提供時退回預設", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });
});

describe("stringsFor", () => {
  it("兩個語系都提供完整字串，沒有漏翻", () => {
    const keys = Object.keys(RENDERER_STRINGS.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(RENDERER_STRINGS[locale]).sort()).toEqual(keys);
    }
  });

  it("英文與中文的內容確實不同（不是複製貼上）", () => {
    expect(RENDERER_STRINGS.en.viewGroup).not.toBe(RENDERER_STRINGS["zh-hant"].viewGroup);
    expect(RENDERER_STRINGS.en.resetFocus).not.toBe(RENDERER_STRINGS["zh-hant"].resetFocus);
  });

  it("帶參數的字串會把數字帶進去", () => {
    expect(stringsFor("en").moreColumns(3)).toContain("3");
    expect(stringsFor("zh-hant").moreColumns(3)).toContain("3");
    expect(stringsFor("en").diagnosticsTitle(2)).toContain("2");
    expect(stringsFor("zh-hant").diagnosticsTitle(2)).toContain("2");
  });

  it("英文的單複數正確", () => {
    expect(stringsFor("en").diagnosticsTitle(1)).toContain("issue");
    expect(stringsFor("en").diagnosticsTitle(1)).not.toContain("issues");
    expect(stringsFor("en").diagnosticsTitle(3)).toContain("issues");
  });

  it("未指定語系時退回預設而不是 undefined", () => {
    expect(stringsFor(undefined)).toBe(RENDERER_STRINGS[DEFAULT_LOCALE]);
  });
});
