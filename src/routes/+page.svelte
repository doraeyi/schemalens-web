<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Copy, FileInput, Search, Sparkles, SunMoon } from '@lucide/svelte';
	import { getTheme, toggleTheme } from '$lib/stores/theme.svelte';

	let theme = $state(getTheme());

	function handleToggleTheme(): void {
		toggleTheme();
		theme = getTheme();
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
		<h2 class="mb-1 text-center text-2xl font-bold">VS Code 插件快捷鍵</h2>
		<p class="mb-8 text-center text-sm text-muted">
			網頁版工作區的操作邏輯和 VS Code 插件一致，兩邊切換不用重新學。
		</p>
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
		<p class="mt-6 text-center text-xs text-muted">
			VS Code 插件目前透過私有 GitHub Repository 發布，需要 Repository 權限才能下載。
		</p>
	</section>

	<footer class="relative z-10 border-t border-border py-6 text-center text-xs text-muted">
		SchemaLens
	</footer>
</div>

<style>
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
