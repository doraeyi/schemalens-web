<script lang="ts">
	import { CircleHelp, Code, Download, GitCompare, Hand, History, LayoutGrid, Minus, MousePointer2, Moon, Plus, Rows3, Sparkles, Sun, Upload } from '@lucide/svelte';
	import type { InteractionMode } from '@schemalens/schema-renderer';
	import type { Theme } from '$lib/stores/theme.svelte';
	import type { ViewMode } from '$lib/stores/viewMode';

	interface Props {
		scalePercent: number;
		mode: InteractionMode;
		theme: Theme;
		viewMode: ViewMode;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
		onModeChange: (mode: InteractionMode) => void;
		onViewModeChange: (mode: ViewMode) => void;
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
	}

	let {
		scalePercent,
		mode,
		theme,
		viewMode,
		onZoomIn,
		onZoomOut,
		onZoomReset,
		onModeChange,
		onViewModeChange,
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
		signedIn = false
	}: Props = $props();

	/** disabled 的按鈕要說得出為什麼不能按，不然看起來像壞掉。 */
	const historyTitle = $derived(
		!historyDisabled ? '版本歷史' : signedIn ? '版本歷史：先存成雲端分頁才會有' : '版本歷史：登入並存到雲端後才會有'
	);
</script>

<div
	class="sl-bottom-bar absolute bottom-4 left-1/2 z-40 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface/95 px-2 py-1.5 text-fg shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)]"
	role="toolbar"
	aria-label="畫布工具"
>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 px-1 py-0.5">
		<button class="sl-icon-btn" onclick={onZoomOut} title="縮小" aria-label="縮小"><Minus size={15} /></button>
		<button
			class="min-w-12 rounded-full px-1.5 py-1 text-center text-xs text-muted hover:text-cyan"
			onclick={onZoomReset}
			title="縮放至符合畫面"
			aria-label="目前縮放 {scalePercent}%，按一下縮放至符合畫面"
		>
			{scalePercent}%
		</button>
		<button class="sl-icon-btn" onclick={onZoomIn} title="放大" aria-label="放大"><Plus size={15} /></button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5">
		<button
			aria-pressed={mode === 'select'}
			class="sl-icon-btn {mode === 'select' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('select')}
			title="選取模式：拖曳背景不會平移畫布"
			aria-label="選取模式"
		>
			<MousePointer2 size={15} />
		</button>
		<button
			aria-pressed={mode === 'move'}
			class="sl-icon-btn {mode === 'move' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('move')}
			title="移動模式：拖曳背景可以平移畫布"
			aria-label="移動模式"
		>
			<Hand size={15} />
		</button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<button class="sl-pill-btn" onclick={onImportClick} title="匯入 Schema"
		><Upload size={13} /> <span class="max-sm:sr-only">匯入</span></button
	>
	<button class="sl-pill-btn" onclick={onExportClick} title="匯出 Schema"
		><Download size={13} /> <span class="max-sm:sr-only">匯出</span></button
	>
	<button class="sl-pill-btn" onclick={onViewSourceClick} title="檢視原始碼（不下載，直接複製）"
		><Code size={13} /> <span class="max-sm:sr-only">程式碼</span></button
	>
	<button
		class="sl-pill-btn"
		onclick={onCompare}
		disabled={compareDisabled}
		title="版本比較"
		aria-label="版本比較"
		style:opacity={compareDisabled ? 0.4 : 1}
	>
		<GitCompare size={13} /> <span class="max-sm:sr-only">比較</span>
	</button>
	<button
		class="sl-pill-btn"
		onclick={onHistory}
		disabled={historyDisabled}
		title={historyTitle}
		aria-label={historyTitle}
		style:opacity={historyDisabled ? 0.4 : 1}
	>
		<History size={13} /> <span class="max-sm:sr-only">歷史</span>
	</button>
	<button
		class="sl-pill-btn {aiConfigured ? 'text-cyan' : ''}"
		onclick={onAiClick}
		title="AI 助手：連接 Claude／ChatGPT，或填入 API key"
	>
		<Sparkles size={13} /> <span class="max-sm:sr-only">AI</span>
	</button>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5">
		<button
			aria-pressed={viewMode === 'full'}
			class="sl-icon-btn {viewMode === 'full' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onViewModeChange('full')}
			title="完整模式：卡片顯示完整欄位"
			aria-label="完整模式"
		>
			<Rows3 size={15} />
		</button>
		<button
			aria-pressed={viewMode === 'compact'}
			class="sl-icon-btn {viewMode === 'compact' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onViewModeChange('compact')}
			title="精簡模式：分區總覽 + 詳情面板"
			aria-label="精簡模式"
		>
			<LayoutGrid size={15} />
		</button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<a class="sl-icon-btn" href="/docs" target="_blank" rel="noopener" title="語法文件與快捷鍵" aria-label="語法文件與快捷鍵">
		<CircleHelp size={15} />
	</a>
	<button class="sl-icon-btn" onclick={onToggleTheme} title="切換深色／淺色" aria-label="切換深色／淺色">
		{#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
	</button>
</div>

<style>
	.sl-bottom-bar {
		scrollbar-width: none;
	}
	/* 手機寬度放不下整排：可以左右滑，右緣淡出提示後面還有按鈕。 */
	@media (max-width: 639px) {
		.sl-bottom-bar {
			mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
			padding-right: 24px;
		}
	}
	:global(.sl-pill-btn) {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
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
</style>
