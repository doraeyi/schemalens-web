import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';
import { requireOwnedPage } from '$lib/server/pages';
import type { RequestHandler } from './$types';

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
