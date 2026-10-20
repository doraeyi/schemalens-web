<script lang="ts">
	import { FileUp, Plus, Sparkles } from '@lucide/svelte';
	import { pick } from '$lib/i18n/current';

	const m = $derived(
		pick({
			'zh-hant': {
				title: '這個分頁還沒有任何資料表',
				lead: '先看範例感受一下，或把你自己的 schema 帶進來。資料只存在這個瀏覽器。',
				sample: '載入範例 schema',
				sampleHint: '部落格系統：5 張表、5 條關聯，點表名就能看 Focus 的效果',
				import: '匯入 SQL 或 DSL',
				importHint: '貼上 CREATE TABLE、上傳 .sql / .dbschema / .schema.json',
				blank: '從空白開始',
				blankHint: '先建一張表，在左側面板直接編欄位',
				docsBefore: '想自己寫？看',
				docs: 'DSL 語法文件'
			},
			en: {
				title: 'This page has no tables yet',
				lead: 'Try the sample first, or bring in your own schema. Everything stays in this browser.',
				sample: 'Load the sample schema',
				sampleHint: 'A blog: 5 tables, 5 relations. Click a table name to see focus in action',
				import: 'Import SQL or DSL',
				importHint: 'Paste CREATE TABLE, or upload .sql / .dbschema / .schema.json',
				blank: 'Start blank',
				blankHint: 'Create a table and edit its columns in the left panel',
				docsBefore: 'Writing it yourself? See the',
				docs: 'DSL syntax docs'
			}
		})
	);

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
		<h2 id="sl-empty-title" class="text-base font-semibold text-fg">{m.title}</h2>
		<p class="mt-1 text-sm text-muted">{m.lead}</p>

		<div class="mt-5 flex flex-col gap-2">
			<button class="sl-empty-option sl-empty-primary" onclick={onLoadSample}>
				<Sparkles size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">{m.sample}</span>
					<span class="sl-empty-hint">{m.sampleHint}</span>
				</span>
			</button>
			<button class="sl-empty-option" onclick={onImport}>
				<FileUp size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">{m.import}</span>
					<span class="sl-empty-hint">{m.importHint}</span>
				</span>
			</button>
			<button class="sl-empty-option" onclick={onStartBlank}>
				<Plus size={18} />
				<span class="flex flex-col items-start text-left">
					<span class="font-semibold">{m.blank}</span>
					<span class="sl-empty-hint">{m.blankHint}</span>
				</span>
			</button>
		</div>
		<p class="mt-4 text-center text-xs text-muted">
			{m.docsBefore} <a href="/docs" target="_blank" rel="noopener" class="text-cyan underline-offset-2 hover:underline">{m.docs}</a>
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
