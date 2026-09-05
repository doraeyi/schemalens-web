<script lang="ts">
	import type { SchemaDiagnostic } from '@schemalens/schema-core';
	import { AlertTriangle, X } from '@lucide/svelte';

	interface Props {
		diagnostics: SchemaDiagnostic[];
		onDismiss: () => void;
	}

	let { diagnostics, onDismiss }: Props = $props();
</script>

{#if diagnostics.length > 0}
	<div
		class="absolute bottom-3 left-3 right-3 z-10 max-h-40 overflow-auto rounded-lg border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] p-2.5 text-xs text-fg shadow-lg"
	>
		<div class="mb-1 flex items-center gap-1.5 font-semibold">
			<AlertTriangle size={13} />
			{diagnostics.length} 個 Schema 問題（畫面顯示的是可解析的部分）
			<button class="ml-auto text-muted hover:text-fg" onclick={onDismiss}><X size={13} /></button>
		</div>
		{#each diagnostics.slice(0, 20) as diagnostic, i (i)}
			<div class="py-0.5">
				{diagnostic.code}{diagnostic.location
					? `:${diagnostic.location.line}:${diagnostic.location.column}`
					: ''} — {diagnostic.message}
			</div>
		{/each}
	</div>
{/if}
