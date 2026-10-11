<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { Check, Copy, X } from '@lucide/svelte';

	interface Props {
		source: string;
		onClose: () => void;
		/** 從畫布 Shift+Enter／雙擊進來時：捲到這張表的定義並標出來。 */
		focusTable?: string | null;
	}

	let { source, onClose, focusTable = null }: Props = $props();

	const lines = $derived(source.split('\n'));
	/** 這張表的定義在哪幾行：從 `table 名稱` 那行到它的 `}`。 */
	const highlight = $derived.by(() => {
		if (!focusTable) return null;
		const name = focusTable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const start = lines.findIndex((line) => new RegExp(`^table\\s+(?:\\w+\\.)?${name}\\b`).test(line));
		if (start < 0) return null;
		const end = lines.findIndex((line, i) => i > start && line.trim() === '}');
		return { start, end: end < 0 ? start : end };
	});

	let preEl: HTMLPreElement | undefined = $state();
	$effect(() => {
		if (!highlight || !preEl) return;
		preEl.querySelector<HTMLElement>(`[data-line="${highlight.start}"]`)?.scrollIntoView({ block: 'center' });
	});

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function handleCopy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(source);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			// 剪貼簿被瀏覽器擋下——文字本來就整段選取得到，使用者可以自己手動複製。
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onClose}>
	<div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">目前的 DSL 原始碼</h2>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-cyan hover:text-cyan"
					onclick={handleCopy}
				>
					{#if copied}
						<Check size={12} class="text-cyan" /> 已複製
					{:else}
						<Copy size={12} /> 複製到剪貼簿
					{/if}
				</button>
				<button class="sl-close-btn" onclick={onClose} aria-label="關閉" title="關閉（Esc）"><X size={16} /></button>
			</div>
		</div>
		<p class="mb-2 text-xs text-muted">不用下載檔案——直接複製這段文字貼給 AI 或貼到別的地方。</p>
		<pre
			bind:this={preEl}
			class="flex-1 overflow-auto rounded-lg border border-border bg-bg/60 p-3 font-mono text-xs whitespace-pre-wrap select-text">{#each lines as line, i (i)}<span
					data-line={i}
					class={highlight && i >= highlight.start && i <= highlight.end ? 'sl-src-hit' : ''}>{line}{'\n'}</span
				>{/each}</pre>
	</div>
</div>

<style>
	.sl-src-hit {
		display: block;
		margin: 0 -12px;
		padding: 0 12px;
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
		box-shadow: inset 2px 0 0 var(--sl-cyan);
	}
</style>
