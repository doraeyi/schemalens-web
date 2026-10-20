import type { Locale } from '$lib/i18n/locale';

/**
 * DSL 語法文件的文案（中文 / 英文），版面在 routes/docs/+page.svelte。
 * 內容以 docs/dsl-spec.md 為準（那份是 Parser 的契約），改語法時三邊要一起改。
 * 段落裡用反引號包起來的字會顯示成 <code>，見 inlineCode()。
 */
export interface DocsCopy {
	htmlTitle: string;
	metaDescription: string;
	homeLabel: string;
	navTitle: string;
	themeToggle: string;
	openApp: string;
	otherLang: string;
	tocLabel: string;
	tocHeading: string;
	copyLabel: string;
	copy: string;
	copied: string;
	toc: Record<SectionId, string>;
	title: string;
	lede: string;
	quickStart: { intro: string; outro: string };
	tables: { body: string };
	columns: { body: string; flagsTitle: string; flagsHead: [string, string]; rulesTitle: string; rulesHead: [string, string] };
	groups: { body: string; outro: string };
	indexes: { body: string };
	relations: { body: string; head: [string, string]; note: string };
	formats: { sql: string; markdown: string; json: string };
	shortcuts: { body: string; head: [string, string] };
	diagnostics: { body: string; head: [string, string] };
	backHome: string;
	tryIt: string;
	code: Record<'quick' | 'table' | 'columns' | 'groups' | 'indexes' | 'relations' | 'markdown' | 'sql', string>;
	flags: [string, string][];
	columnRules: [string, string][];
	cardinalities: [string, string][];
	shortcutRows: [string, string][];
	diagnosticRows: [string, string][];
}

export type SectionId = 'quick-start' | 'tables' | 'columns' | 'groups' | 'indexes' | 'relations' | 'formats' | 'shortcuts' | 'diagnostics';

export const SECTION_IDS: SectionId[] = ['quick-start', 'tables', 'columns', 'groups', 'indexes', 'relations', 'formats', 'shortcuts', 'diagnostics'];

const SQL_SAMPLE = `CREATE TABLE users (
  id    bigint PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE orders (
  id      bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id)
);`;

const INDEX_SAMPLE = `index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)
unique index UX_Users_Email on Users(Email)`;

export const DOCS_COPY: Record<Locale, DocsCopy> = {
	'zh-hant': {
		htmlTitle: 'DSL 語法 — SchemaLens',
		metaDescription: 'SchemaLens DSL 語法：資料表、欄位、群組、索引、關聯，以及 SQL、JSON、Markdown 匯入。',
		homeLabel: 'SchemaLens 首頁',
		navTitle: '文件',
		themeToggle: '切換深色／淺色',
		openApp: '打開工作區',
		otherLang: 'English',
		tocLabel: '本頁目錄',
		tocHeading: '本頁',
		copyLabel: '複製這段範例',
		copy: '複製',
		copied: '已複製',
		toc: {
			'quick-start': '快速開始',
			tables: '資料表',
			columns: '欄位',
			groups: '群組',
			indexes: '索引',
			relations: '關聯',
			formats: '其他格式',
			shortcuts: '快捷鍵',
			diagnostics: '錯誤與建議'
		},
		title: 'DSL 語法',
		lede: '`.dbschema` 是一種一看就懂的資料庫結構寫法：一行一個欄位，關聯單獨宣告。寫好之後在工作區貼上，或在 VS Code 打開，就會畫出關聯圖。',
		quickStart: {
			intro: '兩張表加一條外鍵關聯，就是一張最小的關聯圖。複製下面這段，到工作區按「匯入」貼上試試。',
			outro: '重點只有三個：`table` 宣告資料表、每行一個欄位、`relation` 宣告關聯。`//` 之後是註解。'
		},
		tables: {
			body: '`table 名稱 "說明" { … }`。名稱前面可以加 schema（`sales.Orders`），省略時是 `dbo`；說明字串可有可無，會顯示在卡片標題旁。名稱大小寫有別，關鍵字不分大小寫。'
		},
		columns: {
			body: '格式是 `[標記] 名稱 型別 [null | not null] [default 值] ["備註"]`，一行一個。欄位對齊只是為了好讀，空白數量不影響。',
			flagsTitle: '標記',
			flagsHead: ['標記', '意思'],
			rulesTitle: '規則',
			rulesHead: ['情況', '怎麼解讀']
		},
		groups: {
			body: '群組是你自己定的功能分類（例如「訂單」「會員」），跟資料庫的 schema 是兩回事，可以跨 schema。同一群組的表會排在一起、用同一個顏色，工具列也可以只看某個群組。',
			outro: '一張表只能屬於一個群組。`table X in G` 而 G 沒宣告時，會自動當成一個沒有說明的群組。'
		},
		indexes: { body: '索引獨立宣告；複合索引照你列的順序保存。外鍵欄位沒有索引時，工作區會給一個建議（不影響圖表）。' },
		relations: {
			body: '箭頭左邊是持有外鍵的一方，右邊是被參照的一方：`Posts.AuthorId N -> 1 Users.Id` 讀作「很多篇 Posts 對到一個 User」。這個方向也決定了聚焦時的「上游／下游」。',
			head: ['寫法', '意思'],
			note: '欄位上的 `FK` 標記不會自動產生關聯；圖上的線一律來自 `relation`。'
		},
		formats: {
			sql: '工作區的「匯入 → SQL」可以直接貼 `CREATE TABLE`，支援 MySQL、SQL Server、PostgreSQL、SQLite。欄位上的 `REFERENCES` 和表層級的 `FOREIGN KEY` 都會變成關聯；匯入後存成 DSL。VS Code 裡用「DBSchema: Import SQL as .dbschema」。',
			markdown: '檔名用 `.schema.md`，把 DSL 放在語言標成 `dbschema` 的程式碼區塊裡，文件跟結構可以寫在同一份。',
			json: '檔名用 `.schema.json`。這是工作區「匯出」產生的完整結構，適合給程式讀寫或備份。'
		},
		shortcuts: { body: '網頁版跟 VS Code 插件通用，標「網頁版」的只有網頁版有。', head: ['按鍵', '做什麼'] },
		diagnostics: {
			body: '`SCHEMA_*` 是會讓圖畫不正確的錯誤，`LINT_*` 只是設計上的建議。解析錯誤不會讓整份檔案失敗：看得懂的部分照樣畫出來，看不懂的那行列在問題清單裡，並標出行與列。',
			head: ['代碼', '意思與處理']
		},
		backHome: '回首頁',
		tryIt: '打開工作區，貼上試試',
		code: {
			quick: `table Users {
  PK Id    bigint        not null
     Email nvarchar(255) not null "登入 Email"
}

table Orders {
  PK Id     bigint not null
  FK UserId bigint not null
}

relation FK_Orders_Users {
  Orders.UserId N -> 1 Users.Id
}`,
			table: `table Users "系統使用者" {
  PK Id bigint not null "使用者 ID"
}

// 帶 schema 的寫法；省略時是 dbo
table sales.Orders {
  PK Id bigint not null
}`,
			columns: `table Products {
  PK  Id        bigint         not null "商品 ID"
  UQ  Sku       nvarchar(64)   not null
      Name      nvarchar(200)  not null
      Price     decimal(18,2)  not null default 0
      Note      nvarchar(4000) null     "備註"
      IsActive  bit            not null default 1
}`,
			groups: `// 一、集中宣告並列出成員
group Identity "身分與權限" {
  Users
  Roles
}

// 二、描述集中宣告，成員標在各自的 table 上
group Sales "訂單與金流"

table Orders in Sales {
  PK Id bigint not null
}`,
			indexes: INDEX_SAMPLE,
			relations: `relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}

// 複合外鍵
relation FK_OrderLines_Orders {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}`,
			markdown: '# 訂單模組\n\n```dbschema\ntable Orders {\n  PK Id bigint not null\n}\n```',
			sql: SQL_SAMPLE
		},
		flags: [
			['PK', '主鍵，隱含 not null'],
			['FK', '外鍵標記；只是視覺標記，關聯要用 relation 宣告'],
			['UQ', '唯一'],
			['IDX', '有索引的標記；真正的索引用 index 語句']
		],
		columnRules: [
			['可以同時有好幾個標記', 'PK UQ Id bigint'],
			['沒寫 null / not null', '預設可為空（PK 例外）'],
			['型別一個參數', '長度，例如 nvarchar(255)'],
			['型別兩個參數', '精度與小數位，例如 decimal(18,2)'],
			['行尾的字串', '欄位備註，會直接顯示在卡片上'],
			['default', '數字、字串或識別字，例如 default 0、default "draft"']
		],
		cardinalities: [
			['N -> 1', '多對一（最常見：箭頭左邊持有外鍵）'],
			['1 -> N', '一對多'],
			['1 -> 1', '一對一'],
			['N -> M', '多對多']
		],
		shortcutRows: [
			['Ctrl / Cmd + F', '搜尋資料表或欄位'],
			['Ctrl / Cmd + 滾輪', '縮放畫布'],
			['拖曳背景', '平移畫布（移動模式）／框選（選取模式）'],
			['單擊表名', '聚焦：相關的表亮起，其餘淡化；再點一次取消'],
			['單擊欄位', '欄位級聚焦：只亮該欄位與對應的外鍵欄位'],
			['雙擊表或欄位', '跳回 DSL 裡的定義'],
			['Tab', '用鍵盤一張一張走到資料表'],
			['Enter／空白鍵', '聚焦目前這張表（再按一次取消）'],
			['Shift + Enter', '跳回這張表的定義'],
			['Esc', '取消聚焦、關閉對話框'],
			['Ctrl / Cmd + 點表', '多選（網頁版），Delete 刪除選取的表'],
			['Delete', '刪除點選的表或多選的表，提示上可以復原（網頁版）'],
			['Ctrl / Cmd + A', '全選畫面上的資料表（網頁版）'],
			['Ctrl / Cmd + Z', '復原上一步編輯（網頁版）'],
			['Ctrl / Cmd + Shift + Z、Ctrl + Y', '重做（網頁版）'],
			['Ctrl / Cmd + D', '複製出一份選取或聚焦的表（網頁版）'],
			['Ctrl / Cmd + C', '把選取或聚焦的表的 DSL 定義複製到剪貼簿（網頁版）'],
			['+ / -', '放大／縮小畫布'],
			['Shift + 1', '縮放到看得到整張圖']
		],
		diagnosticRows: [
			['SCHEMA_PARSE_ERROR', '這一行看不懂。訊息會標出行:列，通常是少了括號、多了符號或關鍵字拼錯。'],
			['SCHEMA_DUPLICATE_TABLE / COLUMN / INDEX', '同名的表、欄位或索引宣告了兩次。'],
			['SCHEMA_UNKNOWN_TABLE / COLUMN', '關聯、索引或群組指到不存在的表或欄位，檢查大小寫（Users ≠ users）。'],
			['SCHEMA_RELATION_SOURCE_NOT_FOUND / TARGET_NOT_FOUND', '關聯箭頭兩邊有一邊找不到。'],
			['SCHEMA_INVALID_CARDINALITY', '基數只能寫 1、N、M。'],
			['SCHEMA_INVALID_COMPOSITE_RELATION', '同一個 relation 區塊裡的每一行都要指向同一組來源／目標表。'],
			['SCHEMA_DUPLICATE_GROUP / CONFLICTING_GROUP', '群組宣告了兩次，或一張表被放進兩個群組。'],
			['LINT_FK_NO_INDEX', '建議：外鍵欄位沒有索引，JOIN 可能比較慢。不影響圖表。'],
			['LINT_NO_PK', '建議：這張表沒有主鍵。'],
			['LINT_EMPTY_TABLE', '建議：這張表一個欄位都沒有。'],
			['LINT_NAMING / LINT_TYPE_SUFFIX', '建議：命名風格不一致。']
		]
	},
	en: {
		htmlTitle: 'DSL syntax — SchemaLens',
		metaDescription: 'SchemaLens DSL syntax: tables, columns, groups, indexes and relations, plus SQL, JSON and Markdown import.',
		homeLabel: 'SchemaLens home',
		navTitle: 'Docs',
		themeToggle: 'Toggle dark / light',
		openApp: 'Open the workspace',
		otherLang: '中文',
		tocLabel: 'On this page',
		tocHeading: 'On this page',
		copyLabel: 'Copy this example',
		copy: 'Copy',
		copied: 'Copied',
		toc: {
			'quick-start': 'Quick start',
			tables: 'Tables',
			columns: 'Columns',
			groups: 'Groups',
			indexes: 'Indexes',
			relations: 'Relations',
			formats: 'Other formats',
			shortcuts: 'Shortcuts',
			diagnostics: 'Errors and hints'
		},
		title: 'DSL syntax',
		lede: '`.dbschema` is a database structure format you can read at a glance: one column per line, relations declared on their own. Paste it into the workspace or open it in VS Code and the diagram appears.',
		quickStart: {
			intro: 'Two tables and one foreign key make the smallest possible diagram. Copy this, then paste it into Import in the workspace.',
			outro: 'Only three things to know: `table` declares a table, each line is a column, and `relation` declares a relation. Anything after `//` is a comment.'
		},
		tables: {
			body: '`table Name "description" { … }`. You can prefix the name with a schema (`sales.Orders`); without one it is `dbo`. The description is optional and shows next to the card title. Names are case-sensitive; keywords are not.'
		},
		columns: {
			body: 'The format is `[flags] Name Type [null | not null] [default value] ["comment"]`, one per line. Aligning columns is just for readability; the amount of whitespace does not matter.',
			flagsTitle: 'Flags',
			flagsHead: ['Flag', 'Meaning'],
			rulesTitle: 'Rules',
			rulesHead: ['Case', 'How it is read']
		},
		groups: {
			body: 'Groups are your own functional categories (say, "Orders" or "Members"). They are not database schemas and can span several. Tables in the same group are laid out together in one color, and the toolbar can show a single group.',
			outro: 'A table belongs to at most one group. If you write `table X in G` and G is not declared, G becomes a group with no description.'
		},
		indexes: { body: 'Indexes are declared on their own; composite indexes keep the column order you list. When a foreign key column has no index, the workspace shows a hint (the diagram is not affected).' },
		relations: {
			body: 'The left side of the arrow holds the foreign key; the right side is the table it points to. `Posts.AuthorId N -> 1 Users.Id` reads "many Posts belong to one User". This direction also decides upstream / downstream when you focus a table.',
			head: ['Syntax', 'Meaning'],
			note: 'The `FK` flag on a column does not create a relation by itself; every line on the diagram comes from a `relation`.'
		},
		formats: {
			sql: 'In the workspace, Import → SQL takes plain `CREATE TABLE` for MySQL, SQL Server, PostgreSQL and SQLite. Column-level `REFERENCES` and table-level `FOREIGN KEY` both become relations, and the result is saved as DSL. In VS Code, use "DBSchema: Import SQL as .dbschema".',
			markdown: 'Name the file `.schema.md` and put the DSL in a fenced code block tagged `dbschema`, so docs and structure live in one file.',
			json: 'Name the file `.schema.json`. It is the full structure the workspace exports, handy for scripts or backups.'
		},
		shortcuts: { body: 'Shared by the web app and the VS Code extension; rows marked "web" only work on the web.', head: ['Keys', 'What it does'] },
		diagnostics: {
			body: '`SCHEMA_*` codes are errors that make the diagram wrong; `LINT_*` codes are only design hints. A parse error never sinks the whole file: everything that can be read is still drawn, and the line that could not be read is listed with its line and column.',
			head: ['Code', 'Meaning and fix']
		},
		backHome: 'Back to home',
		tryIt: 'Open the workspace and paste it in',
		code: {
			quick: `table Users {
  PK Id    bigint        not null
     Email nvarchar(255) not null "Login email"
}

table Orders {
  PK Id     bigint not null
  FK UserId bigint not null
}

relation FK_Orders_Users {
  Orders.UserId N -> 1 Users.Id
}`,
			table: `table Users "System users" {
  PK Id bigint not null "User ID"
}

// With a schema; dbo when omitted
table sales.Orders {
  PK Id bigint not null
}`,
			columns: `table Products {
  PK  Id        bigint         not null "Product ID"
  UQ  Sku       nvarchar(64)   not null
      Name      nvarchar(200)  not null
      Price     decimal(18,2)  not null default 0
      Note      nvarchar(4000) null     "Notes"
      IsActive  bit            not null default 1
}`,
			groups: `// 1. Declare the group and list its members
group Identity "Identity and access" {
  Users
  Roles
}

// 2. Declare only the description; mark members on each table
group Sales "Orders and payments"

table Orders in Sales {
  PK Id bigint not null
}`,
			indexes: INDEX_SAMPLE,
			relations: `relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}

// Composite foreign key
relation FK_OrderLines_Orders {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}`,
			markdown: '# Orders module\n\n```dbschema\ntable Orders {\n  PK Id bigint not null\n}\n```',
			sql: SQL_SAMPLE
		},
		flags: [
			['PK', 'Primary key; implies not null'],
			['FK', 'Foreign key marker; visual only, declare the link with relation'],
			['UQ', 'Unique'],
			['IDX', 'Indexed marker; real indexes use the index statement']
		],
		columnRules: [
			['Several flags at once', 'PK UQ Id bigint'],
			['No null / not null', 'Nullable by default (except PK)'],
			['One type argument', 'Length, e.g. nvarchar(255)'],
			['Two type arguments', 'Precision and scale, e.g. decimal(18,2)'],
			['String at the end of the line', 'Column comment, shown on the card'],
			['default', 'A number, string or identifier, e.g. default 0, default "draft"']
		],
		cardinalities: [
			['N -> 1', 'Many-to-one (most common: the left side holds the foreign key)'],
			['1 -> N', 'One-to-many'],
			['1 -> 1', 'One-to-one'],
			['N -> M', 'Many-to-many']
		],
		shortcutRows: [
			['Ctrl / Cmd + F', 'Search tables or columns'],
			['Ctrl / Cmd + wheel', 'Zoom the canvas'],
			['Drag background', 'Pan (move mode) / box-select (select mode)'],
			['Click a table name', 'Focus: related tables light up, the rest dim; click again to clear'],
			['Click a column', 'Column focus: only that column and its foreign key partners light up'],
			['Double-click a table or column', 'Jump to its DSL definition'],
			['Tab', 'Move through tables with the keyboard'],
			['Enter / Space', 'Focus the current table (press again to clear)'],
			['Shift + Enter', 'Jump to the table definition'],
			['Esc', 'Clear focus, close dialogs'],
			['Ctrl / Cmd + click a table', 'Multi-select (web); Delete removes the selection'],
			['Delete', 'Delete the clicked or selected tables; undo from the notice (web)'],
			['Ctrl / Cmd + A', 'Select every table on screen (web)'],
			['Ctrl / Cmd + Z', 'Undo the last edit (web)'],
			['Ctrl / Cmd + Shift + Z, Ctrl + Y', 'Redo (web)'],
			['Ctrl / Cmd + D', 'Duplicate the selected or focused tables (web)'],
			['Ctrl / Cmd + C', 'Copy the DSL of the selected or focused tables (web)'],
			['+ / -', 'Zoom in / out'],
			['Shift + 1', 'Zoom to fit the whole diagram']
		],
		diagnosticRows: [
			['SCHEMA_PARSE_ERROR', 'This line cannot be read. The message gives line:column; usually a missing bracket, a stray symbol or a misspelled keyword.'],
			['SCHEMA_DUPLICATE_TABLE / COLUMN / INDEX', 'A table, column or index with the same name is declared twice.'],
			['SCHEMA_UNKNOWN_TABLE / COLUMN', 'A relation, index or group points to a table or column that does not exist. Check the case (Users ≠ users).'],
			['SCHEMA_RELATION_SOURCE_NOT_FOUND / TARGET_NOT_FOUND', 'One side of the relation arrow cannot be found.'],
			['SCHEMA_INVALID_CARDINALITY', 'Cardinality can only be 1, N or M.'],
			['SCHEMA_INVALID_COMPOSITE_RELATION', 'Every line in one relation block must point to the same source / target tables.'],
			['SCHEMA_DUPLICATE_GROUP / CONFLICTING_GROUP', 'A group is declared twice, or a table is put in two groups.'],
			['LINT_FK_NO_INDEX', 'Hint: the foreign key column has no index, so JOINs may be slow. The diagram is not affected.'],
			['LINT_NO_PK', 'Hint: this table has no primary key.'],
			['LINT_EMPTY_TABLE', 'Hint: this table has no columns.'],
			['LINT_NAMING / LINT_TYPE_SUFFIX', 'Hint: naming style is inconsistent.']
		]
	}
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 把文案裡的 `code` 轉成 <code>，其餘全部 escape，可以放心用 {@html}。 */
export function inlineCode(text: string): string {
	return text
		.split('`')
		.map((part, i) => {
			const safe = part.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
			return i % 2 === 1 ? `<code>${safe}</code>` : safe;
		})
		.join('');
}
