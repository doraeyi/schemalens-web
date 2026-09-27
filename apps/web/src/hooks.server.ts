import { text, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';
import { handle as authHandle } from '$lib/server/auth';

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

export const handle = sequence(csrfGuard, authHandle);
