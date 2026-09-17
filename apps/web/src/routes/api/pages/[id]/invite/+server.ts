import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { pagesTable } from '$lib/server/db/schema';
import { requireOwnedPage } from '$lib/server/pages';
import type { RequestHandler } from './$types';

/** 產生（或重新產生）一條邀請連結的 token——只有擁有者能做，只有即時協作分頁能做。 */
export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, '請先登入');
	const page = await requireOwnedPage(session.user.id, event.params.id);
	if (page.mode !== 'realtime') error(400, '只有即時協作分頁能產生邀請連結');

	const token = crypto.randomUUID();
	await getDb().update(pagesTable).set({ collabInviteToken: token }).where(eq(pagesTable.id, event.params.id));
	return json({ token });
};
