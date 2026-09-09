<script lang="ts">
	import { FileUp, X } from '@lucide/svelte';
	import { SQL_DIALECTS, type SqlDialectId } from '$lib/export/sql/types';

	interface Props {
		mode?: 'import' | 'compare';
		onClose: () => void;
		onImport: (source: string, fileName: string, sqlDialect?: SqlDialectId) => void;
	}

	let { mode = 'import', onClose, onImport }: Props = $props();

	let text = $state('');
	let fileInput: HTMLInputElement | undefined = $state();
	let format = $state<'schema' | 'sql'>('schema');
	let sqlDialect = $state<SqlDialectId>('mysql');

	/**
	 * 很陽春的猜測，只在「上傳檔案」時用來預選方言按鈕——上傳是一次性的明確動作，猜一次
	 * 當起始值合理。貼上/打字文字框**不會**觸發這個：猜測邏輯只看引號風格/幾個關鍵字，
	 * 不夠準，先前每次打字都重新猜會一直蓋掉目前選的方言（不管是預設的 MySQL 還是使用者
	 * 自己點的），使用者完全沒感覺自己做了什麼卻方言就跳掉了。
	 */
	function guessDialect(source: string): SqlDialectId {
		if (/`[^`]+`/.test(source)) return 'mysql';
		if (/\[[^\]]+\]/.test(source)) return 'mssql';
		// 沒有引號風格可以判斷時（例如識別字都沒加引號），退而求其次找方言專屬關鍵字——
		// MySQL 常見的 AUTO_INCREMENT / ENGINE=，比預設猜 sqlite 準得多。
		if (/\bauto_increment\b|\bengine\s*=/i.test(source)) return 'mysql';
		if (/\bidentity\s*\(/i.test(source)) return 'mssql';
		// 雙引號包識別字的話 PostgreSQL 跟 SQLite 長得很像，PostgreSQL 專屬的關鍵字
		// （SERIAL、其他工具匯出時常見的說明註解）比較能區分；分不出來就維持猜 sqlite。
		if (/\b(?:big|small)?serial\b|\bpostgres/i.test(source)) return 'postgresql';
		return 'sqlite';
	}

	async function handleFile(event: Event): Promise<void> {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const source = await file.text();
		if (format === 'sql' || /\.sql$/i.test(file.name)) {
			format = 'sql';
			sqlDialect = guessDialect(source);
			text = source;
			return;
		}
		onImport(source, file.name);
	}

	function handlePasteSubmit(): void {
		if (!text.trim()) return;
		if (format === 'sql') {
			onImport(text, `pasted.${sqlDialect}.sql`, sqlDialect);
			return;
		}
		// Pasted text has no filename to sniff a format from — treat it as DSL,
		// the same default the VS Code extension uses for `.dbschema` files.
		onImport(text, 'pasted.dbschema');
	}

</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">{mode === 'compare' ? '選擇要比較的版本' : '匯入 Schema'}</h2>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
		</div>

		<div class="mb-3 flex items-center gap-1 rounded-lg border border-border bg-bg/40 p-1 text-xs">
			<button
				class="flex-1 rounded-md py-1.5 {format === 'schema' ? 'bg-cyan text-bg' : 'text-muted hover:text-fg'}"
				onclick={() => (format = 'schema')}
			>
				DSL / JSON / MD
			</button>
			<button
				class="flex-1 rounded-md py-1.5 {format === 'sql' ? 'bg-cyan text-bg' : 'text-muted hover:text-fg'}"
				onclick={() => (format = 'sql')}
			>
				SQL
			</button>
		</div>

		{#if format === 'schema'}
			<p class="mb-3 text-xs text-muted">
				支援 <code class="font-mono text-cyan">.dbschema</code> DSL、
				<code class="font-mono text-cyan">.schema.json</code>，以及
				<code class="font-mono text-cyan">.schema.md</code>（內嵌 ```dbschema 區塊的 Markdown）。
			</p>
		{:else}
			<p class="mb-2 text-xs text-muted">
				貼上或上傳任意 <code class="font-mono text-cyan">CREATE TABLE</code> 為主的 SQL DDL，先確認一下方言：
			</p>
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

		<button
			class="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted hover:border-cyan hover:text-cyan"
			onclick={() => fileInput?.click()}
		>
			<FileUp size={16} />
			點擊上傳檔案
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept={format === 'sql' ? '.sql' : '.dbschema,.schema.json,.schema.md,.md,.txt'}
			class="hidden"
			onchange={handleFile}
		/>

		<div class="mb-2 text-xs text-muted">…或直接貼上{format === 'sql' ? ' SQL' : ' DSL'}文字</div>
		<textarea
			bind:value={text}
			rows="6"
			placeholder={format === 'sql' ? 'CREATE TABLE Users (...);' : 'table Users ... PK Id bigint not null ...'}
			class="w-full resize-none rounded-lg border border-border bg-bg/60 p-2 font-mono text-xs text-fg placeholder:text-muted focus:border-cyan focus:outline-none"
		></textarea>

		<div class="mt-3 flex justify-end gap-2">
			<button class="sl-btn" onclick={onClose}>取消</button>
			<button class="sl-btn sl-btn-active" onclick={handlePasteSubmit}>
				{mode === 'compare' ? '開始比較' : '匯入貼上的文字'}
			</button>
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
		background: var(--sl-cyan);
		color: var(--sl-bg);
		border-color: transparent;
	}
</style>
