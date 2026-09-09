<script lang="ts">
	import { Check, Copy, X } from '@lucide/svelte';

	interface Props {
		source: string;
		onClose: () => void;
	}

	let { source, onClose }: Props = $props();

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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
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
				<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
			</div>
		</div>
		<p class="mb-2 text-xs text-muted">不用下載檔案——直接複製這段文字貼給 AI 或貼到別的地方。</p>
		<pre class="flex-1 overflow-auto rounded-lg border border-border bg-bg/60 p-3 font-mono text-xs whitespace-pre-wrap select-text">{source}</pre>
	</div>
</div>
