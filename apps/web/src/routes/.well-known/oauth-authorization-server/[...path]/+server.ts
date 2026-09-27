import { corsPreflight, withCors } from '$lib/server/mcp/cors';
import type { RequestHandler } from './$types';

/** RFC 8414 Authorization Server Metadata——SchemaLens 自己就是 authorization server，issuer 是網站本身的 origin。 */
export const GET: RequestHandler = ({ url }) =>
	withCors(
		Response.json({
			issuer: url.origin,
			authorization_endpoint: `${url.origin}/oauth/authorize`,
			token_endpoint: `${url.origin}/oauth/token`,
			registration_endpoint: `${url.origin}/oauth/register`,
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			code_challenge_methods_supported: ['S256'],
			token_endpoint_auth_methods_supported: ['none']
		})
	);

export const OPTIONS: RequestHandler = () => corsPreflight();
