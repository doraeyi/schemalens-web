/**
 * 整個網站的介面語言。跟 renderer 的 Locale 用同一組值，工作區可以直接把它傳給 stringsFor()。
 *
 * 決定順序（見 hooks.server.ts）：網址帶 ?lang= → 網址在 /en 底下 → cookie → 預設中文。
 * 選過一次就記在 cookie，之後不管進到首頁、文件還是工作區都是同一個語言。
 */
export type Locale = 'zh-hant' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh-hant';
export const LOCALE_COOKIE = 'sl-lang';

export function isLocale(value: unknown): value is Locale {
	return value === 'zh-hant' || value === 'en';
}

/** <html lang> 用的值。 */
export function htmlLang(locale: Locale): string {
	return locale === 'en' ? 'en' : 'zh-Hant';
}
