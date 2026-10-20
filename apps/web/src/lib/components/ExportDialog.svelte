<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { Download, X } from '@lucide/svelte';
	import { SQL_DIALECTS, type SqlDialectId } from '@schemalens/schema-sql';
	import { pick } from '$lib/i18n/current';
	import { COMMON } from '$lib/i18n/common';

	const common = $derived(pick(COMMON));
	const m = $derived(
		pick({
			'zh-hant': {
				title: '匯出 Schema',
				dslBefore: '匯出成',
				dslAfter: 'DSL 純文字，跟畫面上編輯的內容一致，適合放進 git 版控。',
				jsonBefore: '匯出成',
				jsonAfter: '，結構化資料，適合給程式直接讀取。',
				sql: '匯出成 SQL DDL，先選要用哪個資料庫方言：',
				confirm: '確定匯出'
			},
			en: {
				title: 'Export schema',
				dslBefore: 'Export as',
				dslAfter: 'DSL plain text, identical to what you edit on screen; good for git.',
				jsonBefore: 'Export as',
				jsonAfter: ', structured data that programs can read directly.',
				sql: 'Export as SQL DDL. Pick the database dialect first:',
				confirm: 'Export'
			}
		})
	);

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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onClose}>
	<div class="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">{m.title}</h2>
			<button class="sl-close-btn" onclick={onClose} aria-label={common.close} title={common.closeEsc}><X size={16} /></button>
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
				{m.dslBefore} <code class="font-mono text-cyan">.dbschema</code> {m.dslAfter}
			</p>
		{:else if format === 'json'}
			<p class="mb-3 text-xs text-muted">
				{m.jsonBefore} <code class="font-mono text-cyan">.schema.json</code>{m.jsonAfter}
			</p>
		{:else}
			<p class="mb-2 text-xs text-muted">{m.sql}</p>
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
			<button class="sl-button sl-button-secondary" onclick={onClose}>{common.cancel}</button>
			<button class="sl-button sl-button-primary" onclick={handleExport}><Download size={13} /> {m.confirm}</button>
		</div>
	</div>
</div>

