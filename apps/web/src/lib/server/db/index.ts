import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Lazy on purpose: DATABASE_URL isn't set yet in this environment (waiting on
// the user's connection string). mysql2's createPool() parses the URL
// synchronously and throws on an empty string, and SvelteKit's build step
// loads every server module to analyse it — constructing the pool eagerly at
// module scope would break `pnpm build` before a real URL is provided.
//
// The placeholder URL below is only there so createPool() has something
// syntactically valid to parse — it never actually connects until a query
// runs. That matters because Auth.js's lazy config calls getDb() to build
// the adapter on *every* request, including guests with no session cookie;
// those never touch the adapter's actual query methods, so they must not
// fail just because getDb() was called. Only a real query (e.g. someone
// actually signs in) would hit the network and fail with a clear connection
// error until DATABASE_URL is configured for real.
let cached: MySql2Database<typeof schema> | undefined;

export function getDb(): MySql2Database<typeof schema> {
	if (!cached) {
		const pool = mysql.createPool(env.DATABASE_URL || 'mysql://unset:unset@localhost:3306/unset');
		cached = drizzle(pool, { schema, mode: 'default' });
	}
	return cached;
}
