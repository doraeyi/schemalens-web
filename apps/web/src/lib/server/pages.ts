import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';

/** 共用的「查分頁、順便驗證擁有者」helper——api/pages 底下的路由（含 versions 子路由）都靠這個。 */
export async function requireOwnedPage(userId: string, pageId: string) {
	const [page] = await getDb()
		.select()
		.from(pagesTable)
		.where(and(eq(pagesTable.id, pageId), eq(pagesTable.userId, userId)));
	if (!page) error(404, '找不到這個分頁');
	return page;
}
