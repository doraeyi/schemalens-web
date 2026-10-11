<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Pause, Play } from '@lucide/svelte';
	import { SchemaRenderer, stringsFor } from '@schemalens/schema-renderer';
	import { loadSchemaFromText } from '$lib/schema/documentSchema';
	import { SAMPLE_SCHEMA_DSL, SAMPLE_SCHEMA_FILENAME } from '$lib/schema/sampleSchema';
	import { LANDING_COPY, type LandingCopy } from '$lib/landing/copy';

	let { copy = LANDING_COPY.zh.demo }: { copy?: LandingCopy['demo'] } = $props();

	/**
	 * 首頁的產品畫面：不是截圖，是跟工作區同一個渲染引擎跑起來的真圖，可以直接點。
	 *
	 * 動畫只有一段，而且就是產品本身的功能：
	 * 1. 捲到這裡時，圖「組起來」——群組框淡入、表依版面由左到右浮現、關聯線一條條畫出來。
	 * 2. 接著自動導覽：每隔幾秒聚焦下一張表，示範「相關的亮起、其他淡掉」。
	 * 滑鼠停在圖上就暫停；一點圖就把控制權交給使用者，不再自己跳。
	 */
	const t = $derived(stringsFor(copy === LANDING_COPY.en.demo ? 'en' : 'zh-hant'));
	const TOUR = ['dbo.Posts', 'dbo.Comments', 'dbo.Users', 'dbo.PostTags', 'dbo.Tags'];
	const STEP_MS = 3200;
	const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

	let host: HTMLDivElement | undefined = $state();
	let figureEl: HTMLElement | undefined = $state();
	let renderer: SchemaRenderer | null = null;

	let focusedName = $state<string | null>(null);
	let introDone = $state(false);
	/** 組裝開始前先把圖藏起來，不然會先完整閃一次、消失、再組裝。 */
	let preIntro = $state(true);
	let reduceMotion = $state(false);
	/** 使用者按了暫停，或自己點了圖（接手操作）就是 false。 */
	let autoplay = $state(true);
	let hovering = $state(false);
	let inView = $state(false);
	let pageVisible = $state(true);
	let step = $state(0);

	const touring = $derived(introDone && !reduceMotion && autoplay && !hovering && inView && pageVisible);

	function nameOf(id: string): string {
		return id.split('.').pop() ?? id;
	}

	function syncFocus(): void {
		const id = renderer?.getViewState().focus.tableId ?? null;
		focusedName = id ? nameOf(id) : null;
	}

	function focusStep(index: number): void {
		if (!renderer) return;
		step = index % TOUR.length;
		renderer.focusTable(TOUR[step]);
		syncFocus();
	}

	/**
	 * 自動導覽的計時器就是進度條本身的動畫：跑完就換下一張，暫停時動畫跟著停，
	 * 不用另外算剩餘時間。每換一步（或重新開始播放）就重建一次。
	 */
	let barEl: HTMLSpanElement | undefined = $state();
	let barAnim: Animation | null = null;

	$effect(() => {
		const el = barEl;
		const current = step;
		if (!el || !introDone || !autoplay || reduceMotion) return;
		const anim = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
			duration: STEP_MS,
			easing: 'linear',
			fill: 'both'
		});
		if (!untrack(() => touring)) anim.pause();
		anim.onfinish = () => focusStep(current + 1);
		barAnim = anim;
		return () => {
			anim.onfinish = null;
			anim.cancel();
			if (barAnim === anim) barAnim = null;
		};
	});

	$effect(() => {
		if (touring) barAnim?.play();
		else barAnim?.pause();
	});

	function resetFocus(): void {
		if (!renderer) return;
		autoplay = false;
		renderer.setViewState({ focus: { ...renderer.getViewState().focus, tableId: null } });
		syncFocus();
	}

	function toggleAutoplay(): void {
		autoplay = !autoplay;
		if (autoplay && !focusedName) focusStep(step);
	}

	/** 組裝動畫：全部用 Web Animations，fill: 'backwards'，結束後完全回到渲染引擎自己的樣式。 */
	async function playIntro(): Promise<void> {
		if (!host) return;
		const boxes = [...host.querySelectorAll<HTMLElement>('.dbs-group-box')];
		const cards = [...host.querySelectorAll<HTMLElement>('.dbs-card')].sort((a, b) => {
			const ra = a.getBoundingClientRect();
			const rb = b.getBoundingClientRect();
			return ra.left - rb.left || ra.top - rb.top;
		});
		const edges = [...host.querySelectorAll<SVGPathElement>('.dbs-edge-path')];
		const labels = [...host.querySelectorAll<SVGElement>('.dbs-edge-label')];

		// 剛載入頁面就已經在畫面上時，等標題的進場（約 0.8 秒）跑得差不多再開始組裝，兩段動畫不要搶。
		const base = Math.max(120, 750 - performance.now());
		const running: Animation[] = [];
		for (const box of boxes) {
			running.push(
				box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: base - 100, easing: 'ease-out', fill: 'backwards' })
			);
		}
		cards.forEach((card, i) => {
			running.push(
				card.animate(
					[
						{ opacity: 0, transform: 'translateY(18px) scale(0.97)', filter: 'blur(3px)' },
						{ opacity: 1, transform: 'none', filter: 'blur(0)' }
					],
					{ duration: 620, delay: base + i * 80, easing: EASE_OUT, fill: 'backwards' }
				)
			);
		});

		const edgesStart = base + cards.length * 80 + 120;
		edges.forEach((path, i) => {
			const length = path.getTotalLength();
			path.style.strokeDasharray = `${length}`;
			const anim = path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
				duration: 560,
				delay: edgesStart + i * 70,
				easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
				fill: 'backwards'
			});
			anim.finished.then(() => path.style.removeProperty('stroke-dasharray')).catch(() => {});
			running.push(anim);
		});
		labels.forEach((label) => {
			running.push(
				label.animate([{ opacity: 0 }, { opacity: 1 }], {
					duration: 300,
					delay: edgesStart + edges.length * 70 + 200,
					fill: 'backwards'
				})
			);
		});

		// 每個動畫都是 fill: 'backwards'，延遲期間就已經是起始狀態（看不見），這時才能把遮蓋拿掉。
		preIntro = false;
		await Promise.allSettled(running.map((a) => a.finished));
	}

	onMount(() => {
		if (!host || !figureEl) return;
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const { schema } = loadSchemaFromText(SAMPLE_SCHEMA_DSL, SAMPLE_SCHEMA_FILENAME);
		renderer = new SchemaRenderer(host, {
			locale: 'zh-hant',
			events: {
				tableSelected: syncFocus,
				viewStateChanged: syncFocus
			}
		});
		renderer.setInteractionMode('move');
		renderer.setAutoCenterOnFocus(false);

		// 卡片寬度是量實際文字算的，等網頁字型載好再畫，不然字型換上來後欄位會被截掉（最多等 1.5 秒）。
		let disposed = false;
		const fontsReady = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
			if (disposed || !renderer) return;
			renderer.setSchema(schema);
			renderer.fitView(56);
			if (reduceMotion) {
				// 不組裝、不自動導覽：直接停在聚焦 Posts 的畫面，效果一眼看得到，但畫面不會自己動。
				preIntro = false;
				autoplay = false;
				introDone = true;
				focusStep(0);
			}
		});

		// 渲染引擎在畫布上用滾輪平移；首頁上這樣會把整頁的捲動吃掉。
		// 沒按 Ctrl/Cmd 的滾輪在進到引擎之前攔下來，讓頁面照常捲動。
		const passWheelToPage = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
		};
		// 使用者自己點了圖就是要自己玩，自動導覽讓位，不要在他看的時候突然換焦點。
		const takeOver = () => {
			autoplay = false;
		};
		host.addEventListener('wheel', passWheelToPage, { capture: true });
		host.addEventListener('pointerdown', takeOver);

		const resizeObserver = new ResizeObserver(() => renderer?.fitView(56));
		resizeObserver.observe(host);

		let introStarted = reduceMotion;
		const intersection = new IntersectionObserver(
			([entry]) => {
				inView = entry.isIntersecting;
				if (inView && !introStarted) {
					introStarted = true;
					void fontsReady.then(playIntro).then(() => {
						introDone = true;
						if (autoplay) focusStep(0);
					});
				}
			},
			{ threshold: 0.35 }
		);
		intersection.observe(figureEl);

		const handleVisibility = () => (pageVisible = document.visibilityState === 'visible');
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			disposed = true;
			resizeObserver.disconnect();
			intersection.disconnect();
			document.removeEventListener('visibilitychange', handleVisibility);
			host?.removeEventListener('wheel', passWheelToPage, { capture: true });
			host?.removeEventListener('pointerdown', takeOver);
			renderer?.dispose();
			renderer = null;
		};
	});
</script>

<figure
	bind:this={figureEl}
	class="sl-demo"
	onpointerenter={() => (hovering = true)}
	onpointerleave={() => (hovering = false)}
>
	<figcaption class="sl-demo-bar">
		<span class="flex min-w-0 items-center gap-2">
			<span class="font-mono text-fg">blog.dbschema</span>
			<span class="hidden text-muted sm:inline">· {copy.meta}</span>
		</span>
		<span class="flex flex-none items-center gap-2">
			{#if focusedName}
				{#key focusedName}
					<span class="sl-demo-chip">{copy.focus(focusedName)}</span>
				{/key}
				<button class="text-muted underline-offset-2 hover:text-fg hover:underline" onclick={resetFocus}>
					{t.resetFocus}
				</button>
			{:else if introDone}
				<span class="text-muted">{copy.hint}</span>
			{/if}
			{#if introDone && !reduceMotion}
				<button
					class="sl-icon-btn border border-border text-muted"
					onclick={toggleAutoplay}
					aria-pressed={autoplay}
					aria-label={autoplay ? copy.pause : copy.play}
					title={autoplay ? copy.pause : copy.playTitle}
				>
					{#if autoplay}<Pause size={13} />{:else}<Play size={13} />{/if}
				</button>
			{/if}
		</span>
	</figcaption>

	<div class="sl-demo-progress" aria-hidden="true">
		{#if introDone && autoplay && !reduceMotion}
			<span bind:this={barEl} class="sl-demo-progress-bar"></span>
		{/if}
	</div>

	<div bind:this={host} class="sl-demo-canvas" class:is-pre-intro={preIntro}></div>
</figure>

<style>
	.sl-demo {
		overflow: hidden;
		border: 1px solid var(--sl-border);
		border-radius: 14px;
		background: var(--sl-surface);
		box-shadow: 0 30px 60px -36px rgb(0 0 0 / 0.55);
	}
	.sl-demo-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
		padding: 8px 10px 8px 14px;
		font-size: 12px;
	}
	.sl-demo-chip {
		border-radius: 9999px;
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
		padding: 2px 9px;
		font-weight: 600;
		color: var(--sl-cyan);
		animation: sl-chip-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes sl-chip-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	/* 自動導覽的倒數：一條細線，跑滿就換下一張表。 */
	.sl-demo-progress {
		position: relative;
		height: 2px;
		background: var(--sl-border);
	}
	.sl-demo-progress-bar {
		position: absolute;
		inset: 0;
		background: var(--sl-cyan);
		transform-origin: left;
		transform: scaleX(0);
	}

	.sl-demo-canvas {
		position: relative;
		height: clamp(320px, 58vh, 540px);
	}

	.sl-demo-canvas.is-pre-intro :global(:is(.dbs-card, .dbs-edge, .dbs-group-box)) {
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.sl-demo-canvas.is-pre-intro :global(:is(.dbs-card, .dbs-edge, .dbs-group-box)) {
			opacity: 1;
		}
	}

	/* 聚焦切換時讓「亮起／淡掉」用漸變，而不是一格一格跳——自動導覽時才看得出因果。
	   只在首頁的範例圖套用，工作區維持即時反應。 */
	.sl-demo-canvas :global(.dbs-card) {
		transition:
			opacity 0.45s ease,
			border-color 0.3s ease,
			box-shadow 0.3s ease;
	}
	.sl-demo-canvas :global(.dbs-edge) {
		transition: opacity 0.45s ease;
	}
	.sl-demo-canvas :global(.dbs-edge-path) {
		transition:
			stroke 0.3s ease,
			stroke-width 0.3s ease;
	}
	.sl-demo-canvas :global(.dbs-group-box) {
		transition: opacity 0.45s ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.sl-demo-chip {
			animation: none;
		}
	}
</style>
