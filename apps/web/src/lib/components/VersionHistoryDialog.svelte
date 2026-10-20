<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { Eye, GitCompare, History, Trash2, X } from '@lucide/svelte';
	import { currentLocale, pick } from '$lib/i18n/current';
	import { COMMON } from '$lib/i18n/common';

	const common = $derived(pick(COMMON));
	const m = $derived(
		pick({
			'zh-hant': {
				confirmDelete: (label: string) => `確定要刪除版本「${label}」嗎？這個動作無法復原。`,
				title: '版本歷史',
				labelPlaceholder: '這個版本的說明（可留空）',
				save: '儲存目前版本',
				picked: (label: string) => `已選「${label}」——再點另一筆的「比較」完成比對，或點同一筆取消。`,
				view: '檢視這個版本當時的內容',
				unpick: '取消選取',
				compareWithPicked: '跟已選的那筆比較',
				pickToCompare: '選這筆，再點另一筆來比較',
				compare: '比較',
				delete: '刪除版本',
				empty: '還沒有存過版本，上面填個說明按「儲存目前版本」開始記錄。'
			},
			en: {
				confirmDelete: (label: string) => `Delete the version "${label}"? This cannot be undone.`,
				title: 'Version history',
				labelPlaceholder: 'Describe this version (optional)',
				save: 'Save current version',
				picked: (label: string) => `"${label}" picked — click Compare on another version to compare, or on the same one to cancel.`,
				view: 'View this version as it was',
				unpick: 'Cancel selection',
				compareWithPicked: 'Compare with the picked version',
				pickToCompare: 'Pick this, then click another to compare',
				compare: 'Compare',
				delete: 'Delete version',
				empty: 'No versions yet. Add a description above and click "Save current version" to start.'
			}
		})
	);

	export interface VersionSummary {
		id: string;
		label: string;
		createdAt: string;
	}

	interface Props {
		versions: VersionSummary[];
		onSaveVersion: (label: string) => void;
		onViewVersion: (versionId: string) => void;
		onDiffVersion: (versionId: string, baseVersionId?: string) => void;
		onDeleteVersion: (versionId: string) => void;
		onClose: () => void;
	}

	let { versions, onSaveVersion, onViewVersion, onDiffVersion, onDeleteVersion, onClose }: Props = $props();

	let label = $state('');
	/**
	 * 跟 GitHub 選兩個 commit 比較一樣：點第一筆的「比較」先選起來，
	 * 再點第二筆的「比較」才真的觸發 diff——不用另外一顆「選為基準」按鈕。
	 * 點同一筆等於取消。
	 */
	let pickedVersionId = $state<string | null>(null);

	function handleCompareClick(versionId: string): void {
		if (pickedVersionId === null) {
			pickedVersionId = versionId;
			return;
		}
		if (pickedVersionId === versionId) {
			pickedVersionId = null;
			return;
		}
		const first = pickedVersionId;
		pickedVersionId = null;
		onDiffVersion(versionId, first);
	}

	function handleSave(): void {
		onSaveVersion(label.trim());
		label = '';
	}

	function handleDelete(version: VersionSummary): void {
		if (!confirm(m.confirmDelete(version.label))) return;
		onDeleteVersion(version.id);
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleString(currentLocale() === 'en' ? 'en' : 'zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onClose}>
	<div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="flex items-center gap-1.5 text-sm font-semibold">
				<History size={15} class="text-cyan" />
				{m.title}
			</h2>
			<button class="sl-close-btn" onclick={onClose} aria-label={common.close} title={common.closeEsc}><X size={16} /></button>
		</div>

		<div class="mb-3 flex items-center gap-2">
			<input
				bind:value={label}
				type="text"
				placeholder={m.labelPlaceholder}
				onkeydown={(e) => e.key === 'Enter' && handleSave()}
				class="w-full rounded-md border border-border bg-bg/60 px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:border-cyan focus:outline-none"
			/>
			<button
				class="flex-none rounded-md border border-cyan bg-cyan/15 px-3 py-1.5 text-xs text-cyan hover:bg-cyan/25"
				onclick={handleSave}
			>
				{m.save}
			</button>
		</div>

		{#if pickedVersionId}
			<p class="mb-2 text-[11px] text-muted">
				{m.picked(versions.find((v) => v.id === pickedVersionId)?.label ?? '')}
			</p>
		{/if}

		<div class="flex-1 overflow-auto rounded-lg border border-border">
			{#each versions as version (version.id)}
				{@const isPicked = version.id === pickedVersionId}
				<div
					class="group flex items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-0 {isPicked
						? 'bg-cyan/10'
						: ''}"
				>
					<div class="min-w-0 flex-1">
						<div class="truncate font-semibold">{version.label}</div>
						<div class="text-muted">{formatTime(version.createdAt)}</div>
					</div>
					<button
						class="sl-icon-btn flex-none opacity-0 group-hover:opacity-100"
						onclick={() => onViewVersion(version.id)}
						title={m.view}
						aria-label={m.view}
					>
						<Eye size={13} />
					</button>
					<button
						class="sl-icon-btn flex-none {isPicked ? 'text-cyan' : 'opacity-0 group-hover:opacity-100'}"
						onclick={() => handleCompareClick(version.id)}
						title={isPicked ? m.unpick : pickedVersionId ? m.compareWithPicked : m.pickToCompare}
						aria-label={m.compare}
					>
						<GitCompare size={13} />
					</button>
					<button
						class="sl-icon-btn flex-none text-red-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
						onclick={() => handleDelete(version)}
						title={m.delete}
						aria-label={m.delete}
					>
						<Trash2 size={13} />
					</button>
				</div>
			{/each}
			{#if versions.length === 0}
				<p class="px-3 py-6 text-center text-xs text-muted">{m.empty}</p>
			{/if}
		</div>
	</div>
</div>
