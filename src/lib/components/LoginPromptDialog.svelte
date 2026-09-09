<script lang="ts">
	import { Github, X } from '@lucide/svelte';

	interface Props {
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { message, onConfirm, onCancel }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">需要登入</h2>
			<button class="text-muted hover:text-fg" onclick={onCancel}><X size={16} /></button>
		</div>
		<p class="mb-4 text-xs text-muted">{message}</p>
		<div class="flex justify-end gap-2">
			<button class="sl-btn" onclick={onCancel}>取消</button>
			<button class="sl-btn sl-btn-primary" onclick={onConfirm}>
				<Github size={13} /> 使用 GitHub 登入
			</button>
		</div>
	</div>
</div>

<style>
	.sl-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: 6px;
		border: 1px solid var(--sl-border);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.sl-btn-primary {
		background: var(--sl-cyan);
		border-color: transparent;
		color: var(--sl-bg);
	}
</style>
