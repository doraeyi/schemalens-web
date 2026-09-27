import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { oauthClientsTable, oauthCodesTable, oauthTokensTable } from '$lib/server/db/schema';

/**
 * SchemaLens 自己當 MCP 的 OAuth authorization server（MCP authorization spec：
 * OAuth 2.1 + PKCE、RFC 7591 Dynamic Client Registration、RFC 8707 resource indicator）。
 * claude.ai／ChatGPT／Claude Code 加 connector 時自己註冊 client、帶使用者來 /oauth/authorize
 * 用 GitHub 登入並同意，之後拿 access token 呼叫 /api/mcp。
 *
 * 只有 public client（token_endpoint_auth_method = none），安全性靠 PKCE S256 跟完全比對 redirect_uri。
 */

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_SECONDS = 5 * 60;

export const MCP_PATH = '/api/mcp';

export function mcpResourceUrl(origin: string): string {
	return `${origin}${MCP_PATH}`;
}

export class OAuthError extends Error {
	constructor(
		readonly error: string,
		readonly description: string,
		readonly status = 400
	) {
		super(description);
	}

	toResponse(): Response {
		return Response.json({ error: this.error, error_description: this.description }, { status: this.status });
	}
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function randomToken(): string {
	return randomBytes(32).toString('base64url');
}

function secondsFromNow(seconds: number): Date {
	return new Date(Date.now() + seconds * 1000);
}

const BLOCKED_REDIRECT_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:']);

/**
 * https 一律可以；http 只允許本機迴路位址（桌面版 client 用）；其他自訂 scheme（例如 IDE 的
 * `cursor://`）放行，但擋掉能直接執行內容的幾種。
 */
function isAcceptableRedirectUri(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.hash) return false;
	if (url.protocol === 'https:') return true;
	if (url.protocol === 'http:') return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	return !BLOCKED_REDIRECT_SCHEMES.has(url.protocol);
}

export async function registerClient(body: unknown) {
	const input = (body ?? {}) as { client_name?: unknown; redirect_uris?: unknown };
	const redirectUris = Array.isArray(input.redirect_uris) ? input.redirect_uris.filter((u) => typeof u === 'string') : [];
	if (redirectUris.length === 0) throw new OAuthError('invalid_redirect_uri', 'redirect_uris 至少要有一個');
	const bad = redirectUris.find((u) => !isAcceptableRedirectUri(u));
	if (bad) throw new OAuthError('invalid_redirect_uri', `不接受的 redirect_uri：${bad}`);

	const clientName =
		typeof input.client_name === 'string' && input.client_name.trim() ? input.client_name.trim().slice(0, 255) : '未命名的應用程式';
	const clientId = randomToken();
	await getDb()
		.insert(oauthClientsTable)
		.values({ clientId, clientName, redirectUris: JSON.stringify(redirectUris) });

	return {
		client_id: clientId,
		client_id_issued_at: Math.floor(Date.now() / 1000),
		client_name: clientName,
		redirect_uris: redirectUris,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'none'
	};
}

export async function getClient(clientId: string) {
	const [client] = await getDb().select().from(oauthClientsTable).where(eq(oauthClientsTable.clientId, clientId));
	if (!client) return null;
	return { ...client, redirectUris: JSON.parse(client.redirectUris) as string[] };
}

export interface AuthorizeParams {
	clientId: string;
	redirectUri: string;
	state: string | null;
	codeChallenge: string;
	resource: string | null;
}

/**
 * 驗證 /oauth/authorize 的參數。client_id、redirect_uri 有問題時「不能」redirect 回去
 * （那正是要防的開放重導向），直接丟錯誤給授權頁顯示。
 */
export async function parseAuthorizeRequest(url: URL) {
	const params = url.searchParams;
	const clientId = params.get('client_id') ?? '';
	const redirectUri = params.get('redirect_uri') ?? '';
	const client = clientId ? await getClient(clientId) : null;
	if (!client) throw new OAuthError('invalid_client', '找不到這個應用程式，請回到原本的 app 重新連線');
	if (!client.redirectUris.includes(redirectUri)) throw new OAuthError('invalid_request', 'redirect_uri 跟註冊時的不一樣');

	if (params.get('response_type') !== 'code') throw new OAuthError('unsupported_response_type', '只支援 response_type=code');
	const codeChallenge = params.get('code_challenge') ?? '';
	if (!codeChallenge || params.get('code_challenge_method') !== 'S256') {
		throw new OAuthError('invalid_request', '必須使用 PKCE（code_challenge_method=S256）');
	}

	const request: AuthorizeParams = {
		clientId,
		redirectUri,
		state: params.get('state'),
		codeChallenge,
		resource: params.get('resource')
	};
	return { client, request };
}

export async function createAuthCode(userId: string, request: AuthorizeParams): Promise<string> {
	const code = randomToken();
	await getDb()
		.insert(oauthCodesTable)
		.values({
			codeHash: sha256(code),
			clientId: request.clientId,
			userId,
			redirectUri: request.redirectUri,
			codeChallenge: request.codeChallenge,
			resource: request.resource,
			expiresAt: secondsFromNow(AUTH_CODE_TTL_SECONDS)
		});
	return code;
}

async function issueTokens(clientId: string, userId: string, resource: string | null) {
	const accessToken = randomToken();
	const refreshToken = randomToken();
	await getDb()
		.insert(oauthTokensTable)
		.values([
			{
				tokenHash: sha256(accessToken),
				kind: 'access',
				clientId,
				userId,
				resource,
				expiresAt: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS)
			},
			{
				tokenHash: sha256(refreshToken),
				kind: 'refresh',
				clientId,
				userId,
				resource,
				expiresAt: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS)
			}
		]);
	return {
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: ACCESS_TOKEN_TTL_SECONDS,
		refresh_token: refreshToken
	};
}

function pkceMatches(verifier: string, challenge: string): boolean {
	return createHash('sha256').update(verifier).digest('base64url') === challenge;
}

/** /oauth/token 的兩種 grant。表單欄位照 RFC 6749 的名稱。 */
export async function exchangeToken(form: URLSearchParams) {
	const grantType = form.get('grant_type');
	const clientId = form.get('client_id') ?? '';
	const db = getDb();

	if (grantType === 'authorization_code') {
		const codeHash = sha256(form.get('code') ?? '');
		const [row] = await db.select().from(oauthCodesTable).where(eq(oauthCodesTable.codeHash, codeHash));
		// 不管成功與否都先刪掉：授權碼只能用一次。
		if (row) await db.delete(oauthCodesTable).where(eq(oauthCodesTable.codeHash, codeHash));
		if (!row || row.expiresAt < new Date()) throw new OAuthError('invalid_grant', '授權碼無效或已過期');
		if (row.clientId !== clientId) throw new OAuthError('invalid_grant', 'client_id 不符');
		if (row.redirectUri !== form.get('redirect_uri')) throw new OAuthError('invalid_grant', 'redirect_uri 不符');
		if (!pkceMatches(form.get('code_verifier') ?? '', row.codeChallenge)) throw new OAuthError('invalid_grant', 'PKCE 驗證失敗');
		const resource = form.get('resource') ?? row.resource;
		if (row.resource && resource !== row.resource) throw new OAuthError('invalid_target', 'resource 跟授權時的不一樣');
		return issueTokens(row.clientId, row.userId, resource);
	}

	if (grantType === 'refresh_token') {
		const tokenHash = sha256(form.get('refresh_token') ?? '');
		const [row] = await db
			.select()
			.from(oauthTokensTable)
			.where(and(eq(oauthTokensTable.tokenHash, tokenHash), eq(oauthTokensTable.kind, 'refresh')));
		if (row) await db.delete(oauthTokensTable).where(eq(oauthTokensTable.tokenHash, tokenHash));
		if (!row || row.expiresAt < new Date()) throw new OAuthError('invalid_grant', 'refresh token 無效或已過期');
		if (row.clientId !== clientId) throw new OAuthError('invalid_grant', 'client_id 不符');
		return issueTokens(row.clientId, row.userId, row.resource);
	}

	throw new OAuthError('unsupported_grant_type', '只支援 authorization_code 跟 refresh_token');
}

export interface VerifiedToken {
	userId: string;
	clientId: string;
	expiresAt: Date;
	resource: string | null;
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
	const [row] = await getDb()
		.select()
		.from(oauthTokensTable)
		.where(
			and(
				eq(oauthTokensTable.tokenHash, sha256(token)),
				eq(oauthTokensTable.kind, 'access'),
				gt(oauthTokensTable.expiresAt, new Date())
			)
		);
	if (!row) return null;
	return { userId: row.userId, clientId: row.clientId, expiresAt: row.expiresAt, resource: row.resource };
}
