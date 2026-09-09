import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pageVersionsTable } from '$lib/server/db/schema';
import { requireOwnedPage } from '$lib/server/pages';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);

	const rows = await getDb()
		.select({ id: pageVersionsTable.id, label: pageVersionsTable.label, createdAt: pageVersionsTable.createdAt })
		.from(pageVersionsTable)
		.where(eq(pageVersionsTable.pageId, event.params.id))
		.orderBy(desc(pageVersionsTable.createdAt));

	return json(rows);
};

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);

	const body = (await event.request.json().catch(() => ({}))) as { label?: string; source?: string; fileName?: string };
	const label = body.label?.trim() || `新版本 ${new Date().toLocaleString('zh-TW')}`;
	const source = typeof body.source === 'string' ? body.source : '';
	const fileName = typeof body.fileName === 'string' && body.fileName ? body.fileName : 'untitled.dbschema';

	const db = getDb();
	const id = crypto.randomUUID();
	await db.insert(pageVersionsTable).values({ id, pageId: event.params.id, label, source, fileName });

	const [version] = await db
		.select({ id: pageVersionsTable.id, label: pageVersionsTable.label, createdAt: pageVersionsTable.createdAt })
		.from(pageVersionsTable)
		.where(eq(pageVersionsTable.id, id));
	return json(version);
};
