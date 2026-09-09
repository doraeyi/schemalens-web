import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';
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

	// 訪客先匯入/編輯了東西、還沒有任何分頁時按「新增分頁」，帶的是他當下畫布的內容——
	// 這樣「登入 → 幫他建立第一個分頁」才不會把手上的東西弄丟。已經有分頁在編輯時
	// 再按「+」加另一個，前端不會帶這個 body，維持真的空白。
	const body = await event.request.json().catch(() => ({}));
	const source = typeof body.source === 'string' ? body.source : '';
	const fileName = typeof body.fileName === 'string' && body.fileName ? body.fileName : 'untitled.dbschema';

	const db = getDb();
	const id = crypto.randomUUID();
	await db.insert(pagesTable).values({
		id,
		userId: session.user.id,
		title: '未命名',
		source,
		fileName
	});

	const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, id));
	return json(page);
};
