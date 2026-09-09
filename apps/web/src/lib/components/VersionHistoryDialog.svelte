<script lang="ts">
	import { GitCompare, History, Trash2, X } from '@lucide/svelte';

	export interface VersionSummary {
		id: string;
		label: string;
		createdAt: string;
	}

	interface Props {
		versions: VersionSummary[];
		onSaveVersion: (label: string) => void;
		onDiffVersion: (versionId: string) => void;
		onDeleteVersion: (versionId: string) => void;
		onClose: () => void;
	}

	let { versions, onSaveVersion, onDiffVersion, onDeleteVersion, onClose }: Props = $props();

	let label = $state('');

	function handleSave(): void {
		onSaveVersion(label.trim());
		label = '';
	}

	function handleDelete(version: VersionSummary): void {
		if (!confirm(`確定要刪除版本「${version.label}」嗎？這個動作無法復原。`)) return;
		onDeleteVersion(version.id);
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="flex items-center gap-1.5 text-sm font-semibold">
				<History size={15} class="text-cyan" />
				版本歷史
			</h2>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
		</div>

		<div class="mb-3 flex items-center gap-2">
			<input
				bind:value={label}
				type="text"
				placeholder="這個版本的說明（可留空）"
				onkeydown={(e) => e.key === 'Enter' && handleSave()}
				class="w-full rounded-md border border-border bg-bg/60 px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:border-cyan focus:outline-none"
			/>
			<button
				class="flex-none rounded-md border border-cyan bg-cyan/15 px-3 py-1.5 text-xs text-cyan hover:bg-cyan/25"
				onclick={handleSave}
			>
				儲存目前版本
			</button>
		</div>

		<div class="flex-1 overflow-auto rounded-lg border border-border">
			{#each versions as version (version.id)}
				<div class="group flex items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-0">
					<div class="min-w-0 flex-1">
						<div class="truncate font-semibold">{version.label}</div>
						<div class="text-muted">{formatTime(version.createdAt)}</div>
					</div>
					<button
						class="sl-icon-btn flex-none opacity-0 group-hover:opacity-100"
						onclick={() => onDiffVersion(version.id)}
						title="跟目前版本比較"
						aria-label="跟目前版本比較"
					>
						<GitCompare size={13} />
					</button>
					<button
						class="sl-icon-btn flex-none text-red-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
						onclick={() => handleDelete(version)}
						title="刪除版本"
						aria-label="刪除版本"
					>
						<Trash2 size={13} />
					</button>
				</div>
			{/each}
			{#if versions.length === 0}
				<p class="px-3 py-6 text-center text-xs text-muted">還沒有存過版本，上面填個說明按「儲存目前版本」開始記錄。</p>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(.sl-icon-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	:global(.sl-icon-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
	}
</style>
