<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, ArrowRight, Check, Copy, Moon, Sun } from '@lucide/svelte';
	import { getTheme, initTheme, toggleTheme } from '$lib/stores/theme.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { highlight, type HighlightLang } from '$lib/docs/highlight';

	/**
	 * DSL 語法文件。內容以 docs/dsl-spec.md 為準（那份是 Parser 的契約），這裡是給使用者看的版本：
	 * 少講文法、多給可以直接複製的範例。改語法時兩邊要一起改。
	 */
	let theme = $state(getTheme());
	let copiedId = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let activeSection = $state('quick-start');

	onMount(() => {
		initTheme();
		theme = getTheme();

		// 目錄跟著捲動位置亮起目前這一節
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible[0]) activeSection = visible[0].target.id;
			},
			{ rootMargin: '-80px 0px -65% 0px' }
		);
		for (const section of document.querySelectorAll('[data-doc-section]')) observer.observe(section);
		return () => observer.disconnect();
	});

	function handleToggleTheme(): void {
		toggleTheme();
		theme = getTheme();
	}

	async function copy(id: string, text: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copiedId = id;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedId = null), 2000);
		} catch {
			// clipboard blocked — the code is still selectable
		}
	}

	const toc = [
		{ id: 'quick-start', label: '快速開始' },
		{ id: 'tables', label: '資料表' },
		{ id: 'columns', label: '欄位' },
		{ id: 'groups', label: '群組' },
		{ id: 'indexes', label: '索引' },
		{ id: 'relations', label: '關聯' },
		{ id: 'formats', label: '其他格式' },
		{ id: 'shortcuts', label: '快捷鍵' },
		{ id: 'diagnostics', label: '錯誤與建議' }
	];

	const code = {
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
		indexes: `index IX_Posts_Author_CreatedAt on Posts(AuthorId, CreatedAt)
unique index UX_Users_Email on Users(Email)`,
		relations: `relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}

// 複合外鍵
relation FK_OrderLines_Orders {
  OrderLines.(OrderId, TenantId) N -> 1 Orders.(Id, TenantId)
}`,
		markdown: '# 訂單模組\n\n```dbschema\ntable Orders {\n  PK Id bigint not null\n}\n```',
		sql: `CREATE TABLE users (
  id    bigint PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE orders (
  id      bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id)
);`
	};

	const flags = [
		['PK', '主鍵，隱含 not null'],
		['FK', '外鍵標記；只是視覺標記，關聯要用 relation 宣告'],
		['UQ', '唯一'],
		['IDX', '有索引的標記；真正的索引用 index 語句']
	];

	const columnRules = [
		['可以同時有好幾個標記', 'PK UQ Id bigint'],
		['沒寫 null / not null', '預設可為空（PK 例外）'],
		['型別一個參數', '長度，例如 nvarchar(255)'],
		['型別兩個參數', '精度與小數位，例如 decimal(18,2)'],
		['行尾的字串', '欄位備註，會直接顯示在卡片上'],
		['default', '數字、字串或識別字，例如 default 0、default "draft"']
	];

	const cardinalities = [
		['N -> 1', '多對一（最常見：箭頭左邊持有外鍵）'],
		['1 -> N', '一對多'],
		['1 -> 1', '一對一'],
		['N -> M', '多對多']
	];

	const shortcuts = [
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
	];

	const diagnostics = [
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
	];
</script>

<svelte:head>
	<title>DSL 語法 — SchemaLens</title>
	<meta name="description" content="SchemaLens DSL 語法：資料表、欄位、群組、索引、關聯，以及 SQL、JSON、Markdown 匯入。" />
</svelte:head>

{#snippet codeBlock(id: string, text: string, lang: HighlightLang = 'dbschema')}
	<div class="sl-code">
		<div class="sl-code-bar">
			<span>{lang}</span>
			<button onclick={() => copy(id, text)} aria-label="複製這段範例" title="複製">
				{#if copiedId === id}<Check size={14} /> 已複製{:else}<Copy size={14} /> 複製{/if}
			</button>
		</div>
		<!-- highlight() 先 escape 再包 span，這裡用 {@html} 是安全的 -->
		<pre><code>{@html highlight(text, lang)}</code></pre>
	</div>
{/snippet}

{#snippet table(rows: string[][], head: [string, string], codeFirst = true)}
	<div class="sl-table-wrap">
		<table>
			<thead><tr><th>{head[0]}</th><th>{head[1]}</th></tr></thead>
			<tbody>
				{#each rows as [a, b] (a)}
					<tr><td>{#if codeFirst}<code>{a}</code>{:else}{a}{/if}</td><td>{b}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<div class="sl-docs">
	<nav class="sl-docs-nav">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
			<div class="flex items-center gap-3">
				<a href="/" aria-label="SchemaLens 首頁"><Logo size={28} /></a>
				<span class="text-[var(--sl-border)]" aria-hidden="true">/</span>
				<span class="text-sm font-semibold whitespace-nowrap">文件</span>
			</div>
			<div class="flex items-center gap-2">
				<button class="sl-icon-btn rounded-full border border-border text-muted" onclick={handleToggleTheme} aria-label="切換深色／淺色" title="切換深色／淺色">
					{#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
				</button>
				<a href="/app" class="sl-button sl-button-primary">打開工作區 <ArrowRight size={14} /></a>
			</div>
		</div>
	</nav>

	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
		<aside class="hidden lg:block">
			<nav class="sticky top-24" aria-label="本頁目錄">
				<p class="mb-3 text-xs font-semibold tracking-wide text-muted">本頁</p>
				<ul class="space-y-1 text-sm">
					{#each toc as item (item.id)}
						<li>
							<a href="#{item.id}" class="sl-toc-link" class:is-active={activeSection === item.id} aria-current={activeSection === item.id ? 'location' : undefined}>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<main class="sl-prose min-w-0">
			<!-- 手機沒有側邊目錄：改成一排可以左右滑的章節膠囊 -->
			<nav class="sl-mobile-toc lg:hidden" aria-label="本頁目錄">
				{#each toc as item (item.id)}
					<a href="#{item.id}" class="sl-chip" aria-current={activeSection === item.id ? 'location' : undefined}>{item.label}</a>
				{/each}
			</nav>
			<header class="mb-12">
				<h1>DSL 語法</h1>
				<p class="sl-lede">
					<code>.dbschema</code> 是一種一看就懂的資料庫結構寫法：一行一個欄位，關聯單獨宣告。寫好之後在工作區貼上，或在 VS Code 打開，就會畫出關聯圖。
				</p>
			</header>

			<section id="quick-start" data-doc-section>
				<h2>快速開始</h2>
				<p>兩張表加一條外鍵關聯，就是一張最小的關聯圖。複製下面這段，到工作區按「匯入」貼上試試。</p>
				{@render codeBlock('quick', code.quick)}
				<p>
					重點只有三個：<code>table</code> 宣告資料表、每行一個欄位、<code>relation</code> 宣告關聯。<code>//</code> 之後是註解。
				</p>
			</section>

			<section id="tables" data-doc-section>
				<h2>資料表</h2>
				<p>
					<code>table 名稱 "說明" {'{ … }'}</code>。名稱前面可以加 schema（<code>sales.Orders</code>），省略時是 <code>dbo</code>；說明字串可有可無，會顯示在卡片標題旁。名稱大小寫有別，關鍵字不分大小寫。
				</p>
				{@render codeBlock('table', code.table)}
			</section>

			<section id="columns" data-doc-section>
				<h2>欄位</h2>
				<p>格式是 <code>[標記] 名稱 型別 [null | not null] [default 值] ["備註"]</code>，一行一個。欄位對齊只是為了好讀，空白數量不影響。</p>
				{@render codeBlock('columns', code.columns)}
				<h3>標記</h3>
				{@render table(flags, ['標記', '意思'])}
				<h3>規則</h3>
				{@render table(columnRules, ['情況', '怎麼解讀'], false)}
			</section>

			<section id="groups" data-doc-section>
				<h2>群組</h2>
				<p>
					群組是你自己定的功能分類（例如「訂單」「會員」），跟資料庫的 schema 是兩回事，可以跨 schema。同一群組的表會排在一起、用同一個顏色，工具列也可以只看某個群組。
				</p>
				{@render codeBlock('groups', code.groups)}
				<p>一張表只能屬於一個群組。<code>table X in G</code> 而 G 沒宣告時，會自動當成一個沒有說明的群組。</p>
			</section>

			<section id="indexes" data-doc-section>
				<h2>索引</h2>
				<p>索引獨立宣告；複合索引照你列的順序保存。外鍵欄位沒有索引時，工作區會給一個建議（不影響圖表）。</p>
				{@render codeBlock('indexes', code.indexes)}
			</section>

			<section id="relations" data-doc-section>
				<h2>關聯</h2>
				<p>
					箭頭左邊是持有外鍵的一方，右邊是被參照的一方：<code>Posts.AuthorId N -> 1 Users.Id</code> 讀作「很多篇 Posts 對到一個 User」。這個方向也決定了聚焦時的「上游／下游」。
				</p>
				{@render codeBlock('relations', code.relations)}
				{@render table(cardinalities, ['寫法', '意思'])}
				<p class="sl-note">欄位上的 <code>FK</code> 標記不會自動產生關聯；圖上的線一律來自 <code>relation</code>。</p>
			</section>

			<section id="formats" data-doc-section>
				<h2>其他格式</h2>
				<h3>SQL</h3>
				<p>
					工作區的「匯入 → SQL」可以直接貼 <code>CREATE TABLE</code>，支援 MySQL、SQL Server、PostgreSQL、SQLite。欄位上的 <code>REFERENCES</code> 和表層級的 <code>FOREIGN KEY</code> 都會變成關聯；匯入後存成 DSL。VS Code 裡用「DBSchema: Import SQL as .dbschema」。
				</p>
				{@render codeBlock('sql', code.sql, 'sql')}
				<h3>Markdown</h3>
				<p>檔名用 <code>.schema.md</code>，把 DSL 放在 <code>```dbschema</code> 區塊裡，文件跟結構可以寫在同一份。</p>
				{@render codeBlock('markdown', code.markdown, 'markdown')}
				<h3>JSON</h3>
				<p>檔名用 <code>.schema.json</code>。這是工作區「匯出」產生的完整結構，適合給程式讀寫或備份。</p>
			</section>

			<section id="shortcuts" data-doc-section>
				<h2>快捷鍵</h2>
				<p>網頁版跟 VS Code 插件通用。</p>
				{@render table(shortcuts, ['按鍵', '做什麼'])}
			</section>

			<section id="diagnostics" data-doc-section>
				<h2>錯誤與建議</h2>
				<p>
					<code>SCHEMA_*</code> 是會讓圖畫不正確的錯誤，<code>LINT_*</code> 只是設計上的建議。解析錯誤不會讓整份檔案失敗：看得懂的部分照樣畫出來，看不懂的那行列在問題清單裡，並標出行與列。
				</p>
				{@render table(diagnostics, ['代碼', '意思與處理'])}
			</section>

			<footer class="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm">
				<a href="/" class="flex items-center gap-1.5 text-muted hover:text-fg"><ArrowLeft size={14} /> 回首頁</a>
				<a href="/app" class="sl-button sl-button-primary">打開工作區，貼上試試 <ArrowRight size={14} /></a>
			</footer>
		</main>
	</div>
</div>

<style>
	.sl-docs {
		min-height: 100vh;
		background: var(--sl-page-bg);
		color: var(--sl-fg);
	}
	.sl-docs-nav {
		position: sticky;
		top: 0;
		z-index: 20;
		border-bottom: 1px solid var(--sl-border);
		background: color-mix(in oklab, var(--sl-page-bg) 85%, transparent);
		backdrop-filter: blur(12px);
	}
	.sl-mobile-toc {
		position: sticky;
		top: 64px;
		z-index: 10;
		display: flex;
		gap: 6px;
		margin: -8px -16px 24px;
		overflow-x: auto;
		background: color-mix(in oklab, var(--sl-page-bg) 92%, transparent);
		padding: 10px 16px;
		scrollbar-width: none;
		backdrop-filter: blur(10px);
	}
	.sl-mobile-toc a[aria-current] {
		border-color: color-mix(in oklab, var(--sl-cyan) 55%, transparent);
		background: color-mix(in oklab, var(--sl-cyan) 13%, transparent);
		color: var(--sl-cyan);
		font-weight: 600;
	}
	.sl-toc-link {
		display: block;
		border-left: 1px solid var(--sl-border);
		padding: 4px 0 4px 12px;
		color: var(--sl-muted);
		transition: color 0.15s ease;
	}
	.sl-toc-link:hover {
		color: var(--sl-fg);
	}
	.sl-toc-link.is-active {
		border-left-color: var(--sl-cyan);
		color: var(--sl-fg);
		font-weight: 600;
	}

	.sl-prose {
		max-width: 46rem;
		font-size: 15px;
		line-height: 1.8;
	}
	.sl-prose h1 {
		font-family: 'Lexend', 'Noto Sans TC', 'Geist', sans-serif;
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}
	.sl-lede {
		margin-top: 14px;
		font-size: 17px;
		color: var(--sl-muted);
	}
	.sl-prose section {
		scroll-margin-top: 88px;
		margin-bottom: 56px;
	}
	.sl-prose h2 {
		margin-bottom: 12px;
		font-family: 'Lexend', 'Noto Sans TC', 'Geist', sans-serif;
		font-size: 1.5rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.sl-prose h3 {
		margin: 28px 0 10px;
		font-size: 1rem;
		font-weight: 600;
	}
	.sl-prose p {
		margin: 12px 0;
		color: color-mix(in oklab, var(--sl-fg) 82%, var(--sl-page-bg));
	}
	.sl-prose :global(code) {
		border: 1px solid var(--sl-border);
		border-radius: 5px;
		background: var(--sl-surface-2);
		padding: 1px 5px;
		font-family: var(--font-mono);
		font-size: 0.86em;
		color: var(--sl-fg);
	}
	.sl-note {
		border-left: 2px solid var(--sl-cyan);
		padding-left: 14px;
	}

	.sl-code {
		margin: 16px 0;
		overflow: hidden;
		border: 1px solid var(--sl-border);
		border-radius: 12px;
		background: var(--sl-surface);
	}
	.sl-code-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--sl-border);
		padding: 4px 6px 4px 14px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--sl-muted);
	}
	.sl-code-bar button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: 28px;
		border-radius: 6px;
		padding: 0 8px;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--sl-muted);
	}
	.sl-code-bar button:hover {
		background: color-mix(in oklab, var(--sl-fg) 7%, transparent);
		color: var(--sl-fg);
	}
	.sl-code pre {
		overflow-x: auto;
		padding: 14px 16px;
		font-size: 13px;
		line-height: 1.7;
	}
	.sl-code pre :global(.tk-kw) {
		color: var(--sl-cyan);
	}
	.sl-code pre :global(.tk-flag) {
		color: var(--sl-warning);
		font-weight: 700;
	}
	.sl-code pre :global(.tk-str) {
		color: color-mix(in oklab, #2fb69b 80%, var(--sl-fg));
	}
	.sl-code pre :global(.tk-com) {
		color: var(--sl-muted);
		font-style: italic;
	}
	.sl-code pre :global(.tk-num),
	.sl-code pre :global(.tk-op) {
		color: var(--sl-violet);
		font-weight: 600;
	}
	.sl-code pre :global(code) {
		border: 0;
		background: none;
		padding: 0;
		font-size: inherit;
	}

	.sl-table-wrap {
		margin: 14px 0;
		overflow-x: auto;
		border: 1px solid var(--sl-border);
		border-radius: 12px;
	}
	.sl-table-wrap table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}
	.sl-table-wrap th {
		background: var(--sl-surface-2);
		padding: 8px 14px;
		text-align: left;
		font-size: 12px;
		font-weight: 600;
		color: var(--sl-muted);
	}
	.sl-table-wrap td {
		border-top: 1px solid var(--sl-border);
		padding: 9px 14px;
		vertical-align: top;
		line-height: 1.6;
	}
	.sl-table-wrap td:first-child {
		white-space: nowrap;
	}
</style>
