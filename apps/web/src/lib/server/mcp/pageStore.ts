import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { env } from '$env/dynamic/public';
import type { Schema } from '@schemalens/schema-core';
import { toDsl } from '@schemalens/schema-serializer';
import { getDb } from '$lib/server/db';
import { pageVersionsTable, pagesTable } from '$lib/server/db/schema';
import { loadSchemaFromText } from '$lib/schema/documentSchema';
import { allDocKeys, buildSchemaFromDoc, writeSchemaToDoc } from '$lib/collab/schemaDoc';

type PageRow = typeof pagesTable.$inferSelect;

const COLLAB_WS_URL = env.PUBLIC_COLLAB_WS_URL || 'ws://localhost:1234';
const COLLAB_SYNC_TIMEOUT_MS = 5000;

export interface PageSnapshot {
	schema: Schema;
	dsl: string;
	/** 目前內容的指紋——update 時要帶回來，對不上代表 AI 讀完之後有人改過，拒絕寫入。 */
	revision: string;
}

export class StaleRevisionError extends Error {}

function snapshotOf(schema: Schema): PageSnapshot {
	const dsl = toDsl(schema);
	return { schema, dsl, revision: createHash('sha256').update(dsl).digest('hex').slice(0, 16) };
}

function snapshotFromRow(page: PageRow): PageSnapshot {
	return snapshotOf(loadSchemaFromText(page.source, page.fileName).schema);
}

interface CollabDoc {
	doc: Y.Doc;
	/** 等剛寫進去的更新送出去再關連線，不然 serverless 函式結束時更新可能還卡在 socket buffer 裡。 */
	close(): Promise<void>;
}

/** 以一個臨時協作者的身分連上即時協作房間（房間名就是 pageId），等初次同步完成才回傳。 */
async function openCollabDoc(room: string): Promise<CollabDoc> {
	const doc = new Y.Doc();
	const provider = new WebsocketProvider(COLLAB_WS_URL, room, doc, {
		WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
		disableBc: true
	});

	try {
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('連不上即時協作伺服器，請稍後再試')), COLLAB_SYNC_TIMEOUT_MS);
			provider.once('sync', (isSynced: boolean) => {
				if (!isSynced) return;
				clearTimeout(timer);
				resolve();
			});
		});
	} catch (error) {
		provider.destroy();
		doc.destroy();
		throw error;
	}

	return {
		doc,
		async close() {
			const socket = provider.ws as unknown as WebSocket | null;
			for (let i = 0; i < 40 && socket && socket.bufferedAmount > 0; i++) {
				await new Promise((r) => setTimeout(r, 50));
			}
			provider.destroy();
			doc.destroy();
		}
	};
}

/**
 * 即時協作分頁以協作房間的內容為準（資料庫那份是各個 client 存回來的，可能落後一點）；
 * 房間裡沒人、內容已經被 relay 釋放掉時，退回資料庫。
 */
export async function readPage(page: PageRow): Promise<PageSnapshot & { note?: string }> {
	if (page.mode !== 'realtime') return snapshotFromRow(page);
	// 只讀的話 relay 暫時連不上就退回資料庫；寫入（writePage）不退，見那邊的說明。
	const collab = await openCollabDoc(page.id).catch(() => null);
	if (!collab) {
		return { ...snapshotFromRow(page), note: '即時協作伺服器暫時連不上，這份內容取自資料庫，可能不是最新的；現在也無法修改這個分頁。' };
	}
	try {
		const live = buildSchemaFromDoc(collab.doc);
		return live ? snapshotOf(live) : snapshotFromRow(page);
	} finally {
		await collab.close();
	}
}

async function saveVersionBeforeChange(page: PageRow, previous: PageSnapshot, summary: string): Promise<void> {
	await getDb()
		.insert(pageVersionsTable)
		.values({
			id: crypto.randomUUID(),
			pageId: page.id,
			label: `AI 修改前：${summary}`.slice(0, 255),
			source: previous.dsl,
			fileName: page.fileName
		});
}

/**
 * 把分頁整份換成 next。baseRevision 必須跟目前內容一致，否則丟 StaleRevisionError。
 * 寫入前一律先存一個版本快照，使用者可以從「歷史」還原。
 * 回傳修改前的快照（給呼叫端算 diff）跟修改後的快照。
 */
export async function writePage(
	page: PageRow,
	baseRevision: string,
	next: Schema,
	summary: string
): Promise<{ before: PageSnapshot; after: PageSnapshot }> {
	const after = snapshotOf(next);
	const db = getDb();

	if (page.mode !== 'realtime') {
		const before = snapshotFromRow(page);
		if (before.revision !== baseRevision) throw new StaleRevisionError();
		await saveVersionBeforeChange(page, before, summary);
		// 條件式更新：讀完到寫入之間瀏覽器剛好自動存檔的話，這裡會更新 0 列，一樣當作過期處理。
		const [result] = await db
			.update(pagesTable)
			.set({ source: after.dsl })
			.where(and(eq(pagesTable.id, page.id), eq(pagesTable.source, page.source)));
		if (result.affectedRows === 0) throw new StaleRevisionError();
		return { before, after };
	}

	// 連不上 relay 就不寫：只改資料庫的話，房間裡斷線中的協作者重新連上時會把他手上的舊內容同步回去，
	// 再經由自動存檔把 AI 的修改蓋掉。openCollabDoc 連不上會直接丟錯，工具會把訊息回給 AI。
	const collab = await openCollabDoc(page.id);
	try {
		const live = buildSchemaFromDoc(collab.doc);
		const before = live ? snapshotOf(live) : snapshotFromRow(page);
		if (before.revision !== baseRevision) throw new StaleRevisionError();
		await saveVersionBeforeChange(page, before, summary);
		// 整份替換：以房間目前所有的 key 當 previous，新 schema 沒有的 key 就刪掉。
		writeSchemaToDoc(collab.doc, next, allDocKeys(collab.doc));
		// 資料庫也要一起更新——之後有人從資料庫載入再加入房間時，會把他載入的內容補推上去，
		// 資料庫是舊的就會把 AI 剛改的東西蓋回去。
		await db.update(pagesTable).set({ source: after.dsl }).where(eq(pagesTable.id, page.id));
		return { before, after };
	} finally {
		await collab.close();
	}
}

export async function createPage(userId: string, title: string, next: Schema): Promise<PageRow> {
	const db = getDb();
	const id = crypto.randomUUID();
	await db.insert(pagesTable).values({ id, userId, title: title.slice(0, 255), source: toDsl(next), mode: 'normal' });
	const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, id));
	return page;
}
