/**
 * 首頁文案（中文 / 英文）。版面在 $lib/components/Landing.svelte，兩個語言共用同一份。
 * 有 <code> 的句子拆成 before / code / after，避免在文案裡寫 HTML。
 */
export type LandingLang = 'zh' | 'en';

export interface LandingCopy {
	htmlTitle: string;
	metaDescription: string;
	ogTitle: string;
	ogDescription: string;
	homeLabel: string;
	nav: { features: string; docs: string; vscode: string; source: string; start: string; otherLang: string; otherLangHref: string };
	themeToggle: string;
	announce: string;
	headline: { before: string; swash: string; after: string; second: string };
	lead: string;
	ctaPrimary: string;
	ctaVscode: string;
	copySql: string;
	copySqlTitle: string;
	copiedSqlHint: string;
	demoLabel: string;
	demoCaption: string;
	features: { title: string; lead: string };
	tiles: {
		paste: { title: string; body: string };
		find: { title: string; body: string; chips: Array<[string, boolean]> };
		copy: { title: string; body: string };
		own: { title: string; body: string };
	};
	vscode: {
		title: string;
		lead: string;
		step1: { before: string; after: string; button: string };
		step2: { before: string; after: string };
		step3: { before: string; after: string };
		osGroup: string;
		copyInstall: string;
		noteClaude: string;
		noteShell: { before: string; after: string };
	};
	shortcutsTitle: string;
	shortcuts: Array<{ keys: string; action: string }>;
	final: { title: string; lead: string; github: string };
	footerNote: string;
	footer: { source: string; releases: string; docs: string; app: string };
	demo: {
		meta: string;
		focus: (name: string) => string;
		hint: string;
		pause: string;
		play: string;
		playTitle: string;
	};
}

export const LANDING_COPY: Record<LandingLang, LandingCopy> = {
	zh: {
		htmlTitle: 'SchemaLens — 看懂資料表之間的關聯',
		metaDescription: '把 DSL、JSON、Markdown 或 SQL DDL 定義的資料庫結構變成可以搜尋、聚焦的互動關聯圖。網頁版不用登入就能用。',
		ogTitle: 'SchemaLens — 看懂資料表之間的關聯',
		ogDescription: '貼上 SQL 或 DSL，就是一張能點的關聯圖。不用登入就能用。',
		homeLabel: 'SchemaLens 首頁',
		nav: { features: '功能', docs: '語法文件', vscode: 'VS Code 插件', source: '原始碼', start: '開始使用', otherLang: 'English', otherLangHref: '/?lang=en' },
		themeToggle: '切換深色／淺色',
		announce: 'VS Code 插件也能用，跟網頁版同一套引擎',
		headline: { before: '看懂資料表之間的', swash: '關聯', after: '，', second: '不用再自己畫 ER 圖' },
		lead: '把 DSL、JSON、Markdown 或 SQL DDL 定義的資料庫結構，變成可以搜尋、聚焦、探索的關聯圖。不用登入就能用，內容只存在你的瀏覽器。',
		ctaPrimary: '打開工作區',
		ctaVscode: '安裝 VS Code 插件',
		copySql: '複製範例 SQL',
		copySqlTitle: '複製範例 SQL，到工作區的「匯入」貼上',
		copiedSqlHint: '已複製——到工作區按「匯入」貼上，就會畫出關聯圖。',
		demoLabel: '互動範例',
		demoCaption: '這張圖是真的：點表名切換聚焦、拖曳背景平移、按住 Ctrl / Cmd 滾動縮放。',
		features: {
			title: '從一堆 CREATE TABLE，到一眼看懂',
			lead: '不用畫、不用拉線。把結構丟進來，關聯自己長出來；表再多，也只看你關心的那一塊。'
		},
		tiles: {
			paste: {
				title: '貼上就能看',
				body: '.dbschema、.schema.json、內嵌 dbschema 區塊的 Markdown，或直接貼 CREATE TABLE——MySQL、SQL Server、PostgreSQL、SQLite 都認得。'
			},
			find: {
				title: '一百張表也找得到',
				body: '點一張表就只亮它的上下游；用深度、方向、搜尋縮小範圍，不用在整片圖裡找線。',
				chips: [['深度 1 層', false], ['上游', true], ['下游', false], ['淡化不相關', true]]
			},
			copy: { title: '複製出去就能用', body: '選好範圍按右鍵，複製成 PNG、SVG，或那幾張表的 DSL 文字，貼進文件或丟給 AI。' },
			own: { title: '資料是你的', body: '不登入也能用，內容存在你的瀏覽器；隨時匯出 .schema.json、.dbschema 或各家方言的 SQL，沒有綁定。' }
		},
		vscode: {
			title: '在 VS Code 裡也一樣',
			lead: '跟網頁版同一套渲染引擎，打開 .dbschema 就有關聯圖。還沒上架官方市集，三步驟手動安裝，不用裝額外工具。',
			step1: { before: '到 Releases 下載最新的', after: '（公開 repo，不用登入）。', button: '前往下載頁' },
			step2: { before: '把', after: '拖進 VS Code 視窗。' },
			step3: { before: '或按', after: '→ 「Install from VSIX」→ 選剛下載的檔案。' },
			osGroup: '作業系統',
			copyInstall: '複製安裝指令',
			noteClaude: '在 Claude Code 對話框裡執行，不是終端機：第一行註冊 marketplace，第二行會自動下載 .vsix 並裝好。',
			noteShell: { before: '一次裝好；VS Code 需要能在終端機打', after: "指令（命令選擇區執行「Shell Command: Install 'code' command in PATH」）。" }
		},
		shortcutsTitle: '快捷鍵（插件跟網頁版通用）',
		shortcuts: [
			{ keys: 'Ctrl / Cmd + F', action: '搜尋資料表或欄位' },
			{ keys: 'Ctrl / Cmd + 滾輪', action: '縮放畫布' },
			{ keys: 'Esc', action: '取消目前的聚焦' },
			{ keys: '拖曳背景', action: '平移畫布' },
			{ keys: '單擊表名', action: '聚焦：相關的表亮起，其餘淡化或隱藏' },
			{ keys: '單擊欄位', action: '欄位級聚焦：只亮該欄位與 FK 對應欄位' },
			{ keys: '雙擊表或欄位', action: '跳回 DSL 來源定義' },
			{ keys: 'Tab · Enter', action: '用鍵盤走到資料表並聚焦（Shift + Enter 跳回定義）' }
		],
		final: { title: '把你的 schema 貼進來看看', lead: '不用註冊，打開就能用。第一次用可以先載入範例。', github: '在 GitHub 上看' },
		footerNote: '內容存在你的瀏覽器；登入 GitHub 後才會存到雲端。',
		footer: { source: '原始碼', releases: '版本紀錄', docs: '語法文件', app: '工作區' },
		demo: {
			meta: '5 張表 · 5 條關聯',
			focus: (name) => `聚焦：${name}`,
			hint: '點任一張表的標題試試',
			pause: '暫停自動導覽',
			play: '播放自動導覽',
			playTitle: '自動導覽：每隔幾秒聚焦下一張表'
		}
	},
	en: {
		htmlTitle: 'SchemaLens — See how your tables relate',
		metaDescription:
			'Turn database structure written as DSL, JSON, Markdown or SQL DDL into an interactive diagram you can search and focus. The web version works without signing in.',
		ogTitle: 'SchemaLens — See how your tables relate',
		ogDescription: 'Paste SQL or DSL and get a diagram you can click through. No sign-in needed.',
		homeLabel: 'SchemaLens home',
		nav: { features: 'Features', docs: 'Docs', vscode: 'VS Code', source: 'Source', start: 'Get started', otherLang: '中文', otherLangHref: '/en?lang=zh-hant' },
		themeToggle: 'Toggle dark / light',
		announce: 'Also in VS Code, powered by the same engine',
		headline: { before: 'See how your tables ', swash: 'relate', after: ',', second: 'without drawing ER diagrams' },
		lead: 'SchemaLens turns database structure written as DSL, JSON, Markdown or SQL DDL into a diagram you can search, focus and explore. No sign-in; everything stays in your browser.',
		ctaPrimary: 'Open the workspace',
		ctaVscode: 'Get the VS Code extension',
		copySql: 'Copy sample SQL',
		copySqlTitle: 'Copy sample SQL, then paste it into Import in the workspace',
		copiedSqlHint: 'Copied — paste it into Import in the workspace to see the diagram.',
		demoLabel: 'Interactive example',
		demoCaption: 'This is the real thing: click a table name to focus, drag to pan, hold Ctrl / Cmd and scroll to zoom.',
		features: {
			title: 'From a pile of CREATE TABLEs to the whole picture',
			lead: 'No drawing, no dragging lines. Drop your structure in and the relations appear; however many tables you have, you only look at the part you care about.'
		},
		tiles: {
			paste: {
				title: 'Paste and see',
				body: '.dbschema, .schema.json, Markdown with dbschema blocks, or plain CREATE TABLE — MySQL, SQL Server, PostgreSQL and SQLite all work.'
			},
			find: {
				title: 'Find it in a hundred tables',
				body: 'Click a table and only its upstream and downstream light up. Narrow it with depth, direction and search instead of tracing lines.',
				chips: [['Depth 1', false], ['Upstream', true], ['Downstream', false], ['Dim unrelated', true]]
			},
			copy: { title: 'Copy it anywhere', body: 'Right-click a selection to copy it as PNG, SVG or DSL text — straight into your docs or your AI chat.' },
			own: { title: 'Your data stays yours', body: 'Works without signing in and keeps content in your browser. Export .schema.json, .dbschema or SQL for any dialect, any time.' }
		},
		vscode: {
			title: 'Same thing, inside VS Code',
			lead: 'The same rendering engine as the web app: open a .dbschema file and the diagram is there. Not on the Marketplace yet — three steps to install, nothing extra required.',
			step1: { before: 'Download the latest', after: 'from Releases (public repo, no sign-in).', button: 'Go to downloads' },
			step2: { before: 'Drag the', after: 'file into a VS Code window.' },
			step3: { before: 'Or press', after: '→ “Install from VSIX” → pick the file you downloaded.' },
			osGroup: 'Operating system',
			copyInstall: 'Copy install command',
			noteClaude: 'Run these in the Claude Code prompt, not a terminal: the first line registers the marketplace, the second downloads and installs the .vsix.',
			noteShell: { before: 'One-shot install. VS Code needs the', after: "command on your PATH (Command Palette → “Shell Command: Install 'code' command in PATH”)." }
		},
		shortcutsTitle: 'Shortcuts (same in the extension and the web app)',
		shortcuts: [
			{ keys: 'Ctrl / Cmd + F', action: 'Search tables or columns' },
			{ keys: 'Ctrl / Cmd + wheel', action: 'Zoom the canvas' },
			{ keys: 'Esc', action: 'Clear the current focus' },
			{ keys: 'Drag background', action: 'Pan the canvas' },
			{ keys: 'Click a table name', action: 'Focus: related tables light up, the rest dim or hide' },
			{ keys: 'Click a column', action: 'Column focus: only that column and its FK partners light up' },
			{ keys: 'Double-click', action: 'Jump to the DSL definition' },
			{ keys: 'Tab · Enter', action: 'Reach tables with the keyboard and focus them (Shift + Enter jumps to the source)' }
		],
		final: { title: 'Paste your schema and take a look', lead: 'No account needed. First time? Start with the built-in sample.', github: 'View on GitHub' },
		footerNote: 'Content stays in your browser; it is saved to the cloud only after you sign in with GitHub.',
		footer: { source: 'Source', releases: 'Releases', docs: 'Docs', app: 'Workspace' },
		demo: {
			meta: '5 tables · 5 relations',
			focus: (name) => `Focus: ${name}`,
			hint: 'Click any table title',
			pause: 'Pause the tour',
			play: 'Play the tour',
			playTitle: 'Guided tour: focuses the next table every few seconds'
		}
	}
};
