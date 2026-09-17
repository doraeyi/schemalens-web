import { redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pageCollaboratorsTable, pagesTable } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

/**
 * 邀請連結的落地頁：沒登入先請登入（帶 callbackUrl 導回這裡），登入後用 token
 * 找到分頁、把自己加進 pageCollaboratorsTable（已經是協作者或本來就是擁有者就跳過），
 * 然後直接導去 /app?page=<id>。連結本身沒有到期時間，重新產生就會讓舊連結失效
 * （collabInviteToken 是單一欄位，換一個新的舊的自然比對不上）。
 */
export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { loggedIn: false as const, invalid: false as const };
	}

	const [page] = await getDb()
		.select()
		.from(pagesTable)
		.where(eq(pagesTable.collabInviteToken, event.params.token));
	if (!page || page.mode !== 'realtime') {
		return { loggedIn: true as const, invalid: true as const };
	}

	if (page.userId !== session.user.id) {
		const db = getDb();
		const [existing] = await db
			.select()
			.from(pageCollaboratorsTable)
			.where(and(eq(pageCollaboratorsTable.pageId, page.id), eq(pageCollaboratorsTable.userId, session.user.id)));
		if (!existing) {
			await db.insert(pageCollaboratorsTable).values({ pageId: page.id, userId: session.user.id });
		}
	}

	redirect(303, `/app?page=${page.id}`);
};
