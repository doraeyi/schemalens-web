import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { corsPreflight, withCors } from '$lib/server/mcp/cors';
import { mcpResourceUrl, verifyAccessToken } from '$lib/server/mcp/oauth';
import { createSchemaLensMcpServer } from '$lib/server/mcp/tools';
import type { RequestHandler } from './$types';

function normalizeResource(value: string): string {
	return value.replace(/\/+$/, '');
}

function unauthorized(origin: string): Response {
	return withCors(
		Response.json(
			{ error: 'invalid_token', error_description: '需要用 SchemaLens 帳號授權' },
			{
				status: 401,
				headers: {
					'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`
				}
			}
		)
	);
}

/**
 * MCP Streamable HTTP 端點，stateless：每個請求各自驗 token、建一個新的 server 跟 transport，
 * 回 JSON 不開 SSE——Vercel serverless 撐不住長連線，工具也都是一問一答，用不到串流。
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
	const verified = token ? await verifyAccessToken(token) : null;
	const resource = mcpResourceUrl(url.origin);
	if (!verified || (verified.resource && normalizeResource(verified.resource) !== resource)) {
		return unauthorized(url.origin);
	}

	const server = createSchemaLensMcpServer(verified.userId, url.origin);
	const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
	await server.connect(transport);
	const response = await transport.handleRequest(request, {
		authInfo: {
			token: token!,
			clientId: verified.clientId,
			scopes: [],
			expiresAt: Math.floor(verified.expiresAt.getTime() / 1000),
			extra: { userId: verified.userId }
		}
	});
	return withCors(response);
};

const methodNotAllowed: RequestHandler = () =>
	withCors(
		Response.json(
			{ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
			{ status: 405, headers: { Allow: 'POST, OPTIONS' } }
		)
	);

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS: RequestHandler = () => corsPreflight();
