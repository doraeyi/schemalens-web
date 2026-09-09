import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pageVersionsTable } from '$lib/server/db/schema';
import { requireOwnedPage } from '../../+server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);

	const [version] = await getDb()
		.select()
		.from(pageVersionsTable)
		.where(and(eq(pageVersionsTable.id, event.params.versionId), eq(pageVersionsTable.pageId, event.params.id)));
	if (!version) error(404, '找不到這個版本');
	return json(version);
};

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	await requireOwnedPage(session.user.id, event.params.id);

	await getDb()
		.delete(pageVersionsTable)
		.where(and(eq(pageVersionsTable.id, event.params.versionId), eq(pageVersionsTable.pageId, event.params.id)));
	return json({ ok: true });
};
