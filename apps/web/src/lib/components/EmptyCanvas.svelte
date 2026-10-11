<script lang="ts">
	import { FileUp, Plus, Sparkles } from '@lucide/svelte';

	interface Props {
		onLoadSample: () => void;
		onImport: () => void;
		onStartBlank: () => void;
	}

	let { onLoadSample, onImport, onStartBlank }: Props = $props();
</script>

<!-- 空白分頁的起點：之前這裡只有一片灰畫布，第一次用的人不知道下一步是什麼。 -->
<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4 pb-24">
	<section class="sl-empty pointer-events-auto" aria-labelledby="sl-empty-title">
		<h2 id="sl-empty-title" class="text-base font-semibold text-fg">這個分頁還沒有任何資料表</h2>
		<p class="mt-1 text-sm text-muted">先看範例感受一下，或把你自己的 schema 帶進來。資料只存在這個瀏覽器。</p>

		<div class="mt-5 flex flex-col gap-2">
			<button class="sl-empty-option sl-empty-primary" onclick={onLoadSample}>
				<Sparkles size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">載入範例 schema</span>
					<span class="sl-empty-hint">部落格系統：5 張表、5 條關聯，點表名就能看 Focus 的效果</span>
				</span>
			</button>
			<button class="sl-empty-option" onclick={onImport}>
				<FileUp size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">匯入 SQL 或 DSL</span>
					<span class="sl-empty-hint">貼上 CREATE TABLE、上傳 .sql / .dbschema / .schema.json</span>
				</span>
			</button>
			<button class="sl-empty-option" onclick={onStartBlank}>
				<Plus size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">從空白開始</span>
					<span class="sl-empty-hint">先建一張表，在左側面板直接編欄位</span>
				</span>
			</button>
		</div>
		<p class="mt-4 text-center text-xs text-muted">
			想自己寫？看 <a href="/docs" target="_blank" rel="noopener" class="text-cyan underline-offset-2 hover:underline">DSL 語法文件</a>
		</p>
	</section>
</div>

<style>
	.sl-empty {
		width: min(420px, 100%);
		border: 1px solid var(--sl-border);
		border-radius: 14px;
		background: var(--sl-surface);
		padding: 22px;
		box-shadow: 0 18px 40px -24px rgb(0 0 0 / 0.45);
	}
	.sl-empty-option {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		border: 1px solid var(--sl-border);
		border-radius: 10px;
		padding: 10px 14px;
		color: var(--sl-fg);
		font-size: 13px;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}
	.sl-empty-option:hover {
		border-color: var(--sl-cyan);
		background: color-mix(in oklab, var(--sl-cyan) 6%, transparent);
	}
	.sl-empty-option :global(svg) {
		flex: none;
		color: var(--sl-cyan);
	}
	.sl-empty-primary {
		border-color: color-mix(in oklab, var(--sl-cyan) 55%, var(--sl-border));
		background: color-mix(in oklab, var(--sl-cyan) 8%, var(--sl-surface));
	}
	.sl-empty-hint {
		margin-top: 2px;
		font-size: 12px;
		color: var(--sl-muted);
	}
</style>
