import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pageCollaboratorsTable, pagesTable } from '$lib/server/db/schema';

/** 共用的「查分頁、順便驗證擁有者」helper——只有擁有者能做的動作用這個（刪分頁、產生邀請連結）。 */
export async function requireOwnedPage(userId: string, pageId: string) {
	const [page] = await getDb()
		.select()
		.from(pagesTable)
		.where(and(eq(pagesTable.id, pageId), eq(pagesTable.userId, userId)));
	if (!page) error(404, '找不到這個分頁');
	return page;
}

/**
 * 擁有者或協作者都算通過——讀取/編輯分頁內容（含即時協作）用這個，比 requireOwnedPage 寬鬆。
 * 二元權限，沒有唯讀/可編輯之分：能進來就代表能編輯。
 */
export async function requireAccessiblePage(userId: string, pageId: string) {
	const page = await findAccessiblePage(userId, pageId);
	if (!page) error(404, '找不到這個分頁');
	return page;
}

/** requireAccessiblePage 的不丟錯版本——不在 SvelteKit 路由裡的呼叫端（例如 MCP 工具）用這個，自己決定怎麼回報錯誤。 */
export async function findAccessiblePage(userId: string, pageId: string) {
	const [page] = await getDb().select().from(pagesTable).where(eq(pagesTable.id, pageId));
	if (!page) return null;
	if (page.userId === userId) return page;

	const [collaborator] = await getDb()
		.select()
		.from(pageCollaboratorsTable)
		.where(and(eq(pageCollaboratorsTable.pageId, pageId), eq(pageCollaboratorsTable.userId, userId)));
	return collaborator ? page : null;
}
