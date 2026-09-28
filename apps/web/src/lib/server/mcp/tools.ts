import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { validateSchema, type Schema } from '@schemalens/schema-core';
import { parseSchema } from '@schemalens/schema-parser';
import { getDb } from '$lib/server/db';
import { pageCollaboratorsTable, pagesTable } from '$lib/server/db/schema';
import { findAccessiblePage } from '$lib/server/pages';
import { lintSchema } from '@schemalens/schema-lint';
import { diffSchemas, type SchemaDiff } from '@schemalens/schema-diff';
import { createPage, readPage, StaleRevisionError, writePage } from './pageStore';
// skill 裡給 agent 看的 DSL 語法說明，跟 Claude Code plugin 用同一份，不另外維護。
import dslReference from '../../../../../../plugins/schemalens-vscode-extension/skills/database-schema-visualization/references/dsl-syntax.md?raw';

const INSTRUCTIONS = `SchemaLens 是一個資料庫 schema 視覺化工具，每個「分頁」是一份用 DBSchema DSL 寫的 schema。
這組工具讓你直接讀取、檢查、修改使用者在 SchemaLens 上的分頁，修改會即時出現在使用者的畫布上。

建議流程：
1. list_pages 找到使用者說的分頁（不確定是哪一個時問使用者）。
2. get_schema 讀出目前的 DSL 跟 revision；get_issues 看有哪些問題。
3. 第一次要寫 DSL 之前先呼叫 get_dsl_reference，語法有精確的規則。
4. update_schema 送出「完整的」新 DSL，並帶上剛剛讀到的 revision。revision 對不上代表有人剛改過，重新 get_schema 再改。
5. 每次修改前 SchemaLens 都會自動存一個版本快照，告訴使用者可以從「歷史」還原。

使用者要設計一份全新的 schema 時用 create_page。回覆時附上工具回傳的分頁連結。`;

function text(value: unknown): CallToolResult {
	return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
	return { content: [{ type: 'text', text: message }], isError: true };
}

function issuesOf(schema: Schema) {
	const validation = validateSchema(schema).map((d) => ({
		code: d.code,
		severity: d.severity,
		message: d.message,
		...(d.location ? { line: d.location.line, column: d.location.column } : {})
	}));
	const lint = lintSchema(schema).map((w) => ({
		code: w.code,
		severity: w.severity,
		message: w.message,
		...(w.location ? { table: w.location.tableId, ...(w.location.column ? { column: w.location.column } : {}) } : {})
	}));
	return [...validation, ...lint];
}

function describeDiff(diff: SchemaDiff): string[] {
	const lines: string[] = [];
	for (const t of diff.addedTables) lines.push(`新增資料表 ${t.id}`);
	for (const t of diff.removedTables) lines.push(`刪除資料表 ${t.id}`);
	for (const t of diff.changedTables) {
		const parts = [
			...t.addedColumns.map((c) => `+${c.name}`),
			...t.removedColumns.map((c) => `-${c.name}`),
			...t.changedColumns.map((c) => `~${c.name}(${c.changedFields.join(',')})`)
		];
		lines.push(`${t.tableId}：${parts.join(' ')}`);
	}
	for (const r of diff.addedRelations) lines.push(`新增關聯 ${r.sourceTable} → ${r.targetTable}`);
	for (const r of diff.removedRelations) lines.push(`刪除關聯 ${r.sourceTable} → ${r.targetTable}`);
	return lines;
}

/** DSL 解析失敗（有 error 等級的診斷）時回傳給 AI 的錯誤訊息，讓它修正後重送。 */
function parseDsl(dsl: string): { schema: Schema } | { error: CallToolResult } {
	const parsed = parseSchema(dsl, 'schema.dbschema');
	const errors = [...parsed.diagnostics, ...validateSchema(parsed.schema)].filter((d) => d.severity === 'error');
	if (errors.length === 0) return { schema: parsed.schema };
	return {
		error: fail(
			`DSL 有錯誤，沒有寫入。修正後重新送出：\n${errors
				.map((d) => `- ${d.code}${d.location ? ` (${d.location.line}:${d.location.column})` : ''}: ${d.message}`)
				.join('\n')}`
		)
	};
}

/** 每個請求建一個新的 server，userId 用閉包帶進工具裡——stateless 模式，不需要跨請求保存任何東西。 */
export function createSchemaLensMcpServer(userId: string, origin: string): McpServer {
	const server = new McpServer({ name: 'schemalens', version: '1.0.0' }, { instructions: INSTRUCTIONS });
	const pageUrl = (pageId: string) => `${origin}/app?page=${pageId}`;

	async function loadPage(pageId: string) {
		const page = await findAccessiblePage(userId, pageId);
		if (!page) return null;
		return page;
	}

	server.registerTool(
		'list_pages',
		{
			title: '列出分頁',
			description: '列出使用者在 SchemaLens 上可以存取的所有分頁（自己的，加上被邀請協作的），最近編輯的在前面。',
			annotations: { readOnlyHint: true }
		},
		async () => {
			const db = getDb();
			const columns = { id: pagesTable.id, title: pagesTable.title, mode: pagesTable.mode, updatedAt: pagesTable.updatedAt };
			const [owned, shared] = await Promise.all([
				db.select(columns).from(pagesTable).where(eq(pagesTable.userId, userId)),
				db
					.select(columns)
					.from(pageCollaboratorsTable)
					.innerJoin(pagesTable, eq(pageCollaboratorsTable.pageId, pagesTable.id))
					.where(eq(pageCollaboratorsTable.userId, userId))
			]);
			const pages = [
				...owned.map((p) => ({ ...p, role: 'owner' })),
				...shared.map((p) => ({ ...p, role: 'collaborator' }))
			]
				.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
				.map((p) => ({ ...p, url: pageUrl(p.id) }));
			return text(pages);
		}
	);

	server.registerTool(
		'get_schema',
		{
			title: '讀取分頁的 schema',
			description: '讀取一個分頁目前的完整 DSL 跟 revision。要修改之前一定要先呼叫這個，update_schema 需要這裡回傳的 revision。',
			inputSchema: { page_id: z.string().describe('list_pages 回傳的分頁 id') },
			annotations: { readOnlyHint: true }
		},
		async ({ page_id }) => {
			const page = await loadPage(page_id);
			if (!page) return fail('找不到這個分頁，或你沒有權限。');
			const snapshot = await readPage(page);
			return text({
				page_id: page.id,
				title: page.title,
				url: pageUrl(page.id),
				revision: snapshot.revision,
				tables: snapshot.schema.tables.length,
				relations: snapshot.schema.relations.length,
				...(snapshot.note ? { note: snapshot.note } : {}),
				dsl: snapshot.dsl
			});
		}
	);

	server.registerTool(
		'get_issues',
		{
			title: '檢查分頁的問題',
			description:
				'列出一個分頁的結構錯誤跟最佳實踐警告：缺 Primary Key、外鍵沒有 index、命名風格不一致、型別關鍵字誤黏進欄位名、空的資料表等。跟 SchemaLens 畫面上顯示的問題清單是同一份。',
			inputSchema: { page_id: z.string() },
			annotations: { readOnlyHint: true }
		},
		async ({ page_id }) => {
			const page = await loadPage(page_id);
			if (!page) return fail('找不到這個分頁，或你沒有權限。');
			const snapshot = await readPage(page);
			const issues = issuesOf(snapshot.schema);
			return text({
				page_id: page.id,
				revision: snapshot.revision,
				...(snapshot.note ? { note: snapshot.note } : {}),
				count: issues.length,
				issues
			});
		}
	);

	server.registerTool(
		'get_dsl_reference',
		{
			title: 'DSL 語法說明',
			description: 'DBSchema DSL 的完整語法規則。第一次撰寫或修改 DSL 之前先讀這個。',
			annotations: { readOnlyHint: true }
		},
		async () => text(dslReference)
	);

	server.registerTool(
		'update_schema',
		{
			title: '修改分頁的 schema',
			description:
				'把分頁整份換成新的 DSL。必須送「完整的」DSL（不是片段），並帶上 get_schema 拿到的 revision。' +
				'寫入前會自動存一個版本快照；DSL 有語法錯誤時不會寫入，會回傳錯誤讓你修正。修改會即時出現在使用者的畫布上。',
			inputSchema: {
				page_id: z.string(),
				base_revision: z.string().describe('get_schema 回傳的 revision'),
				dsl: z.string().describe('修改後的完整 DSL'),
				summary: z.string().max(200).describe('一句話說明這次改了什麼，會當成版本快照的名稱')
			},
			annotations: { destructiveHint: true, idempotentHint: false }
		},
		async ({ page_id, base_revision, dsl, summary }) => {
			const page = await loadPage(page_id);
			if (!page) return fail('找不到這個分頁，或你沒有權限。');
			const parsed = parseDsl(dsl);
			if ('error' in parsed) return parsed.error;
			try {
				const { before, after } = await writePage(page, base_revision, parsed.schema, summary);
				const changes = describeDiff(diffSchemas(before.schema, after.schema));
				const issues = issuesOf(after.schema);
				return text({
					ok: true,
					url: pageUrl(page.id),
					revision: after.revision,
					changes: changes.length > 0 ? changes : ['沒有結構上的變化'],
					remaining_issues: issues.length,
					issues
				});
			} catch (error) {
				if (error instanceof StaleRevisionError) {
					return fail('這個分頁在你讀取之後被修改過了（可能是使用者或協作者）。請重新 get_schema，在最新內容上再改一次。');
				}
				throw error;
			}
		}
	);

	server.registerTool(
		'create_page',
		{
			title: '建立新分頁',
			description: '用一份 DSL 建立新的 SchemaLens 分頁，適合使用者要從頭設計一份新 schema 的時候。',
			inputSchema: {
				title: z.string().min(1).max(255),
				dsl: z.string().describe('完整的 DSL')
			},
			annotations: { destructiveHint: false }
		},
		async ({ title, dsl }) => {
			const parsed = parseDsl(dsl);
			if ('error' in parsed) return parsed.error;
			const page = await createPage(userId, title, parsed.schema);
			const issues = issuesOf(parsed.schema);
			return text({ ok: true, page_id: page.id, url: pageUrl(page.id), issues_count: issues.length, issues });
		}
	);

	return server;
}
