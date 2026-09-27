import { redirect } from '@sveltejs/kit';
import { createAuthCode, OAuthError, parseAuthorizeRequest } from '$lib/server/mcp/oauth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// 同意頁不能被別的網站用 iframe 嵌進去騙使用者點「允許」。
	event.setHeaders({ 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" });
	try {
		const { client, request } = await parseAuthorizeRequest(event.url);
		const session = await event.locals.auth();
		return {
			error: null,
			clientName: client.clientName,
			// 應用程式名稱是對方註冊時自己填的，不可信——一併顯示授權完會被帶去的網域，讓使用者自己判斷。
			redirectHost: new URL(request.redirectUri).host || request.redirectUri,
			userName: session?.user?.name ?? session?.user?.email ?? null,
			signedIn: !!session?.user?.id
		};
	} catch (error) {
		if (error instanceof OAuthError) return { error: error.description };
		throw error;
	}
};

export const actions: Actions = {
	default: async (event) => {
		const { request } = await parseAuthorizeRequest(event.url);
		const session = await event.locals.auth();
		if (!session?.user?.id) return { error: '登入狀態已失效，請重新登入' };

		const target = new URL(request.redirectUri);
		const form = await event.request.formData();
		if (form.get('decision') === 'approve') {
			target.searchParams.set('code', await createAuthCode(session.user.id, request));
		} else {
			target.searchParams.set('error', 'access_denied');
		}
		if (request.state !== null) target.searchParams.set('state', request.state);
		target.searchParams.set('iss', event.url.origin);
		redirect(303, target.toString());
	}
};
