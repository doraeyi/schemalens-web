import { redirect, text, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';
import { handle as authHandle } from '$lib/server/auth';
import { DEFAULT_LOCALE, LOCALE_COOKIE, htmlLang, isLocale, type Locale } from '$lib/i18n/locale';

/**
 * 不受跨站表單檢查的路徑。/oauth/token 不靠 cookie，只認授權碼 + PKCE 或 refresh token，
 * 別的網站就算送得過來也拿不到任何東西，放行是安全的。
 */
const CSRF_EXEMPT_PATHS = new Set(['/oauth/token']);

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata'
];

/**
 * SvelteKit 內建 csrf.checkOrigin 的同一套規則（vite.config.ts 裡把內建的關掉了，原因見那邊），
 * 只多了 CSRF_EXEMPT_PATHS。授權同意頁的「允許」按鈕、Auth.js 的登入登出都靠這個防跨站偽造。
 * 跟內建的一樣只在正式環境生效。
 */
const csrfGuard: Handle = ({ event, resolve }) => {
	const { request, url } = event;
	if (dev || CSRF_EXEMPT_PATHS.has(url.pathname)) return resolve(event);

	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	const isForm = FORM_CONTENT_TYPES.includes(contentType);
	const isUnsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
	if (isForm && isUnsafeMethod && request.headers.get('origin') !== url.origin) {
		return text(`Cross-site ${request.method} form submissions are forbidden`, { status: 403 });
	}
	return resolve(event);
};

/**
 * 決定這個請求的介面語言，見 $lib/i18n/locale.ts。
 * - ?lang=en／?lang=zh-hant：記進 cookie，導回不帶參數的網址（首頁會換成該語言的版本）。
 * - /en 底下：一律英文，並記進 cookie，從英文首頁點進文件、工作區才不會跳回中文。
 * - 首頁 / 但 cookie 是英文：導到 /en。
 * <html lang> 跟著換，螢幕閱讀器跟搜尋引擎才會用對的語言。
 */
const localeHandle: Handle = ({ event, resolve }) => {
	const { url, cookies } = event;
	const remember = (locale: Locale) =>
		cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, sameSite: 'lax' });
	const isEnglishPath = url.pathname === '/en' || url.pathname.startsWith('/en/');

	const requested = url.searchParams.get('lang');
	if (isLocale(requested) && event.request.method === 'GET') {
		remember(requested);
		const next = new URL(url);
		next.searchParams.delete('lang');
		if (requested === 'en' && next.pathname === '/') next.pathname = '/en';
		if (requested === 'zh-hant' && isEnglishPath) next.pathname = next.pathname.slice(3) || '/';
		redirect(303, next.pathname + next.search + next.hash);
	}

	let locale: Locale;
	if (isEnglishPath) {
		locale = 'en';
		if (cookies.get(LOCALE_COOKIE) !== 'en') remember('en');
	} else {
		const stored = cookies.get(LOCALE_COOKIE);
		locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
		if (locale === 'en' && url.pathname === '/' && event.request.method === 'GET') redirect(307, '/en' + url.search);
	}
	event.locals.locale = locale;

	if (locale === DEFAULT_LOCALE) return resolve(event);
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html lang="zh-Hant">', `<html lang="${htmlLang(locale)}">`)
	});
};

export const handle = sequence(csrfGuard, localeHandle, authHandle);
