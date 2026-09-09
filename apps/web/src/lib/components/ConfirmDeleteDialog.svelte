<script lang="ts">
	import type { Relation } from '@schemalens/schema-core';
	import { AlertTriangle, X } from '@lucide/svelte';

	interface Props {
		title: string;
		relations: Relation[];
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { title, relations, onConfirm, onCancel }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="flex items-center gap-1.5 text-sm font-semibold">
				<AlertTriangle size={15} class="text-yellow-400" />
				{title}
			</h2>
			<button class="text-muted hover:text-fg" onclick={onCancel}><X size={16} /></button>
		</div>

		{#if relations.length > 0}
			<p class="mb-2 text-xs text-muted">刪除後會一併移除 {relations.length} 條關聯：</p>
			<div class="mb-4 max-h-48 overflow-auto rounded-lg border border-border">
				{#each relations as relation (relation.name)}
					<div class="border-b border-border px-3 py-2 text-xs last:border-0">
						<div class="font-mono">{relation.name}</div>
						<div class="mt-0.5 text-muted">
							{relation.sourceTable}.{relation.sourceColumns.join(',')} → {relation.targetTable}.{relation.targetColumns.join(',')}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="mb-4 text-xs text-muted">這個動作無法復原。</p>
		{/if}

		<div class="flex justify-end gap-2">
			<button class="sl-btn" onclick={onCancel}>取消</button>
			<button class="sl-btn sl-btn-danger" onclick={onConfirm}>確定刪除</button>
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
	.sl-btn-danger {
		background: color-mix(in oklab, red 55%, transparent);
		border-color: transparent;
		color: white;
	}
</style>
