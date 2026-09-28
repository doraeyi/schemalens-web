import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { parseSchema } from '@schemalens/schema-parser';
import { toDsl } from '@schemalens/schema-serializer';
import { allDocKeys, buildSchemaFromDoc, emptyPushedKeys, writeSchemaToDoc } from '../src/lib/collab/schemaDoc';

function schemaOf(dsl: string) {
	return parseSchema(dsl, 'test.dbschema').schema;
}

const BASE = `
table Users {
  PK Id    bigint        not null
     Email nvarchar(255) not null
}

table Orders {
  PK Id     bigint not null
     UserId bigint not null
}

relation Orders.UserId > Users.Id
`;

describe('schemaDoc', () => {
	it('寫進去再組回來，內容一致', () => {
		const doc = new Y.Doc();
		const schema = schemaOf(BASE);
		writeSchemaToDoc(doc, schema, emptyPushedKeys());
		expect(toDsl(buildSchemaFromDoc(doc)!)).toBe(toDsl(schema));
	});

	it('// 註解跟省略的 schema 前綴經過協作文件也會保留', () => {
		const doc = new Y.Doc();
		const source = `// 使用者\ntable Users { // 表頭\n  PK Id bigint not null // 主鍵\n  // 待補\n}\n\n// 結尾\n`;
		const schema = schemaOf(source);
		writeSchemaToDoc(doc, schema, emptyPushedKeys());
		const dsl = toDsl(buildSchemaFromDoc(doc)!);
		expect(dsl).toBe(toDsl(schema));
		for (const text of ['// 使用者', '// 表頭', '// 主鍵', '// 待補', '// 結尾']) expect(dsl).toContain(text);
		expect(dsl).not.toContain('dbo.');
	});

	it('空文件組不出 schema', () => {
		expect(buildSchemaFromDoc(new Y.Doc())).toBeNull();
	});

	it('以 allDocKeys 當 previous 整份替換時，新 schema 沒有的表、欄位、關聯都會被刪掉', () => {
		const doc = new Y.Doc();
		writeSchemaToDoc(doc, schemaOf(BASE), emptyPushedKeys());

		const next = schemaOf(`
table Users {
  PK Id          bigint        not null
     DisplayName nvarchar(100) null
}
`);
		writeSchemaToDoc(doc, next, allDocKeys(doc));
		expect(toDsl(buildSchemaFromDoc(doc)!)).toBe(toDsl(next));
	});

	it('previous 沒有的 key 不會被刪——別人剛推上去、自己還沒看到的東西不能被誤刪', () => {
		const doc = new Y.Doc();
		const mine = schemaOf(BASE);
		const pushed = writeSchemaToDoc(doc, mine, emptyPushedKeys());

		// 另一個協作者新增了一張表
		const theirs = schemaOf(`${BASE}\ntable Products {\n  PK Id bigint not null\n}\n`);
		writeSchemaToDoc(doc, theirs, emptyPushedKeys());

		// 我這邊還是舊內容，再推一次：Products 不在我的 previous 裡，所以要留著
		writeSchemaToDoc(doc, mine, pushed);
		expect(buildSchemaFromDoc(doc)!.tables.map((t) => t.name).sort()).toEqual(['Orders', 'Products', 'Users']);
	});

	it('兩份文件互相同步後內容一致（模擬瀏覽器跟伺服器端透過 relay 交換更新）', () => {
		const browser = new Y.Doc();
		const server = new Y.Doc();
		browser.on('update', (update: Uint8Array) => Y.applyUpdate(server, update));
		server.on('update', (update: Uint8Array) => Y.applyUpdate(browser, update));

		writeSchemaToDoc(browser, schemaOf(BASE), emptyPushedKeys());
		const next = schemaOf(BASE.replace('Email nvarchar(255) not null', 'Email nvarchar(320) not null'));
		writeSchemaToDoc(server, next, allDocKeys(server));

		expect(toDsl(buildSchemaFromDoc(browser)!)).toBe(toDsl(next));
	});
});
