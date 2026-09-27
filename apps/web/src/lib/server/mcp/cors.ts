/**
 * MCP 跟 OAuth 的端點會被瀏覽器裡的 client（例如 MCP Inspector）直接呼叫，要開 CORS。
 * 這些端點都不靠 cookie，只認 Bearer token／PKCE，開放任意來源不會讓別的網站冒用使用者的登入狀態。
 */
const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
	'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id'
};

export function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}
