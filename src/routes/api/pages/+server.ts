import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';
import { BLOG_EXAMPLE_DSL, BLOG_EXAMPLE_FILENAME } from '$lib/examples/blog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');

	const rows = await getDb()
		.select({ id: pagesTable.id, title: pagesTable.title, updatedAt: pagesTable.updatedAt })
		.from(pagesTable)
		.where(eq(pagesTable.userId, session.user.id))
		.orderBy(desc(pagesTable.updatedAt));

	return json(rows);
};

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');

	const db = getDb();
	const id = crypto.randomUUID();
	await db.insert(pagesTable).values({
		id,
		userId: session.user.id,
		title: '未命名',
		source: BLOG_EXAMPLE_DSL,
		fileName: BLOG_EXAMPLE_FILENAME
	});

	const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, id));
	return json(page);
};
