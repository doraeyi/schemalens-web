<script lang="ts">
	import { Download, Hand, LayoutGrid, Minus, MousePointer2, Moon, Plus, Rows3, Sun, Upload } from '@lucide/svelte';
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
		onExportJson: () => void;
		onExportDsl: () => void;
		onToggleTheme: () => void;
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
		onExportJson,
		onExportDsl,
		onToggleTheme
	}: Props = $props();
</script>

<div
	class="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface/90 px-2 py-1.5 text-fg shadow-2xl shadow-black/40 backdrop-blur-md"
>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 px-1 py-0.5">
		<button class="sl-icon-btn" onclick={onZoomOut} title="縮小" aria-label="縮小"><Minus size={15} /></button>
		<button
			class="min-w-12 rounded-full px-1.5 py-1 text-center text-xs text-muted hover:text-cyan"
			onclick={onZoomReset}
			title="縮放至符合畫面"
		>
			{scalePercent}%
		</button>
		<button class="sl-icon-btn" onclick={onZoomIn} title="放大" aria-label="放大"><Plus size={15} /></button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5">
		<button
			class="sl-icon-btn {mode === 'select' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('select')}
			title="選取模式：拖曳背景不會平移畫布"
			aria-label="選取模式"
		>
			<MousePointer2 size={15} />
		</button>
		<button
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
		><Upload size={13} /> 匯入</button
	>
	<button class="sl-pill-btn" onclick={onExportJson} title="匯出成 .schema.json"
		><Download size={13} /> JSON</button
	>
	<button class="sl-pill-btn" onclick={onExportDsl} title="匯出成 .dbschema"
		><Download size={13} /> DSL</button
	>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5">
		<button
			class="sl-icon-btn {viewMode === 'full' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onViewModeChange('full')}
			title="完整模式：卡片顯示完整欄位"
			aria-label="完整模式"
		>
			<Rows3 size={15} />
		</button>
		<button
			class="sl-icon-btn {viewMode === 'compact' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onViewModeChange('compact')}
			title="精簡模式：分區總覽 + 詳情面板"
			aria-label="精簡模式"
		>
			<LayoutGrid size={15} />
		</button>
	</div>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<button class="sl-icon-btn" onclick={onToggleTheme} title="切換深色／淺色" aria-label="切換深色／淺色">
		{#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
	</button>
</div>

<style>
	:global(.sl-icon-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 9999px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	:global(.sl-icon-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
		color: var(--sl-cyan);
	}
	:global(.sl-icon-btn-active) {
		background: var(--sl-cyan);
		color: var(--sl-bg);
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
		font-size: 11px;
		cursor: pointer;
		white-space: nowrap;
	}
	:global(.sl-pill-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
		color: var(--sl-cyan);
	}
</style>
