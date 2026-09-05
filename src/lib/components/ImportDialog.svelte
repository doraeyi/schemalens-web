<script lang="ts">
	import { FileUp, X } from '@lucide/svelte';

	interface Props {
		onClose: () => void;
		onImport: (source: string, fileName: string) => void;
	}

	let { onClose, onImport }: Props = $props();

	let text = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	async function handleFile(event: Event): Promise<void> {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const source = await file.text();
		onImport(source, file.name);
	}

	function handlePasteSubmit(): void {
		if (!text.trim()) return;
		// Pasted text has no filename to sniff a format from — treat it as DSL,
		// the same default the VS Code extension uses for `.dbschema` files.
		onImport(text, 'pasted.dbschema');
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-xl rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">匯入 Schema</h2>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
		</div>

		<p class="mb-3 text-xs text-muted">
			支援 <code class="font-mono text-cyan">.dbschema</code> DSL、
			<code class="font-mono text-cyan">.schema.json</code>，以及
			<code class="font-mono text-cyan">.schema.md</code>（內嵌 ```dbschema 區塊的 Markdown）。
		</p>

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
			accept=".dbschema,.schema.json,.schema.md,.md,.txt"
			class="hidden"
			onchange={handleFile}
		/>

		<div class="mb-2 text-xs text-muted">…或直接貼上 DSL 文字</div>
		<textarea
			bind:value={text}
			rows="6"
			placeholder="table Users ... PK Id bigint not null ..."
			class="w-full resize-none rounded-lg border border-border bg-bg/60 p-2 font-mono text-xs text-fg placeholder:text-muted focus:border-cyan focus:outline-none"
		></textarea>

		<div class="mt-3 flex justify-end gap-2">
			<button class="sl-btn" onclick={onClose}>取消</button>
			<button class="sl-btn sl-btn-active" onclick={handlePasteSubmit}>匯入貼上的文字</button>
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
