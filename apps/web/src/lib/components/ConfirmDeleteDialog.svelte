<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import type { Relation } from '@schemalens/schema-core';
	import { AlertTriangle, X } from '@lucide/svelte';
	import { pick } from '$lib/i18n/current';
	import { COMMON } from '$lib/i18n/common';

	const common = $derived(pick(COMMON));
	const m = $derived(
		pick({
			'zh-hant': {
				relations: (n: number) => `刪除後會一併移除 ${n} 條關聯：`,
				undoHint: '刪除後可以按 Ctrl+Z 復原。',
				confirm: '確定刪除'
			},
			en: {
				relations: (n: number) => `Deleting also removes ${n} relation${n === 1 ? '' : 's'}:`,
				undoHint: 'You can undo this with Ctrl+Z.',
				confirm: 'Delete'
			}
		})
	);

	interface Props {
		title: string;
		relations: Relation[];
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { title, relations, onConfirm, onCancel }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onCancel}>
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="flex items-center gap-1.5 text-sm font-semibold">
				<AlertTriangle size={15} class="text-yellow-400" />
				{title}
			</h2>
			<button class="sl-close-btn" onclick={onCancel} aria-label={common.close} title={common.closeEsc}><X size={16} /></button>
		</div>

		{#if relations.length > 0}
			<p class="mb-2 text-xs text-muted">{m.relations(relations.length)}</p>
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
			<p class="mb-4 text-xs text-muted">{m.undoHint}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<button class="sl-button sl-button-secondary" onclick={onCancel}>{common.cancel}</button>
			<button class="sl-button sl-button-danger" onclick={onConfirm}>{m.confirm}</button>
		</div>
	</div>
</div>

