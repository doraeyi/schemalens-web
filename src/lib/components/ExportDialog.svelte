<script lang="ts">
	import { Download, X } from '@lucide/svelte';
	import { SQL_DIALECTS, type SqlDialectId } from '$lib/export/sql/types';

	interface Props {
		onClose: () => void;
		onExportJson: () => void;
		onExportDsl: () => void;
		onExportSql: (dialect: SqlDialectId) => void;
	}

	let { onClose, onExportJson, onExportDsl, onExportSql }: Props = $props();

	let format = $state<'dsl' | 'json' | 'sql'>('dsl');
	let sqlDialect = $state<SqlDialectId>('mysql');

	function handleExport(): void {
		if (format === 'dsl') onExportDsl();
		else if (format === 'json') onExportJson();
		else onExportSql(sqlDialect);
		onClose();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">匯出 Schema</h2>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
		</div>

		<div class="mb-3 flex items-center gap-1 rounded-lg border border-border bg-bg/40 p-1 text-xs">
			<button class="flex-1 rounded-md py-1.5 {format === 'dsl' ? 'bg-cyan text-bg' : 'text-muted hover:text-fg'}" onclick={() => (format = 'dsl')}>
				DSL
			</button>
			<button class="flex-1 rounded-md py-1.5 {format === 'json' ? 'bg-cyan text-bg' : 'text-muted hover:text-fg'}" onclick={() => (format = 'json')}>
				JSON
			</button>
			<button class="flex-1 rounded-md py-1.5 {format === 'sql' ? 'bg-cyan text-bg' : 'text-muted hover:text-fg'}" onclick={() => (format = 'sql')}>
				SQL
			</button>
		</div>

		{#if format === 'dsl'}
			<p class="mb-3 text-xs text-muted">
				匯出成 <code class="font-mono text-cyan">.dbschema</code> DSL 純文字，跟畫面上編輯的內容一致，適合放進 git 版控。
			</p>
		{:else if format === 'json'}
			<p class="mb-3 text-xs text-muted">
				匯出成 <code class="font-mono text-cyan">.schema.json</code>，結構化資料，適合給程式直接讀取。
			</p>
		{:else}
			<p class="mb-2 text-xs text-muted">匯出成 SQL DDL，先選要用哪個資料庫方言：</p>
			<div class="mb-3 flex items-center gap-1">
				{#each SQL_DIALECTS as dialect (dialect.id)}
					<button
						class="rounded-full border px-2.5 py-1 text-xs {sqlDialect === dialect.id
							? 'border-cyan bg-cyan/15 text-cyan'
							: 'border-border text-muted hover:text-fg'}"
						onclick={() => (sqlDialect = dialect.id)}
					>
						{dialect.label}
					</button>
				{/each}
			</div>
		{/if}

		<div class="mt-3 flex justify-end gap-2">
			<button class="sl-btn" onclick={onClose}>取消</button>
			<button class="sl-btn sl-btn-active" onclick={handleExport}><Download size={13} /> 確定匯出</button>
		</div>
	</div>
</div>

<style>
	.sl-btn {
		padding: 4px 12px;
		border-radius: 6px;
		border: 1px solid var(--sl-border);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.sl-btn-active {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--sl-cyan);
		color: var(--sl-bg);
		border-color: transparent;
	}
</style>
