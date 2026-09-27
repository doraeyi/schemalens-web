import { corsPreflight, withCors } from '$lib/server/mcp/cors';
import { mcpResourceUrl } from '$lib/server/mcp/oauth';
import type { RequestHandler } from './$types';

/**
 * RFC 9728 Protected Resource Metadata：告訴 MCP client「/api/mcp 要去哪裡拿 token」。
 * client 可能打 /.well-known/oauth-protected-resource 或 /.well-known/oauth-protected-resource/api/mcp，
 * 用 rest 參數兩種都接。
 */
export const GET: RequestHandler = ({ url }) =>
	withCors(
		Response.json({
			resource: mcpResourceUrl(url.origin),
			authorization_servers: [url.origin],
			bearer_methods_supported: ['header'],
			resource_name: 'SchemaLens'
		})
	);

export const OPTIONS: RequestHandler = () => corsPreflight();
