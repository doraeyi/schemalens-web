<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowRight,
		Check,
		ChevronDown,
		Copy,
		Download,
		FileInput,
		Search,
		Sparkles,
		SunMoon
	} from '@lucide/svelte';
	import { getTheme, toggleTheme } from '$lib/stores/theme.svelte';

	let theme = $state(getTheme());

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

	const RELEASES_URL = 'https://github.com/doraeyi/schemalens-web/releases/latest';

	let shell = $state<keyof typeof INSTALL_COMMANDS>('bash');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let showAdvanced = $state(false);

	async function copyInstallCommand(): Promise<void> {
		try {
			await navigator.clipboard.writeText(INSTALL_COMMANDS[shell]);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard blocked — the command block itself is still visible to copy by hand
		}
	}

	const features = [
		{
			icon: Sparkles,
			title: 'DSL 轉互動圖表',
			body: '貼上 .dbschema、.schema.json 或內嵌 ```dbschema 的 Markdown，立即渲染成可探索的資料表關聯圖。'
		},
		{
			icon: Search,
			title: '大型 Schema 也能秒找',
			body: '100+ 張表也能靠 Focus / Depth / Direction / 搜尋快速定位到你要的那張表與欄位。'
		},
		{
			icon: Copy,
			title: '右鍵複製 PNG / SVG / 文字',
			body: '選好想要的範圍，右鍵就能把圖表複製成 PNG 圖片、SVG，或該資料表的 DSL 文字。'
		},
		{
			icon: FileInput,
			title: '匯入匯出no lock-in',
			body: '不登入也能用；資料留在瀏覽器本機，隨時可以匯出 .schema.json / .dbschema 備份。'
		}
	];

	const shortcuts = [
		{ keys: 'Ctrl / Cmd + F', action: '搜尋資料表或欄位' },
		{ keys: 'Ctrl / Cmd + 滾輪', action: '縮放畫布' },
		{ keys: 'Esc', action: '取消目前的聚焦' },
		{ keys: '拖曳背景', action: '平移畫布' },
		{ keys: '單擊 Table 標題', action: 'Focus：相關表 active，其餘 dim/hide' },
		{ keys: '單擊欄位', action: '欄位級聚焦：只亮該欄位與 FK 對應欄位' },
		{ keys: '雙擊 Table / Column', action: '跳回 DSL 來源定義' },
		{ keys: '卡片標題 ▾', action: 'Collapse / Expand 該資料表' }
	];

	let heroEl: HTMLElement | undefined = $state();
	let cardsEl: HTMLDivElement | undefined = $state();

	onMount(async () => {
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) return;

		const gsapModule = await import('gsap');
		const { ScrollTrigger } = await import('gsap/ScrollTrigger');
		const gsap = gsapModule.default;
		gsap.registerPlugin(ScrollTrigger);

		if (heroEl) {
			gsap.from(heroEl.querySelectorAll('[data-hero-item]'), {
				opacity: 0,
				y: 24,
				duration: 0.7,
				stagger: 0.12,
				ease: 'power3.out'
			});
		}
		if (cardsEl) {
			gsap.from(cardsEl.querySelectorAll('[data-feature-card]'), {
				opacity: 0,
				y: 30,
				duration: 0.6,
				stagger: 0.1,
				ease: 'power2.out',
				scrollTrigger: {
					trigger: cardsEl,
					start: 'top 80%'
				}
			});
		}
	});
</script>

<svelte:head>
	<title>SchemaLens — 看懂資料表之間的關聯</title>
</svelte:head>

<div class="relative min-h-screen overflow-x-hidden bg-bg text-fg">
	<div class="sl-bg-fx" aria-hidden="true">
		<div class="sl-blob sl-blob-cyan"></div>
		<div class="sl-blob sl-blob-violet"></div>
		<svg class="sl-graph" viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg">
			<g stroke="var(--sl-cyan)" stroke-opacity="0.35" stroke-width="1">
				<line x1="80" y1="90" x2="230" y2="60" />
				<line x1="230" y1="60" x2="380" y2="140" />
				<line x1="230" y1="60" x2="150" y2="220" />
				<line x1="380" y1="140" x2="520" y2="90" />
				<line x1="380" y1="140" x2="440" y2="280" />
				<line x1="150" y1="220" x2="300" y2="320" />
				<line x1="440" y1="280" x2="300" y2="320" />
			</g>
			<g fill="var(--sl-cyan)">
				<circle cx="80" cy="90" r="5" />
				<circle cx="230" cy="60" r="6" />
				<circle cx="380" cy="140" r="7" />
				<circle cx="520" cy="90" r="5" />
				<circle cx="150" cy="220" r="5" />
				<circle cx="440" cy="280" r="6" />
				<circle cx="300" cy="320" r="5" />
			</g>
		</svg>
	</div>

	<nav class="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
		<div class="flex items-center gap-2 text-sm font-semibold tracking-wide">
			<span class="inline-block h-2 w-2 rounded-full bg-cyan shadow-[0_0_12px_var(--sl-cyan)]"></span>
			SchemaLens
		</div>
		<div class="flex items-center gap-3">
			<button
				class="rounded-md border border-border p-2 text-muted hover:border-cyan hover:text-cyan"
				onclick={handleToggleTheme}
				title="切換深淺色"
			>
				<SunMoon size={15} />
			</button>
			<a
				href="/app"
				class="flex items-center gap-1.5 rounded-md bg-cyan px-3.5 py-1.5 text-xs font-semibold text-bg hover:brightness-110"
			>
				開始使用 <ArrowRight size={13} />
			</a>
		</div>
	</nav>

	<header bind:this={heroEl} class="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
		<div
			data-hero-item
			class="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] text-muted"
		>
			<Sparkles size={12} class="text-cyan" /> 與 VS Code 插件共用同一套渲染引擎
		</div>
		<h1 data-hero-item class="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
			看懂資料表之間的<span class="text-cyan">關聯</span>，<br />不用再自己畫 ER 圖
		</h1>
		<p data-hero-item class="mx-auto mt-5 max-w-xl text-sm text-muted sm:text-base">
			SchemaLens 把 DSL / JSON / Markdown 定義的資料庫結構，變成可以搜尋、聚焦、探索的互動關聯圖。
			網頁版不用登入就能用，也可以搭配 VS Code 插件一起工作。
		</p>
		<div data-hero-item class="mt-8 flex flex-wrap items-center justify-center gap-3">
			<a
				href="/app"
				class="flex items-center gap-2 rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_24px_rgba(34,211,238,0.35)] hover:brightness-110"
			>
				開始使用 <ArrowRight size={15} />
			</a>
			<a
				href="#shortcuts"
				class="rounded-lg border border-border px-5 py-2.5 text-sm text-fg hover:border-cyan hover:text-cyan"
			>
				查看 VS Code 快捷鍵
			</a>
		</div>
	</header>

	<section class="relative z-10 mx-auto max-w-6xl px-6 pb-24">
		<div bind:this={cardsEl} class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each features as feature (feature.title)}
				<div
					data-feature-card
					class="rounded-xl border border-border bg-surface/70 p-5 backdrop-blur-sm transition-colors hover:border-cyan"
				>
					<feature.icon size={20} class="mb-3 text-cyan" />
					<h3 class="mb-1.5 text-sm font-semibold">{feature.title}</h3>
					<p class="text-xs leading-relaxed text-muted">{feature.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="shortcuts" class="relative z-10 mx-auto max-w-4xl px-6 pb-28">
		<h2 class="mb-1 text-center text-2xl font-bold">VS Code 插件</h2>
		<p class="mb-6 text-center text-sm text-muted">插件還沒上架到官方市集，三步驟手動安裝即可，不用裝額外工具。</p>

		<div class="mx-auto mb-3 max-w-xl overflow-hidden rounded-xl border border-border bg-surface/80">
			<ol class="divide-y divide-border text-sm">
				<li class="flex items-start gap-3 p-4">
					<span class="sl-step">1</span>
					<div class="flex-1">
						<p>
							到 Releases 頁面下載最新的
							<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-cyan">.vsix</code> 檔案，公開 repo，不用登入。
						</p>
						<a
							href={RELEASES_URL}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-cyan px-3.5 py-1.5 text-xs font-semibold text-bg hover:brightness-110"
						>
							<Download size={13} /> 前往下載頁
						</a>
					</div>
				</li>
				<li class="flex items-start gap-3 p-4">
					<span class="sl-step">2</span>
					<p class="flex-1">
						打開 VS Code，把下載好的 <code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-cyan">.vsix</code>
						檔案直接拖曳進視窗裡。
					</p>
				</li>
				<li class="flex items-start gap-3 p-4">
					<span class="sl-step">3</span>
					<p class="flex-1">
						或者不想拖曳的話：<kbd class="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-cyan"
							>Ctrl/Cmd + Shift + P</kbd
						>
						→ 輸入「Install from VSIX」→ 選剛下載的檔案。
					</p>
				</li>
			</ol>
		</div>

		<div class="mx-auto mb-8 max-w-xl">
			<button
				class="flex items-center gap-1 text-xs text-muted hover:text-fg"
				onclick={() => (showAdvanced = !showAdvanced)}
			>
				<ChevronDown size={13} class="transition-transform {showAdvanced ? 'rotate-180' : ''}" />
				想用指令列一次裝好？
			</button>
			{#if showAdvanced}
				<div class="mt-3 overflow-hidden rounded-xl border border-border bg-surface/80">
					<div class="flex items-center justify-between border-b border-border px-4 py-2">
						<div class="flex items-center gap-1">
							<button
								class="sl-shell-tab {shell === 'bash' ? 'sl-shell-tab-active' : ''}"
								onclick={() => (shell = 'bash')}
							>
								macOS / Linux
							</button>
							<button
								class="sl-shell-tab {shell === 'powershell' ? 'sl-shell-tab-active' : ''}"
								onclick={() => (shell = 'powershell')}
							>
								Windows
							</button>
							<button
								class="sl-shell-tab {shell === 'claude' ? 'sl-shell-tab-active' : ''}"
								onclick={() => (shell = 'claude')}
							>
								Claude Code
							</button>
						</div>
						<button
							class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-cyan hover:text-cyan"
							onclick={copyInstallCommand}
						>
							{#if copied}
								<Check size={12} class="text-cyan" /> 已複製
							{:else}
								<Copy size={12} /> 複製指令
							{/if}
						</button>
					</div>
					<pre class="overflow-x-auto px-4 py-3 font-mono text-xs text-fg"><code
							>{INSTALL_COMMANDS[shell]}</code
						></pre>
				</div>
				<p class="mt-2 text-xs text-muted">
					{#if shell === 'claude'}
						這兩行是 Claude Code 裡的指令，不是終端機指令——直接貼進 Claude Code 對話框執行。第一行把
						<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-cyan">doraeyi/schemalens-web</code
						> 註冊成 plugin marketplace，第二行安裝擴充，Claude Code 會自動幫你下載 .vsix 並用
						<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-cyan">code</code> 指令裝好。
					{:else}
						公開 repo，不用額外裝 CLI 工具或登入——只要 VS Code 要能在終端機打
						<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-cyan">code</code> 指令（VS Code 裡
						<kbd class="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-cyan"
							>Shell Command: Install 'code' command in PATH</kbd
						> 可以設定）。
					{/if}
				</p>
			{/if}
		</div>

		<h3 class="mb-4 text-center text-sm font-semibold text-muted">安裝好之後，這些快捷鍵跟網頁版通用</h3>
		<div class="overflow-hidden rounded-xl border border-border">
			{#each shortcuts as item, i (item.keys)}
				<div
					class="flex items-center gap-4 px-5 py-3 text-sm {i % 2 === 0
						? 'bg-surface/60'
						: 'bg-transparent'}"
				>
					<kbd
						class="min-w-40 flex-none rounded-md border border-border bg-surface-2 px-2.5 py-1 text-center font-mono text-xs text-cyan"
					>
						{item.keys}
					</kbd>
					<span class="text-muted">{item.action}</span>
				</div>
			{/each}
		</div>
	</section>

	<footer class="relative z-10 border-t border-border py-6 text-center text-xs text-muted">
		SchemaLens
	</footer>
</div>

<style>
	.sl-step {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 9999px;
		background: var(--sl-cyan);
		color: var(--sl-bg);
		font-size: 11px;
		font-weight: 700;
	}
	.sl-shell-tab {
		padding: 3px 8px;
		border-radius: 6px;
		font-size: 11px;
		color: var(--sl-muted);
	}
	.sl-shell-tab:hover {
		color: var(--sl-fg);
	}
	.sl-shell-tab-active {
		background: color-mix(in oklab, var(--sl-cyan) 16%, transparent);
		color: var(--sl-cyan);
	}
	.sl-bg-fx {
		position: absolute;
		inset: 0;
		overflow: hidden;
		z-index: 0;
		pointer-events: none;
	}
	.sl-blob {
		position: absolute;
		border-radius: 9999px;
		filter: blur(90px);
		opacity: 0.35;
		animation: sl-drift 16s ease-in-out infinite;
	}
	.sl-blob-cyan {
		top: -10%;
		left: -5%;
		width: 32rem;
		height: 32rem;
		background: var(--sl-cyan);
	}
	.sl-blob-violet {
		bottom: -15%;
		right: -10%;
		width: 30rem;
		height: 30rem;
		background: var(--sl-violet);
		animation-delay: -8s;
	}
	@keyframes sl-drift {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(4%, 5%) scale(1.08);
		}
	}
	.sl-graph {
		position: absolute;
		top: 8%;
		right: 4%;
		width: min(46vw, 560px);
		opacity: 0.5;
		animation: sl-pulse 6s ease-in-out infinite;
	}
	@keyframes sl-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
