<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, ArrowRight, Check, Copy, Moon, Sun } from '@lucide/svelte';
	import { getTheme, initTheme, toggleTheme } from '$lib/stores/theme.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { highlight, type HighlightLang } from '$lib/docs/highlight';
	import { DOCS_COPY, SECTION_IDS, inlineCode } from '$lib/docs/copy';
	import { currentLocale, switchLocaleHref } from '$lib/i18n/current';

	/**
	 * DSL 語法文件。文案在 $lib/docs/copy.ts（中文 / 英文），內容以 docs/dsl-spec.md 為準：
	 * 少講文法、多給可以直接複製的範例。改語法時要一起改。
	 */
	const locale = $derived(currentLocale());
	const c = $derived(DOCS_COPY[locale]);
	const homeHref = $derived(locale === 'en' ? '/en' : '/');

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
</script>

<svelte:head>
	<title>{c.htmlTitle}</title>
	<meta name="description" content={c.metaDescription} />
</svelte:head>

{#snippet codeBlock(id: string, text: string, lang: HighlightLang = 'dbschema')}
	<div class="sl-code">
		<div class="sl-code-bar">
			<span>{lang}</span>
			<button onclick={() => copy(id, text)} aria-label={c.copyLabel} title={c.copy}>
				{#if copiedId === id}<Check size={14} /> {c.copied}{:else}<Copy size={14} /> {c.copy}{/if}
			</button>
		</div>
		<!-- highlight() 先 escape 再包 span，這裡用 {@html} 是安全的 -->
		<pre><code>{@html highlight(text, lang)}</code></pre>
	</div>
{/snippet}

{#snippet table(rows: [string, string][], head: [string, string], codeFirst = true)}
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

<!-- inlineCode() 先 escape 再把反引號換成 <code>，這裡用 {@html} 是安全的 -->
{#snippet prose(text: string, className = '')}
	<p class={className}>{@html inlineCode(text)}</p>
{/snippet}

<div class="sl-docs">
	<nav class="sl-docs-nav">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
			<div class="flex items-center gap-3">
				<a href={homeHref} aria-label={c.homeLabel}><Logo size={28} /></a>
				<span class="text-[var(--sl-border)]" aria-hidden="true">/</span>
				<span class="text-sm font-semibold whitespace-nowrap">{c.navTitle}</span>
			</div>
			<div class="flex items-center gap-2">
				<a
					href={switchLocaleHref(locale === 'en' ? 'zh-hant' : 'en')}
					class="px-2 text-sm whitespace-nowrap text-muted hover:text-fg"
					hreflang={locale === 'en' ? 'zh-Hant' : 'en'}
					data-sveltekit-reload>{c.otherLang}</a
				>
				<button class="sl-icon-btn rounded-full border border-border text-muted" onclick={handleToggleTheme} aria-label={c.themeToggle} title={c.themeToggle}>
					{#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
				</button>
				<a href="/app" class="sl-button sl-button-primary">{c.openApp} <ArrowRight size={14} /></a>
			</div>
		</div>
	</nav>

	<div class="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
		<aside class="hidden lg:block">
			<nav class="sticky top-24" aria-label={c.tocLabel}>
				<p class="mb-3 text-xs font-semibold tracking-wide text-muted">{c.tocHeading}</p>
				<ul class="space-y-1 text-sm">
					{#each SECTION_IDS as id (id)}
						<li>
							<a href="#{id}" class="sl-toc-link" class:is-active={activeSection === id} aria-current={activeSection === id ? 'location' : undefined}>
								{c.toc[id]}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<main class="sl-prose min-w-0">
			<!-- 手機沒有側邊目錄：改成一排可以左右滑的章節膠囊 -->
			<nav class="sl-mobile-toc lg:hidden" aria-label={c.tocLabel}>
				{#each SECTION_IDS as id (id)}
					<a href="#{id}" class="sl-chip" aria-current={activeSection === id ? 'location' : undefined}>{c.toc[id]}</a>
				{/each}
			</nav>
			<header class="mb-12">
				<h1>{c.title}</h1>
				{@render prose(c.lede, 'sl-lede')}
			</header>

			<section id="quick-start" data-doc-section>
				<h2>{c.toc['quick-start']}</h2>
				{@render prose(c.quickStart.intro)}
				{@render codeBlock('quick', c.code.quick)}
				{@render prose(c.quickStart.outro)}
			</section>

			<section id="tables" data-doc-section>
				<h2>{c.toc.tables}</h2>
				{@render prose(c.tables.body)}
				{@render codeBlock('table', c.code.table)}
			</section>

			<section id="columns" data-doc-section>
				<h2>{c.toc.columns}</h2>
				{@render prose(c.columns.body)}
				{@render codeBlock('columns', c.code.columns)}
				<h3>{c.columns.flagsTitle}</h3>
				{@render table(c.flags, c.columns.flagsHead)}
				<h3>{c.columns.rulesTitle}</h3>
				{@render table(c.columnRules, c.columns.rulesHead, false)}
			</section>

			<section id="groups" data-doc-section>
				<h2>{c.toc.groups}</h2>
				{@render prose(c.groups.body)}
				{@render codeBlock('groups', c.code.groups)}
				{@render prose(c.groups.outro)}
			</section>

			<section id="indexes" data-doc-section>
				<h2>{c.toc.indexes}</h2>
				{@render prose(c.indexes.body)}
				{@render codeBlock('indexes', c.code.indexes)}
			</section>

			<section id="relations" data-doc-section>
				<h2>{c.toc.relations}</h2>
				{@render prose(c.relations.body)}
				{@render codeBlock('relations', c.code.relations)}
				{@render table(c.cardinalities, c.relations.head)}
				{@render prose(c.relations.note, 'sl-note')}
			</section>

			<section id="formats" data-doc-section>
				<h2>{c.toc.formats}</h2>
				<h3>SQL</h3>
				{@render prose(c.formats.sql)}
				{@render codeBlock('sql', c.code.sql, 'sql')}
				<h3>Markdown</h3>
				{@render prose(c.formats.markdown)}
				{@render codeBlock('markdown', c.code.markdown, 'markdown')}
				<h3>JSON</h3>
				{@render prose(c.formats.json)}
			</section>

			<section id="shortcuts" data-doc-section>
				<h2>{c.toc.shortcuts}</h2>
				{@render prose(c.shortcuts.body)}
				{@render table(c.shortcutRows, c.shortcuts.head)}
			</section>

			<section id="diagnostics" data-doc-section>
				<h2>{c.toc.diagnostics}</h2>
				{@render prose(c.diagnostics.body)}
				{@render table(c.diagnosticRows, c.diagnostics.head)}
			</section>

			<footer class="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm">
				<a href={homeHref} class="flex items-center gap-1.5 text-muted hover:text-fg"><ArrowLeft size={14} /> {c.backHome}</a>
				<a href="/app" class="sl-button sl-button-primary">{c.tryIt} <ArrowRight size={14} /></a>
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
