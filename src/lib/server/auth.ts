import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { accountsTable, sessionsTable, usersTable, verificationTokensTable } from '$lib/server/db/schema';

// Lazy config (a function, not a plain object) so getDb() — and therefore the
// mysql2 pool — is only constructed per-request, not when this module (and
// therefore hooks.server.ts) is first loaded. See db/index.ts for why that
// matters before DATABASE_URL is set.
export const { handle, signIn, signOut } = SvelteKitAuth(async () => ({
	adapter: DrizzleAdapter(getDb(), {
		usersTable,
		accountsTable,
		sessionsTable,
		verificationTokensTable
	}),
	providers: [
		GitHub({
			clientId: env.AUTH_GITHUB_ID,
			clientSecret: env.AUTH_GITHUB_SECRET
		})
	],
	// Falls back to a fixed dev-only string so local dev doesn't 500 before
	// AUTH_SECRET is configured. This fallback is not secret and must never
	// be what's actually used in production — set the real AUTH_SECRET as a
	// Vercel environment variable there, which always takes precedence.
	secret: env.AUTH_SECRET || 'dev-only-insecure-placeholder-secret-change-in-production',
	trustHost: true
}));
