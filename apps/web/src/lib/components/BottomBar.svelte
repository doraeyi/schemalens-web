<script lang="ts">
	import { tick } from 'svelte';
	import {
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
		signedIn = false
	}: Props = $props();

	/** disabled 的項目要說得出為什麼不能按，不然看起來像壞掉。 */
	const historyHint = $derived(
		!historyDisabled ? null : signedIn ? '先存成雲端分頁才會有' : '登入並存到雲端後才會有'
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
		{ label: '程式碼', icon: Code, run: onViewSourceClick, hint: '檢視、複製目前的 DSL' },
		{ label: '比較版本', icon: GitCompare, run: onCompare, disabled: compareDisabled, hint: compareDisabled ? '畫布上要先有資料表' : null },
		{ label: '版本歷史', icon: History, run: onHistory, disabled: historyDisabled, hint: historyHint },
		{ label: 'AI 助手', icon: Sparkles, run: onAiClick, accent: aiConfigured, hint: aiConfigured ? '已連接' : '連接 Claude／ChatGPT' },
		{ label: '語法文件與快捷鍵', icon: CircleHelp, run: () => window.open('/docs', '_blank', 'noopener') },
		{ label: theme === 'dark' ? '切換成淺色' : '切換成深色', icon: theme === 'dark' ? Sun : Moon, run: onToggleTheme }
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
	aria-label="畫布工具"
>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 px-1 py-0.5">
		<button class="sl-icon-btn" onclick={onZoomOut} title="縮小" aria-label="縮小"><Minus size={15} /></button>
		<button
			class="min-w-12 rounded-full px-1.5 py-1 text-center text-xs text-muted tabular-nums hover:text-cyan"
			onclick={onZoomReset}
			title="按一下縮放到全圖"
			aria-label="目前縮放 {scalePercent}%，按一下縮放到全圖"
		>
			{scalePercent}%
		</button>
		<button class="sl-icon-btn" onclick={onZoomIn} title="放大" aria-label="放大"><Plus size={15} /></button>
	</div>

	<!-- 手機上用手指拖就是平移，框選用不到，選取／移動切換只在桌面出現 -->
	<div class="mx-1 h-5 w-px bg-border max-md:hidden"></div>
	<div class="flex items-center gap-0.5 rounded-full bg-bg/60 p-0.5 max-md:hidden" role="group" aria-label="拖曳背景時">
		<button
			aria-pressed={mode === 'select'}
			class="sl-icon-btn {mode === 'select' ? 'sl-icon-btn-active' : ''}"
			onclick={() => onModeChange('select')}
			title="選取模式：拖曳背景會框選資料表"
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
		><Upload size={14} /> <span class="max-sm:sr-only">匯入</span></button
	>
	<button class="sl-pill-btn" onclick={onExportClick} title="匯出 Schema"
		><Download size={14} /> <span class="max-sm:sr-only">匯出</span></button
	>
	<button
		bind:this={moreButton}
		class="sl-icon-btn"
		class:sl-icon-btn-active={menuOpen}
		onclick={() => (menuOpen ? closeMenu() : void openMenu())}
		aria-haspopup="menu"
		aria-expanded={menuOpen}
		aria-label="更多：程式碼、比較、歷史、AI、說明、主題"
		title="更多"
	>
		<Ellipsis size={16} />
	</button>
</div>

{#if menuOpen}
	<div
		bind:this={menuEl}
		class="sl-more-menu"
		role="menu"
		aria-label="更多"
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
