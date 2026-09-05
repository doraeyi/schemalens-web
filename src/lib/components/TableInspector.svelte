<script lang="ts">
	import type { Schema, TableId } from '@schemalens/schema-core';
	import { groupColor } from '@schemalens/schema-renderer';
	import { ArrowRight, X } from '@lucide/svelte';

	interface Props {
		schema: Schema;
		tableId: TableId;
		onClose: () => void;
		onFocusTable: (tableId: TableId) => void;
	}

	let { schema, tableId, onClose, onFocusTable }: Props = $props();

	const table = $derived(schema.tables.find((t) => t.id === tableId));
	const relations = $derived(
		schema.relations
			.filter((r) => r.sourceTable === tableId || r.targetTable === tableId)
			.map((r) => {
				const isSource = r.sourceTable === tableId;
				return {
					relation: r,
					otherTable: isSource ? r.targetTable : r.sourceTable,
					localColumns: isSource ? r.sourceColumns : r.targetColumns
				};
			})
	);
</script>

{#if table}
	<div class="flex h-full w-80 flex-none flex-col overflow-auto border-l border-border bg-surface/60 text-xs text-fg">
		<div class="flex items-start justify-between border-b border-border p-4">
			<div>
				{#if table.group}
					<div class="mb-1 flex items-center gap-1.5 text-muted">
						<span class="h-2 w-2 rounded-full" style:background={groupColor(table.group)}></span>
						{table.group}
					</div>
				{/if}
				<div class="text-sm font-bold">{table.name}</div>
				<div class="mt-1 text-muted">Schema: {table.schema}</div>
			</div>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={15} /></button>
		</div>

		{#if table.comment}
			<div class="border-b border-border p-4 text-muted">{table.comment}</div>
		{/if}

		<div class="p-4">
			<div class="mb-2 font-semibold">欄位</div>
			<div class="flex flex-col gap-2">
				{#each table.columns as column (column.name)}
					<div class="border-b border-border/60 pb-2 last:border-0">
						<div class="flex items-center gap-1.5">
							<span class="font-mono">{column.name}</span>
							{#if column.primaryKey}
								<span class="rounded border border-current px-1 text-[9px] font-bold text-[color:var(--vscode-charts-yellow)]"
									>PK</span
								>
							{/if}
						</div>
						{#if column.comment}
							<div class="mt-0.5 text-right text-muted">{column.comment}</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="border-t border-border p-4">
			<div class="mb-2 font-semibold">關聯 ({relations.length})</div>
			<div class="flex flex-col gap-1.5">
				{#each relations as item (item.relation.name)}
					<button
						class="w-full rounded-md border border-border px-2.5 py-2 text-left hover:border-cyan hover:text-cyan"
						onclick={() => onFocusTable(item.otherTable)}
					>
						<div class="flex items-center gap-1.5 font-mono">
							<ArrowRight size={12} class="flex-none" />
							{item.otherTable}
						</div>
						<div class="mt-0.5 pl-[18px] text-muted">{item.localColumns.join(', ')}</div>
					</button>
				{/each}
				{#if relations.length === 0}
					<div class="text-muted">沒有關聯</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
