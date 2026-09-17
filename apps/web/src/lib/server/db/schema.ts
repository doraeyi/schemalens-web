import {
	int,
	longtext,
	mysqlEnum,
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
	/** 建立時就固定，這版不支援中途切換：一般模式（手動存版本）或即時協作模式（Yjs）。 */
	mode: mysqlEnum('mode', ['normal', 'realtime']).notNull().default('normal'),
	/** 即時協作分頁的邀請連結 token——擁有者按「邀請協作者」才會產生／重新產生，沒產生過是 null。 */
	collabInviteToken: varchar('collabInviteToken', { length: 191 }).unique(),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
	updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow()
});

/**
 * 分頁的版本快照——使用者手動存的，不是自動存的，存好就不會再改
 * （沒有 updatedAt，這點跟 pagesTable 不一樣）。cascade 刪除：分頁被刪掉時
 * 底下的版本歷史一起清掉，不留孤兒資料。
 */
export const pageVersionsTable = mysqlTable('page_versions', {
	id: varchar('id', { length: 191 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	pageId: varchar('pageId', { length: 191 })
		.notNull()
		.references(() => pagesTable.id, { onDelete: 'cascade' }),
	label: varchar('label', { length: 255 }).notNull(),
	source: longtext('source').notNull(),
	fileName: varchar('fileName', { length: 255 }).notNull(),
	createdAt: timestamp('createdAt').notNull().defaultNow()
});

/**
 * 即時協作分頁的存取權紀錄——透過邀請連結加入一次之後就留在這裡，之後不用重新點連結
 * 也能在自己的側欄看到這個分頁。只有「能不能進來」的二元權限，沒有角色欄位。
 * cascade 刪除：分頁或使用者任一邊被刪掉，紀錄一起清掉。
 */
export const pageCollaboratorsTable = mysqlTable(
	'page_collaborators',
	{
		pageId: varchar('pageId', { length: 191 })
			.notNull()
			.references(() => pagesTable.id, { onDelete: 'cascade' }),
		userId: varchar('userId', { length: 255 })
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		createdAt: timestamp('createdAt').notNull().defaultNow()
	},
	(collaborator) => ({
		compositePk: primaryKey({ columns: [collaborator.pageId, collaborator.userId] })
	})
);
