import { corsPreflight, withCors } from '$lib/server/mcp/cors';
import { OAuthError, registerClient } from '$lib/server/mcp/oauth';
import type { RequestHandler } from './$types';

/** RFC 7591 Dynamic Client Registration——claude.ai、ChatGPT 等第一次連線時自己來註冊。 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => null);
		return withCors(Response.json(await registerClient(body), { status: 201 }));
	} catch (error) {
		if (error instanceof OAuthError) return withCors(error.toResponse());
		throw error;
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
