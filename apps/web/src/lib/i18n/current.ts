import { page } from '$app/state';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';

/** 元件裡目前的語言。來自根 layout 的 load，所以伺服器端每個請求各自獨立，不會互相串到。 */
export function currentLocale(): Locale {
	const value = (page.data as { locale?: unknown }).locale;
	return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** 切到另一個語言的連結：留在同一頁，交給 hooks 記 cookie 再導回乾淨的網址。 */
export function switchLocaleHref(target: Locale, path = page.url.pathname): string {
	return `${path}?lang=${target}`;
}

/** 元件裡挑出目前語言的那份文案：const m = $derived(pick({ 'zh-hant': {...}, en: {...} }))。 */
export function pick<T>(messages: Record<Locale, T>): T {
	return messages[currentLocale()];
}
