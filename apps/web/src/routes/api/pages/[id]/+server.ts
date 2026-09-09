import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

async function requireOwnedPage(userId: string, pageId: string) {
	const [page] = await getDb()
		.select()
		.from(pagesTable)
		.where(and(eq(pagesTable.id, pageId), eq(pagesTable.userId, userId)));
	if (!page) error(404, '找不到這個分頁');
	return page;
}

export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	const page = await requireOwnedPage(session.user.id, event.params.id);
	return json(page);
};

export const PATCH: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);

	const body = (await event.request.json()) as { title?: string; source?: string; fileName?: string };
	const patch: Partial<typeof pagesTable.$inferInsert> = {};
	if (typeof body.title === 'string') patch.title = body.title;
	if (typeof body.source === 'string') patch.source = body.source;
	if (typeof body.fileName === 'string') patch.fileName = body.fileName;

	const db = getDb();
	if (Object.keys(patch).length > 0) {
		await db.update(pagesTable).set(patch).where(eq(pagesTable.id, event.params.id));
	}

	const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, event.params.id));
	return json(page);
};

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);
	await getDb().delete(pagesTable).where(eq(pagesTable.id, event.params.id));
	return json({ ok: true });
};
