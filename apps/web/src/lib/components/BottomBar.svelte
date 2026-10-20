<script lang="ts">
	import { tick } from 'svelte';
	import { currentLocale, pick } from '$lib/i18n/current';
	import type { Locale } from '$lib/i18n/locale';
	import {
		Languages,
		CircleHelp,
		Code,
		Download,
		Ellipsis,
		GitCompare,
		Hand,
		History,
		Minus,
		MousePointer2,
		Moon,
		Plus,
		Sparkles,
		Sun,
		Upload
	} from '@lucide/svelte';
	import type { InteractionMode } from '@schemalens/schema-renderer';
	import type { Theme } from '$lib/stores/theme.svelte';

	interface Props {
		scalePercent: number;
		mode: InteractionMode;
		theme: Theme;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
		onModeChange: (mode: InteractionMode) => void;
		onImportClick: () => void;
		onExportClick: () => void;
		onViewSourceClick: () => void;
		onToggleTheme: () => void;
		onCompare: () => void;
		compareDisabled?: boolean;
		onHistory: () => void;
		historyDisabled?: boolean;
		onAiClick: () => void;
		aiConfigured?: boolean;
		signedIn?: boolean;
		/** 切換介面語言。交給頁面處理，換頁前要先把還沒存的草稿寫出去。 */
		onToggleLanguage: (target: Locale) => void;
	}

	let {
		scalePercent,
		mode,
		theme,
		onZoomIn,
		onZoomOut,
		onZoomReset,
		onModeChange,
		onImportClick,
		onExportClick,
		onViewSourceClick,
		onToggleTheme,
		onCompare,
		compareDisabled = false,
		onHistory,
		historyDisabled = false,
		onAiClick,
		aiConfigured = false,
		signedIn = false,
		onToggleLanguage
	}: Props = $props();

	const m = $derived(
		pick({
			'zh-hant': {
				historyNeedsCloud: '先存成雲端分頁才會有',
				historyNeedsSignIn: '登入並存到雲端後才會有',
				source: '程式碼',
				sourceHint: '檢視、複製目前的 DSL',
				compare: '比較版本',
				compareNeedsTables: '畫布上要先有資料表',
				history: '版本歷史',
				ai: 'AI 助手',
				aiConnected: '已連接',
				aiConnect: '連接 Claude／ChatGPT',
				docs: '語法文件與快捷鍵',
				light: '切換成淺色',
				dark: '切換成深色',
				language: 'English',
				languageHint: 'Switch to English',
				toolbar: '畫布工具',
				zoomOut: '縮小',
				zoomIn: '放大',
				fit: '按一下縮放到全圖',
				zoomLabel: (n: number) => `目前縮放 ${n}%，按一下縮放到全圖`,
				dragGroup: '拖曳背景時',
				selectTitle: '選取模式：拖曳背景會框選資料表',
				select: '選取模式',
				moveTitle: '移動模式：拖曳背景可以平移畫布',
				move: '移動模式',
				importTitle: '匯入 Schema',
				import: '匯入',
				exportTitle: '匯出 Schema',
				export: '匯出',
				moreLabel: '更多：程式碼、比較、歷史、AI、說明、主題、語言',
				more: '更多'
			},
			en: {
				historyNeedsCloud: 'Save this as a cloud page first',
				historyNeedsSignIn: 'Sign in and save to the cloud first',
				source: 'Source',
				sourceHint: 'View and copy the current DSL',
				compare: 'Compare versions',
				compareNeedsTables: 'Add some tables to the canvas first',
				history: 'Version history',
				ai: 'AI assistant',
				aiConnected: 'Connected',
				aiConnect: 'Connect Claude / ChatGPT',
				docs: 'Syntax docs and shortcuts',
				light: 'Switch to light',
				dark: 'Switch to dark',
				language: '中文',
				languageHint: '切換成中文',
				toolbar: 'Canvas tools',
				zoomOut: 'Zoom out',
				zoomIn: 'Zoom in',
				fit: 'Click to zoom to fit',
				zoomLabel: (n: number) => `Zoom ${n}%, click to zoom to fit`,
				dragGroup: 'When dragging the background',
				selectTitle: 'Select mode: drag the background to box-select tables',
				select: 'Select mode',
				moveTitle: 'Move mode: drag the background to pan',
				move: 'Move mode',
				importTitle: 'Import schema',
				import: 'Import',
				exportTitle: 'Export schema',
				export: 'Export',
				moreLabel: 'More: source, compare, history, AI, help, theme, language',
				more: 'More'
			}
		})
	);

	/** disabled 的項目要說得出為什麼不能按，不然看起來像壞掉。 */
	const historyHint = $derived(
		!historyDisabled ? null : signedIn ? m.historyNeedsCloud : m.historyNeedsSignIn
	);

	/**
	 * 底部列只留每次都會用到的：縮放、選取／移動、匯入、匯出。
	 * 程式碼、比較、歷史、AI、說明、主題收進「⋯」——之前 14 顆一字排開，手機上還被切掉。
	 */
	let menuOpen = $state(false);
	let moreButton: HTMLButtonElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();
	let menuPos = $state({ bottom: 0, right: 0 });

	interface MoreItem {
		label: string;
		icon: typeof Code;
		run: () => void;
		disabled?: boolean;
		hint?: string | null;
		accent?: boolean;
	}

	const items = $derived<MoreItem[]>([
		{ label: m.source, icon: Code, run: onViewSourceClick, hint: m.sourceHint },
		{ label: m.compare, icon: GitCompare, run: onCompare, disabled: compareDisabled, hint: compareDisabled ? m.compareNeedsTables : null },
		{ label: m.history, icon: History, run: onHistory, disabled: historyDisabled, hint: historyHint },
		{ label: m.ai, icon: Sparkles, run: onAiClick, accent: aiConfigured, hint: aiConfigured ? m.aiConnected : m.aiConnect },
		{ label: m.docs, icon: CircleHelp, run: () => window.open('/docs', '_blank', 'noopener') },
		{ label: theme === 'dark' ? m.light : m.dark, icon: theme === 'dark' ? Sun : Moon, run: onToggleTheme },
		{ label: m.language, icon: Languages, run: () => onToggleLanguage(currentLocale() === 'en' ? 'zh-hant' : 'en'), hint: m.languageHint }
	]);

	async function openMenu(): Promise<void> {
		if (!moreButton) return;
		const rect = moreButton.getBoundingClientRect();
		menuPos = { bottom: window.innerHeight - rect.top + 8, right: Math.max(8, window.innerWidth - rect.right) };
		menuOpen = true;
		await tick();
		menuEl?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}

	function closeMenu(returnFocus = true): void {
		menuOpen = false;
		if (returnFocus) moreButton?.focus();
	}

	function handleMenuKeydown(event: KeyboardEvent): void {
		const buttons = [...(menuEl?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMenu();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
			buttons[next]?.focus();
		} else if (event.key === 'Tab') {
			closeMenu(false);
		}
	}

	function handleWindowPointerDown(event: PointerEvent): void {
		if (!menuOpen) return;
		const target = event.target as Node;
		if (menuEl?.contains(target) || moreButton?.contains(target)) return;
		closeMenu(false);
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div
	class="sl-bottom-bar absolute bottom-4 left-1/2 z-40 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface/95 px-2 py-1.5 text-fg shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)]"
	role="toolbar"
	aria-label={m.toolbar}
>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 px-1 py-0.5">
		<button class="sl-icon-btn" onclick={onZoomOut} title={m.zoomOut} aria-label={m.zoomOut}><Minus size={15} /></button>
		<button
			class="min-w-12 rounded-full px-1.5 py-1 text-center text-xs text-muted tabular-nums hover:text-cyan"
			onclick={onZoomReset}
			title={m.fit}
			aria-label={m.zoomLabel(scalePercent)}
		>
			{scalePercent}%
		</button>
		<button class="sl-icon-btn" onclick={onZoomIn} title={m.zoomIn} aria-label={m.zoomIn}><Plus size={15} /></button>
	</div>

	<!-- 手機上用手指拖就是平移，框選用不到，選取／移動切換只在桌面出現 -->
	<div class="mx-1 h-5 w-px bg-border max-md:hidden"></div>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5 max-md:hidden" role="group" aria-label={m.dragGroup}>
		<button
			aria-pressed={mode === 'select'}
			class="sl-icon-btn {mode === 'select' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('select')}
			title={m.selectTitle}
			aria-label={m.select}
		>
			<MousePointer2 size={15} />
		</button>
		<button
			aria-pressed={mode === 'move'}
			class="sl-icon-btn {mode === 'move' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('move')}
			title={m.moveTitle}
			aria-label={m.move}
		>
			<Hand size={15} />
		</button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<button class="sl-pill-btn" onclick={onImportClick} title={m.importTitle}
		><Upload size={14} /> <span class="max-sm:sr-only">{m.import}</span></button
	>
	<button class="sl-pill-btn" onclick={onExportClick} title={m.exportTitle}
		><Download size={14} /> <span class="max-sm:sr-only">{m.export}</span></button
	>
	<button
		bind:this={moreButton}
		class="sl-icon-btn"
		class:sl-icon-btn-active={menuOpen}
		onclick={() => (menuOpen ? closeMenu() : void openMenu())}
		aria-haspopup="menu"
		aria-expanded={menuOpen}
		aria-label={m.moreLabel}
		title={m.more}
	>
		<Ellipsis size={16} />
	</button>
</div>

{#if menuOpen}
	<div
		bind:this={menuEl}
		class="sl-more-menu"
		role="menu"
		aria-label={m.more}
		tabindex="-1"
		style:bottom="{menuPos.bottom}px"
		style:right="{menuPos.right}px"
		onkeydown={handleMenuKeydown}
	>
		{#each items as item (item.label)}
			<button
				role="menuitem"
				disabled={item.disabled}
				class:text-cyan={item.accent}
				onclick={() => {
					closeMenu(false);
					item.run();
				}}
			>
				<item.icon size={15} />
				<span class="flex min-w-0 flex-col items-start">
					<span>{item.label}</span>
					{#if item.hint}<span class="sl-more-hint">{item.hint}</span>{/if}
				</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.sl-bottom-bar {
		scrollbar-width: none;
	}
	:global(.sl-pill-btn) {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 11px;
		border-radius: 9999px;
		border: none;
		background: transparent;
		color: inherit;
		font-size: 12px;
		min-height: 28px;
		cursor: pointer;
		white-space: nowrap;
	}
	:global(.sl-pill-btn:disabled) {
		cursor: not-allowed;
	}
	:global(.sl-pill-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
		color: var(--sl-cyan);
	}
	.sl-more-menu {
		position: fixed;
		z-index: 60;
		min-width: 236px;
		border: 1px solid var(--sl-border);
		border-radius: 14px;
		background: var(--sl-surface);
		padding: 6px;
		box-shadow: 0 18px 40px -20px rgb(0 0 0 / 0.55);
		animation: sl-menu-in 0.16s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes sl-menu-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	.sl-more-menu button {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		min-height: 40px;
		border-radius: 9px;
		padding: 6px 10px;
		text-align: left;
		font-size: 13px;
		color: var(--sl-fg);
	}
	.sl-more-menu button:hover:not(:disabled),
	.sl-more-menu button:focus-visible {
		background: color-mix(in oklab, var(--sl-fg) 7%, transparent);
		outline: none;
	}
	.sl-more-menu button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.sl-more-hint {
		font-size: 11.5px;
		color: var(--sl-muted);
	}
</style>
