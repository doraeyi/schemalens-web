import { corsPreflight, withCors } from '$lib/server/mcp/cors';
import { exchangeToken, OAuthError } from '$lib/server/mcp/oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const form = new URLSearchParams(await request.text());
		const tokens = await exchangeToken(form);
		return withCors(Response.json(tokens, { headers: { 'Cache-Control': 'no-store' } }));
	} catch (error) {
		if (error instanceof OAuthError) return withCors(error.toResponse());
		throw error;
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
