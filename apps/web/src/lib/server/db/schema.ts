import {
	int,
	longtext,
	mysqlTable,
	primaryKey,
	timestamp,
	varchar
} from 'drizzle-orm/mysql-core';
import type { AdapterAccountType } from '@auth/core/adapters';

/**
 * Auth.js's own tables, hand-defined to match exactly what
 * `@auth/drizzle-adapter`'s MySQL adapter expects (its `defineTables()`
 * helper isn't part of the package's public `exports`, so we can't import
 * it — this mirrors that same shape) and passed back into `DrizzleAdapter(db, { ... })`
 * in `src/lib/server/auth.ts`. WebAuthn's `authenticator` table is omitted —
 * this app only uses the GitHub OAuth provider, no passkeys.
 */
export const usersTable = mysqlTable('user', {
	id: varchar('id', { length: 255 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: varchar('name', { length: 255 }),
	email: varchar('email', { length: 255 }).unique(),
	emailVerified: timestamp('emailVerified', { mode: 'date', fsp: 3 }),
	image: varchar('image', { length: 255 })
});

export const accountsTable = mysqlTable(
	'account',
	{
		userId: varchar('userId', { length: 255 })
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		type: varchar('type', { length: 255 }).$type<AdapterAccountType>().notNull(),
		provider: varchar('provider', { length: 255 }).notNull(),
		providerAccountId: varchar('providerAccountId', { length: 255 }).notNull(),
		refresh_token: varchar('refresh_token', { length: 255 }),
		access_token: varchar('access_token', { length: 255 }),
		expires_at: int('expires_at'),
		token_type: varchar('token_type', { length: 255 }),
		scope: varchar('scope', { length: 255 }),
		id_token: varchar('id_token', { length: 2048 }),
		session_state: varchar('session_state', { length: 255 })
	},
	(account) => ({
		compositePk: primaryKey({ columns: [account.provider, account.providerAccountId] })
	})
);

export const sessionsTable = mysqlTable('session', {
	sessionToken: varchar('sessionToken', { length: 255 }).primaryKey(),
	userId: varchar('userId', { length: 255 })
		.notNull()
		.references(() => usersTable.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokensTable = mysqlTable(
	'verificationToken',
	{
		identifier: varchar('identifier', { length: 255 }).notNull(),
		token: varchar('token', { length: 255 }).notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(vt) => ({
		compositePk: primaryKey({ columns: [vt.identifier, vt.token] })
	})
);

/** One schema project/document per row — this is the "Notion page" the sidebar lists. */
export const pagesTable = mysqlTable('pages', {
	id: varchar('id', { length: 191 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: varchar('userId', { length: 255 })
		.notNull()
		.references(() => usersTable.id, { onDelete: 'cascade' }),
	title: varchar('title', { length: 255 }).notNull().default('未命名'),
	source: longtext('source').notNull(),
	fileName: varchar('fileName', { length: 255 }).notNull().default('untitled.dbschema'),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
	updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow()
});
