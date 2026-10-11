<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, ChevronDown, Copy, Download, Github, Moon, Sun } from '@lucide/svelte';
	import { getTheme, initTheme, toggleTheme } from '$lib/stores/theme.svelte';
	import HeroDemo from '$lib/components/HeroDemo.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { SNIPPET_SQL } from '$lib/schema/sampleSchema';
	import { page } from '$app/state';
	import { LANDING_COPY, type LandingLang } from '$lib/landing/copy';

	let { lang = 'zh' }: { lang?: LandingLang } = $props();
	const c = $derived(LANDING_COPY[lang]);

	let theme = $state(getTheme());

	onMount(() => {
		initTheme();
		theme = getTheme();
	});

	function handleToggleTheme(): void {
		toggleTheme();
		theme = getTheme();
	}

	// doraeyi/schemalens-web is a public repo, so plain curl / Invoke-RestMethod
	// against the GitHub API works with no login and no extra CLI tool —
	// no need for `gh` here.
	const INSTALL_COMMANDS = {
		bash: [
			'url=$(curl -fsSL https://api.github.com/repos/doraeyi/schemalens-web/releases/latest | grep -o \'"browser_download_url": *"[^"]*\\.vsix"\' | cut -d\'"\' -f4)',
			'curl -fL -o dbschema.vsix "$url"',
			'code --install-extension dbschema.vsix'
		].join('\n'),
		powershell: [
			'$release = Invoke-RestMethod -Uri "https://api.github.com/repos/doraeyi/schemalens-web/releases/latest"',
			'$asset = $release.assets | Where-Object { $_.name -like "*.vsix" }',
			'Invoke-WebRequest -Uri $asset.browser_download_url -OutFile dbschema.vsix',
			'code --install-extension dbschema.vsix'
		].join('\n'),
		claude: [
			'/plugin marketplace add doraeyi/schemalens-web',
			'/plugin install schemalens-vscode-extension@schemalens'
		].join('\n')
	} as const;
	type Shell = keyof typeof INSTALL_COMMANDS;
	const SHELLS: Array<[Shell, string]> = [
		['bash', 'macOS / Linux'],
		['powershell', 'Windows'],
		['claude', 'Claude Code']
	];

	const RELEASES_URL = 'https://github.com/doraeyi/schemalens-web/releases/latest';
	const REPO_URL = 'https://github.com/doraeyi/schemalens-web';

	let shell = $state<Shell>('bash');
	let copiedInstall = $state(false);
	let copiedSql = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyText(text: string, which: 'install' | 'sql'): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copiedInstall = which === 'install';
			copiedSql = which === 'sql';
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copiedInstall = false;
				copiedSql = false;
			}, 2600);
		} catch {
			// clipboard blocked — the text itself is still visible to copy by hand
		}
	}

	/**
	 * 品牌母題：「聚焦一層，其他淡掉」。背景格線上的格子是一張小小的關聯圖——每隔幾秒聚焦其中一格，
	 * 它直接連到的格子跟連線亮起來，其餘維持淡淡的，跟產品裡點一張表的效果是同一個語言。
	 * 位置寫死，伺服器端跟瀏覽器端畫出來一樣。[欄, 列]
	 */
	const GRID = 56;
	const nodes: Array<[number, number]> = [
		[2, 1], [5, 3], [3, 6], [6, 8], [1, 10], [17, 1], [20, 3], [18, 6], [21, 9], [15, 10], [9, 11], [13, 2]
	];
	const edges: Array<[number, number]> = [
		[0, 1], [1, 2], [2, 3], [2, 4], [1, 11], [11, 5], [5, 6], [6, 7], [7, 8], [7, 9], [9, 10], [3, 10]
	];
	const tour = [1, 7, 2, 6, 9, 11, 3, 5];
	let focusNode = $state(1);
	const neighbours = $derived(
		new Set(edges.flatMap(([a, b]) => (a === focusNode ? [b] : b === focusNode ? [a] : [])))
	);
	const edgePath = ([a, b]: [number, number]) => {
		const [ax, ay] = nodes[a];
		const [bx, by] = nodes[b];
		const x1 = ax * GRID + GRID / 2;
		const y1 = ay * GRID + GRID / 2;
		const x2 = bx * GRID + GRID / 2;
		const y2 = by * GRID + GRID / 2;
		// 跟渲染引擎的關聯線一樣是水平出發的曲線，不是直線
		const mid = (x1 + x2) / 2;
		return `M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
	};

	let heroEl: HTMLElement | undefined = $state();
	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let step = 0;
		let visible = true;
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
		if (heroEl) observer.observe(heroEl);
		const timer = setInterval(() => {
			if (!visible || document.visibilityState !== 'visible') return;
			step = (step + 1) % tour.length;
			focusNode = tour[step];
		}, 2800);
		return () => {
			clearInterval(timer);
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title>{c.htmlTitle}</title>
	<meta name="description" content={c.metaDescription} />
	<link rel="alternate" hreflang="zh-Hant" href="{page.url.origin}/" />
	<link rel="alternate" hreflang="en" href="{page.url.origin}/en" />
	<!-- 分享到 Slack／Discord／社群時的預覽：圖是 static/og.png（1200×630） -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="SchemaLens" />
	<meta property="og:title" content={c.ogTitle} />
	<meta property="og:description" content={c.ogDescription} />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:image" content="{page.url.origin}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="{page.url.origin}/og.png" />
</svelte:head>

<div class="sl-landing">
	<div class="sl-grid-bg" aria-hidden="true">
		<svg class="sl-motif-edges" width={23 * GRID} height={12 * GRID} viewBox="0 0 {23 * GRID} {12 * GRID}">
			{#each edges as edge (edge.join('-'))}
				<path d={edgePath(edge)} class:is-lit={edge.includes(focusNode)} />
			{/each}
		</svg>
		{#each nodes as [col, row], i (i)}
			<span
				class="sl-cell"
				class:is-focus={i === focusNode}
				class:is-near={neighbours.has(i)}
				style:--col={col}
				style:--row={row}
			></span>
		{/each}
	</div>

	<nav class="sl-nav">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
			<a href={lang === 'en' ? '/en' : '/'} aria-label={c.homeLabel}><Logo size={30} /></a>
			<div class="hidden items-center gap-7 text-sm md:flex">
				<a href="#features" class="sl-nav-link">{c.nav.features}</a>
				<a href="/docs" class="sl-nav-link">{c.nav.docs}</a>
				<a href="#vscode" class="sl-nav-link">{c.nav.vscode}</a>
				<a href={REPO_URL} target="_blank" rel="noopener noreferrer" class="sl-nav-link">{c.nav.source}</a>
			</div>
			<div class="flex items-center gap-2">
				<a href={c.nav.otherLangHref} class="sl-nav-link px-1 text-sm whitespace-nowrap" hreflang={lang === 'en' ? 'zh-Hant' : 'en'}>{c.nav.otherLang}</a>
				<button class="sl-round-icon" onclick={handleToggleTheme} title={c.themeToggle} aria-label={c.themeToggle}>
					{#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
				</button>
				<a href="/app" class="sl-btn-primary sl-btn-sm">{c.nav.start} <ArrowRight size={14} class="sl-arrow" /></a>
			</div>
		</div>
	</nav>

	<header bind:this={heroEl} class="relative mx-auto max-w-5xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
		<a href="#vscode" class="sl-announce sl-fade">
			<span class="sl-announce-dot" aria-hidden="true"></span>
			{c.announce}
			<ArrowRight size={13} class="sl-arrow" />
		</a>

		<h1 class="sl-display mt-7">
			<span class="sl-line"
				><span class="sl-line-inner"
					>{c.headline.before}<span class="sl-swash-word"
						>{c.headline.swash}<svg class="sl-swash" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"
							><path pathLength="1" d="M4 16 C 60 6, 120 4, 180 10 S 260 20, 296 8" /></svg
						></span
					>{c.headline.after}</span
				></span
			>
			<span class="sl-line"
				><span class="sl-line-inner sl-display-muted" style:animation-delay="110ms">{c.headline.second}</span></span
			>
		</h1>

		<p class="sl-lead sl-fade mx-auto mt-7" style:animation-delay="280ms">
			{c.lead}
		</p>

		<div class="sl-fade mt-9 flex flex-wrap items-center justify-center gap-3" style:animation-delay="380ms">
			<a href="/app" class="sl-btn-primary">{c.ctaPrimary} <ArrowRight size={16} class="sl-arrow" /></a>
			<a href="#vscode" class="sl-btn-ghost">{c.ctaVscode}</a>
		</div>

		<div class="sl-command sl-fade mx-auto mt-6" style:animation-delay="460ms">
			<code class="min-w-0 flex-1 truncate text-left">
				<span class="sl-kw">CREATE TABLE</span> orders (… user_id <span class="sl-kw">REFERENCES</span> users(id));
			</code>
			<button
				class="sl-command-copy"
				onclick={() => copyText(SNIPPET_SQL, 'sql')}
				aria-label={c.copySql}
				title={c.copySqlTitle}
			>
				{#if copiedSql}<Check size={15} />{:else}<Copy size={15} />{/if}
			</button>
		</div>
		<p class="sl-command-hint" aria-live="polite">
			{copiedSql ? c.copiedSqlHint : ' '}
		</p>
	</header>

	<section class="relative mx-auto max-w-6xl px-4 pb-28 sm:px-6" aria-label={c.demoLabel}>
		<div class="sl-demo-frame">
			<HeroDemo copy={c.demo} {lang} />
		</div>
		<p class="mt-4 text-center text-sm text-[var(--l-muted)]">
			{c.demoCaption}
		</p>
	</section>

	<section id="features" class="relative mx-auto max-w-6xl scroll-mt-20 px-4 pb-28 sm:px-6" aria-labelledby="features-title">
		<div class="mx-auto max-w-2xl text-center">
			<h2 id="features-title" class="sl-h2">{c.features.title}</h2>
			<p class="sl-lead mx-auto mt-4">{c.features.lead}</p>
		</div>

		<div class="sl-bento mt-14">
			<article class="sl-tile sl-tile-wide">
				<div class="sl-tile-text">
					<h3 class="sl-h3">{c.tiles.paste.title}</h3>
					<p>{c.tiles.paste.body}</p>
				</div>
				<div class="sl-convert" aria-hidden="true">
					<pre class="sl-convert-code"><span class="sl-kw">CREATE TABLE</span> users (
  id <span class="sl-ty">bigint</span> <span class="sl-kw">PRIMARY KEY</span>
);
<span class="sl-kw">CREATE TABLE</span> orders (
  id      <span class="sl-ty">bigint</span> <span class="sl-kw">PRIMARY KEY</span>,
  user_id <span class="sl-ty">bigint</span>
    <span class="sl-kw">REFERENCES</span> users(id)
);</pre>
					<div class="sl-convert-arrow"><ArrowRight size={18} /></div>
					<div class="sl-mini-graph">
						<div class="sl-mini-card">
							<div class="sl-mini-head">users</div>
							<div class="sl-mini-row"><b class="pk">PK</b> id</div>
						</div>
						<svg class="sl-mini-edge" viewBox="0 0 34 130" preserveAspectRatio="none">
							<path d="M0 42 C 20 42, 14 119, 34 119" />
						</svg>
						<div class="sl-mini-card sl-mini-card-b">
							<div class="sl-mini-head">orders</div>
							<div class="sl-mini-row"><b class="pk">PK</b> id</div>
							<div class="sl-mini-row"><b class="fk">FK</b> user_id</div>
						</div>
					</div>
				</div>
			</article>

			<article class="sl-tile">
				<h3 class="sl-h3">{c.tiles.find.title}</h3>
				<p>{c.tiles.find.body}</p>
				<div class="sl-chips" aria-hidden="true">
					{#each c.tiles.find.chips as [label, on] (label)}<span class:is-on={on}>{label}</span>{/each}
				</div>
			</article>

			<article class="sl-tile">
				<h3 class="sl-h3">{c.tiles.copy.title}</h3>
				<p>{c.tiles.copy.body}</p>
				<div class="sl-chips" aria-hidden="true"><span>PNG</span><span>SVG</span><span>DSL</span></div>
			</article>

			<article class="sl-tile">
				<h3 class="sl-h3">{c.tiles.own.title}</h3>
				<p>{c.tiles.own.body}</p>
				<div class="sl-chips" aria-hidden="true">
					<span>.schema.json</span><span>.dbschema</span><span>.sql</span>
				</div>
			</article>
		</div>
	</section>

	<section id="vscode" class="relative mx-auto max-w-6xl scroll-mt-20 px-4 pb-28 sm:px-6" aria-labelledby="vscode-title">
		<div class="sl-tile sl-vscode">
			<div>
				<h2 id="vscode-title" class="sl-h2">{c.vscode.title}</h2>
				<p class="sl-lead mt-4">{c.vscode.lead}</p>
				<ol class="sl-steps mt-8">
					<li>
						<span class="sl-step">1</span>
						<div>
							{c.vscode.step1.before} <code>.vsix</code> {c.vscode.step1.after}
							<div class="mt-3">
								<a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" class="sl-btn-primary sl-btn-sm">
									<Download size={14} /> {c.vscode.step1.button}
								</a>
							</div>
						</div>
					</li>
					<li><span class="sl-step">2</span><div>{c.vscode.step2.before} <code>.vsix</code> {c.vscode.step2.after}</div></li>
					<li>
						<span class="sl-step">3</span>
						<div>{c.vscode.step3.before} <kbd>Ctrl/Cmd + Shift + P</kbd> {c.vscode.step3.after}</div>
					</li>
				</ol>
			</div>

			<div class="sl-terminal">
				<div class="sl-terminal-bar">
					<div class="flex flex-wrap items-center gap-1" role="group" aria-label={c.vscode.osGroup}>
						{#each SHELLS as [id, label] (id)}
							<button class="sl-terminal-tab {shell === id ? 'is-on' : ''}" aria-pressed={shell === id} onclick={() => (shell = id)}>
								{label}
							</button>
						{/each}
					</div>
					<button
						class="sl-command-copy"
						onclick={() => copyText(INSTALL_COMMANDS[shell], 'install')}
						aria-label={c.vscode.copyInstall}
						title={c.vscode.copyInstall}
					>
						{#if copiedInstall}<Check size={15} />{:else}<Copy size={15} />{/if}
					</button>
				</div>
				<pre class="sl-terminal-body"><code>{INSTALL_COMMANDS[shell]}</code></pre>
				<p class="sl-terminal-note">
					{#if shell === 'claude'}
						{c.vscode.noteClaude}
					{:else}
						{c.vscode.noteShell.before} <code>code</code> {c.vscode.noteShell.after}
					{/if}
				</p>
			</div>
		</div>

		<details class="sl-shortcuts group mt-6">
			<summary>
				<h3 class="text-sm font-semibold">{c.shortcutsTitle}</h3>
				<ChevronDown size={16} class="flex-none text-[var(--l-muted)] transition-transform group-open:rotate-180" />
			</summary>
			<dl>
				{#each c.shortcuts as item (item.keys)}
					<div>
						<dt><kbd>{item.keys}</kbd></dt>
						<dd>{item.action}</dd>
					</div>
				{/each}
			</dl>
		</details>
	</section>

	<section class="relative mx-auto max-w-4xl px-4 pb-32 text-center sm:px-6" aria-labelledby="cta-title">
		<h2 id="cta-title" class="sl-h2">{c.final.title}</h2>
		<p class="sl-lead mx-auto mt-4">{c.final.lead}</p>
		<div class="mt-9 flex flex-wrap items-center justify-center gap-3">
			<a href="/app" class="sl-btn-primary">{c.ctaPrimary} <ArrowRight size={16} class="sl-arrow" /></a>
			<a href={REPO_URL} target="_blank" rel="noopener noreferrer" class="sl-btn-ghost"><Github size={16} /> {c.final.github}</a>
		</div>
	</section>

	<footer class="sl-footer">
		<div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<div class="flex flex-wrap items-center gap-3">
				<Logo size={22} />
				<span class="text-xs text-[var(--l-muted)]">{c.footerNote}</span>
			</div>
			<div class="flex items-center gap-5 text-xs">
				<a href={REPO_URL} target="_blank" rel="noopener noreferrer" class="sl-nav-link">{c.footer.source}</a>
				<a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" class="sl-nav-link">{c.footer.releases}</a>
				<a href="/docs" class="sl-nav-link">{c.footer.docs}</a>
				<a href="/app" class="sl-nav-link">{c.footer.app}</a>
			</div>
		</div>
	</footer>
</div>

<style>
	/* ── 首頁專屬的色票：深色是近乎純黑的底、白字、極淡的格線；淺色是同一套的反相。
	   同時覆寫範例圖用到的 --sl-* / --vscode-*，讓渲染出來的圖跟頁面融在一起。 */
	/* ── 首頁的變數都接到全站的設計規範（app.css）上，只有格線跟亮格這兩個裝飾用色是首頁自己的。 */
	.sl-landing {
		--l-bg: var(--sl-page-bg);
		--l-fg: var(--sl-fg);
		--l-muted: var(--sl-muted);
		--l-card: var(--sl-surface);
		--l-card-2: var(--sl-surface-2);
		--l-primary-bg: var(--sl-primary-bg);
		--l-primary-fg: var(--sl-primary-fg);
		--l-accent: var(--sl-cyan);
		--l-accent-strong: var(--sl-accent-strong);
		--l-accent-fg: #ffffff;
		--l-line: rgb(255 255 255 / 0.08);
		--l-line-strong: rgb(255 255 255 / 0.14);
		--l-cell: rgb(255 255 255 / 0.045);

		position: relative;
		min-height: 100vh;
		overflow-x: clip;
		background: var(--l-bg);
		color: var(--l-fg);
	}
	:global(:root[data-theme='light']) .sl-landing {
		--l-line: rgb(0 0 0 / 0.07);
		--l-line-strong: rgb(0 0 0 / 0.12);
		--l-cell: rgb(9 105 218 / 0.06);
	}

	/* ── 背景格線：56px 一格，往下、往兩側淡出 */
	.sl-grid-bg {
		--size: 56px;
		position: absolute;
		inset: 0 0 auto;
		height: 1100px;
		pointer-events: none;
		background-image:
			linear-gradient(to right, var(--l-line) 1px, transparent 1px),
			linear-gradient(to bottom, var(--l-line) 1px, transparent 1px);
		background-size: var(--size) var(--size);
		background-position: calc(50% + var(--size) / 2) 0;
		mask-image: radial-gradient(ellipse 70% 60% at 50% 22%, #000 30%, transparent 100%);
	}
	.sl-motif-edges {
		position: absolute;
		top: 0;
		left: calc(50% - 11.5 * var(--size));
		overflow: visible;
	}
	.sl-motif-edges path {
		fill: none;
		stroke: var(--l-line-strong);
		stroke-width: 1;
		opacity: 0.35;
		transition:
			stroke 0.6s ease,
			opacity 0.6s ease;
	}
	.sl-motif-edges path.is-lit {
		stroke: var(--l-accent);
		opacity: 0.75;
	}
	.sl-cell {
		position: absolute;
		top: calc(var(--row) * var(--size) + 1px);
		left: calc(50% + (var(--col) - 11.5) * var(--size) + 1px);
		width: calc(var(--size) - 1px);
		height: calc(var(--size) - 1px);
		background: var(--l-cell);
		opacity: 0.35;
		transition:
			opacity 0.6s ease,
			background-color 0.6s ease,
			box-shadow 0.6s ease;
	}
	/* 跟產品裡的聚焦一樣：焦點最亮、直接相連的次之、其餘淡掉 */
	.sl-cell.is-near {
		opacity: 1;
		background: color-mix(in oklab, var(--l-fg) 8%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--l-accent) 30%, transparent);
	}
	.sl-cell.is-focus {
		opacity: 1;
		background: color-mix(in oklab, var(--l-accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--l-accent) 70%, transparent);
	}

	/* ── 導覽列 */
	.sl-nav {
		position: sticky;
		top: 0;
		z-index: 30;
		border-bottom: 1px solid var(--l-line);
		background: color-mix(in oklab, var(--l-bg) 82%, transparent);
		backdrop-filter: saturate(1.4) blur(12px);
	}
	.sl-nav-link {
		color: var(--l-muted);
		transition: color 0.15s ease;
	}
	.sl-nav-link:hover {
		color: var(--l-fg);
	}
	.sl-round-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--l-line-strong);
		border-radius: 9999px;
		color: var(--l-muted);
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.sl-round-icon:hover {
		color: var(--l-fg);
		border-color: var(--l-muted);
	}

	/* ── 按鈕：膠囊形，白底黑字是主要動作，主色是次要動作 */
	.sl-btn-primary,
	.sl-btn-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 46px;
		min-width: 168px;
		border-radius: 9999px;
		padding: 0 24px;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
		transition:
			transform 0.15s ease,
			background-color 0.15s ease,
			border-color 0.15s ease;
	}
	.sl-btn-primary {
		background: var(--l-primary-bg);
		color: var(--l-primary-fg);
		box-shadow:
			0 1px 0 rgb(255 255 255 / 0.2) inset,
			0 8px 24px -12px rgb(0 0 0 / 0.6);
	}
	.sl-btn-primary:hover {
		background: color-mix(in oklab, var(--l-primary-bg) 88%, var(--l-accent));
	}
	.sl-btn-ghost {
		border: 1px solid var(--l-line-strong);
		color: var(--l-fg);
	}
	.sl-btn-ghost:hover {
		border-color: var(--l-muted);
	}
	.sl-btn-primary:active,
	.sl-btn-ghost:active {
		transform: translateY(1px);
	}
	.sl-btn-sm {
		min-height: 36px;
		min-width: 0;
		padding: 0 16px;
		font-size: 13px;
	}
	.sl-landing :global(.sl-arrow) {
		transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.sl-landing a:hover :global(.sl-arrow),
	.sl-landing a:focus-visible :global(.sl-arrow) {
		transform: translateX(3px);
	}

	/* ── Hero */
	.sl-announce {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		border: 1px solid color-mix(in oklab, var(--l-accent) 40%, transparent);
		border-radius: 9999px;
		background: color-mix(in oklab, var(--l-accent) 8%, var(--l-bg));
		padding: 6px 14px 6px 12px;
		font-size: 13px;
		color: color-mix(in oklab, var(--l-accent) 65%, var(--l-fg));
		transition: border-color 0.15s ease;
	}
	.sl-announce:hover {
		border-color: var(--l-accent);
	}
	.sl-announce-dot {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		background: var(--l-accent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--l-accent) 25%, transparent);
	}
	.sl-display {
		font-family: 'Lexend', 'Noto Sans TC', 'Geist', sans-serif;
		font-size: clamp(2.1rem, 6.4vw, 4.5rem);
		font-weight: 500;
		line-height: 1.14;
		letter-spacing: -0.035em;
	}
	.sl-display-muted {
		color: color-mix(in oklab, var(--l-fg) 52%, var(--l-bg));
	}
	.sl-line {
		display: block;
		overflow: hidden;
		padding-bottom: 0.2em;
		margin-bottom: -0.2em;
	}
	.sl-line-inner {
		display: inline-block;
		animation: sl-rise 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes sl-rise {
		from {
			transform: translateY(105%);
		}
	}
	/* 「關聯」底下的手繪線：呼應「不用再自己畫」，標題升上來之後才畫出來 */
	.sl-swash-word {
		position: relative;
		display: inline-block;
	}
	.sl-swash {
		position: absolute;
		left: -6%;
		bottom: -0.1em;
		width: 112%;
		height: 0.3em;
		overflow: visible;
	}
	.sl-swash path {
		fill: none;
		stroke: var(--l-accent);
		stroke-width: 5;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: sl-draw 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.75s forwards;
	}
	@keyframes sl-draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.sl-lead {
		max-width: 40rem;
		font-size: clamp(1rem, 1.6vw, 1.125rem);
		line-height: 1.75;
		color: var(--l-muted);
	}
	.sl-fade {
		animation: sl-fade-up 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes sl-fade-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	/* 可以複製的指令框：放一段真的能貼進工作區的 SQL */
	.sl-command {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 34rem;
		border: 1px solid var(--l-line-strong);
		border-radius: 12px;
		background: color-mix(in oklab, var(--l-card) 85%, transparent);
		padding: 8px 8px 8px 16px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 13px;
		color: var(--l-fg);
	}
	.sl-command-copy {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 8px;
		color: var(--l-muted);
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}
	.sl-command-copy:hover {
		color: var(--l-fg);
		background: var(--l-line);
	}
	.sl-command-hint {
		margin-top: 8px;
		min-height: 1.25rem;
		font-size: 12px;
		color: var(--l-accent);
	}
	.sl-kw {
		color: var(--l-accent);
	}
	.sl-ty {
		color: #2fb69b;
	}

	/* ── 範例圖外框：再包一層細邊跟柔光，看起來是一個「產品畫面」 */
	.sl-demo-frame {
		border: 1px solid var(--l-line);
		border-radius: 22px;
		background: color-mix(in oklab, var(--l-card-2) 60%, transparent);
		padding: 8px;
		box-shadow:
			0 1px 0 color-mix(in oklab, var(--l-fg) 6%, transparent) inset,
			0 40px 80px -48px rgb(0 0 0 / 0.65);
	}
	.sl-demo-frame :global(.sl-demo) {
		border-radius: 15px;
		box-shadow: none;
	}

	/* ── 段落標題 */
	.sl-h2 {
		font-family: 'Lexend', 'Noto Sans TC', 'Geist', sans-serif;
		font-size: clamp(1.6rem, 3.4vw, 2.4rem);
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.sl-h3 {
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--l-fg);
	}

	/* ── Bento：一張寬卡帶「SQL → 圖」的示意，其餘三張排在下面 */
	.sl-bento {
		display: grid;
		gap: 16px;
		grid-template-columns: 1fr;
	}
	@media (min-width: 900px) {
		.sl-bento {
			grid-template-columns: repeat(3, 1fr);
		}
		.sl-tile-wide {
			grid-column: span 3;
		}
	}
	.sl-tile {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--l-line);
		border-radius: 18px;
		background-color: var(--l-card);
		background-image:
			linear-gradient(to right, var(--l-line) 1px, transparent 1px),
			linear-gradient(to bottom, var(--l-line) 1px, transparent 1px);
		background-size: 28px 28px;
		padding: 26px;
		transition: border-color 0.2s ease;
	}
	.sl-tile::before {
		/* 格線只留在右上角，其餘被底色蓋掉，像卡片角落透出一點畫布 */
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 100% 0%, transparent 0, var(--l-card) 55%);
		pointer-events: none;
	}
	.sl-tile > :global(*) {
		position: relative;
	}
	.sl-tile:hover {
		border-color: var(--l-line-strong);
	}
	/* 指到一張卡，其他卡淡掉——首頁上也用「聚焦」說話 */
	.sl-tile {
		transition:
			border-color 0.2s ease,
			opacity 0.3s ease;
	}
	@media (hover: hover) {
		.sl-bento:has(.sl-tile:hover) .sl-tile:not(:hover) {
			opacity: 0.45;
		}
	}
	.sl-tile p {
		margin-top: 8px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--l-muted);
	}
	.sl-tile-wide {
		display: grid;
		gap: 28px;
		align-items: center;
	}
	@media (min-width: 900px) {
		.sl-tile-wide {
			grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
			padding: 36px;
		}
	}
	.sl-tile-text {
		max-width: 26rem;
	}
	.sl-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 20px;
	}
	.sl-chips span {
		border: 1px solid var(--l-line-strong);
		border-radius: 9999px;
		padding: 3px 10px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11.5px;
		color: var(--l-muted);
	}
	.sl-chips span.is-on {
		border-color: color-mix(in oklab, var(--l-accent) 55%, transparent);
		background: color-mix(in oklab, var(--l-accent) 12%, transparent);
		color: var(--l-accent);
	}

	/* SQL → 圖 的示意 */
	.sl-convert {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 16px;
	}
	.sl-convert-code {
		overflow: hidden;
		border: 1px solid var(--l-line);
		border-radius: 12px;
		background: var(--l-card-2);
		padding: 14px 16px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 12px;
		line-height: 1.65;
		color: var(--l-fg);
	}
	.sl-convert-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--l-line-strong);
		border-radius: 9999px;
		background: var(--l-card);
		color: var(--l-accent);
	}
	.sl-mini-graph {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
		align-items: start;
	}
	.sl-mini-card {
		overflow: hidden;
		border: 1px solid color-mix(in oklab, var(--l-accent) 55%, transparent);
		border-radius: 8px;
		background: var(--l-card);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11.5px;
		box-shadow: 0 10px 24px -16px rgb(0 0 0 / 0.6);
	}
	.sl-mini-card-b {
		margin-top: 52px;
	}
	.sl-mini-head {
		border-bottom: 1px solid color-mix(in oklab, var(--l-accent) 35%, transparent);
		background: color-mix(in oklab, var(--l-accent) 18%, var(--l-card));
		padding: 5px 9px;
		font-weight: 700;
		color: var(--l-fg);
	}
	.sl-mini-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 9px;
		color: var(--l-fg);
	}
	.sl-mini-row b {
		border: 1px solid currentColor;
		border-radius: 3px;
		padding: 0 3px;
		font-size: 9.5px;
		line-height: 13px;
	}
	.sl-mini-row b.pk {
		color: #d4a72c;
	}
	.sl-mini-row b.fk {
		color: var(--l-accent);
	}
	.sl-mini-edge {
		width: 34px;
		height: 130px;
		overflow: visible;
	}
	.sl-mini-edge path {
		fill: none;
		stroke: var(--l-accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	@media (max-width: 639px) {
		.sl-convert {
			grid-template-columns: 1fr;
		}
		.sl-convert-arrow {
			transform: rotate(90deg);
			justify-self: center;
		}
	}

	/* ── VS Code 區 */
	.sl-vscode {
		display: grid;
		gap: 36px;
		padding: 28px;
	}
	@media (min-width: 960px) {
		.sl-vscode {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
			align-items: center;
			padding: 44px;
		}
	}
	.sl-steps {
		display: grid;
		gap: 16px;
		font-size: 14.5px;
		line-height: 1.7;
		color: color-mix(in oklab, var(--l-fg) 78%, var(--l-bg));
	}
	.sl-steps li {
		display: flex;
		gap: 12px;
	}
	.sl-step {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--l-line-strong);
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 700;
		color: var(--l-fg);
	}
	.sl-steps :global(code),
	.sl-terminal-note :global(code),
	.sl-landing :global(kbd) {
		border: 1px solid var(--l-line-strong);
		border-radius: 6px;
		background: var(--l-card-2);
		padding: 1px 6px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.85em;
	}
	.sl-terminal {
		overflow: hidden;
		border: 1px solid var(--l-line-strong);
		border-radius: 14px;
		background: #09090b;
		color: #e4e4e7;
		box-shadow: 0 30px 60px -36px rgb(0 0 0 / 0.7);
	}
	.sl-terminal-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
		padding: 8px 8px 8px 10px;
	}
	.sl-terminal-tab {
		min-height: 30px;
		border-radius: 8px;
		padding: 0 10px;
		font-size: 12.5px;
		color: #a1a1aa;
	}
	.sl-terminal-tab:hover {
		color: #fafafa;
	}
	.sl-terminal-tab.is-on {
		background: rgb(255 255 255 / 0.08);
		color: #fafafa;
	}
	.sl-terminal .sl-command-copy {
		color: #a1a1aa;
	}
	.sl-terminal .sl-command-copy:hover {
		color: #fafafa;
		background: rgb(255 255 255 / 0.08);
	}
	.sl-terminal-body {
		overflow-x: auto;
		padding: 18px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 12.5px;
		line-height: 1.75;
	}
	.sl-terminal-note {
		border-top: 1px solid rgb(255 255 255 / 0.08);
		padding: 12px 18px;
		font-size: 12px;
		line-height: 1.7;
		color: #a1a1aa;
	}
	.sl-terminal-note :global(code) {
		background: rgb(255 255 255 / 0.06) !important;
		border-color: rgb(255 255 255 / 0.12) !important;
		color: #e4e4e7;
	}

	.sl-shortcuts {
		border: 1px solid var(--l-line);
		border-radius: 14px;
		background: var(--l-card);
	}
	.sl-shortcuts summary {
		display: flex;
		min-height: 52px;
		cursor: pointer;
		list-style: none;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 0 20px;
	}
	.sl-shortcuts summary::-webkit-details-marker {
		display: none;
	}
	.sl-shortcuts dl {
		display: grid;
		border-top: 1px solid var(--l-line);
		padding: 8px 0;
	}
	@media (min-width: 768px) {
		.sl-shortcuts dl {
			grid-template-columns: 1fr 1fr;
		}
	}
	.sl-shortcuts dl > div {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 20px;
		font-size: 14px;
	}
	@media (min-width: 640px) {
		.sl-shortcuts dl > div {
			flex-direction: row;
			align-items: center;
			gap: 16px;
		}
		.sl-shortcuts dt {
			width: 11rem;
			flex: none;
		}
	}
	.sl-shortcuts dd {
		color: var(--l-muted);
	}

	.sl-footer {
		border-top: 1px solid var(--l-line);
	}

	@media (prefers-reduced-motion: reduce) {
		.sl-cell,
		.sl-motif-edges path {
			transition: none;
		}
		.sl-line-inner,
		.sl-fade {
			animation: sl-fade-in 0.4s ease both;
		}
		.sl-swash path {
			animation: none;
			stroke-dashoffset: 0;
		}
		@keyframes sl-fade-in {
			from {
				opacity: 0;
			}
		}
	}
</style>
