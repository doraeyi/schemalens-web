<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { Cloud, Github, Plus, Users, X } from '@lucide/svelte';

	interface Props {
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();
</script>

<!--
	不登入本來就能用（內容存在這個瀏覽器）；登入是「存到雲端／多分頁／協作」的升級，
	不是使用的門檻。之前這裡寫「需要登入」，跟首頁「不用登入就能用」的承諾直接衝突。
-->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onCancel}>
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-sm font-semibold">把工作存到雲端</h2>
			<button class="sl-close-btn" onclick={onCancel} aria-label="關閉" title="關閉（Esc）"><X size={16} /></button>
		</div>
		<p class="mb-3 text-sm text-muted">
			你現在的內容已經存在這個瀏覽器，不登入也能繼續看、繼續改。登入 GitHub 之後可以：
		</p>
		<ul class="mb-4 space-y-1.5 text-sm">
			<li class="flex items-start gap-2"><Cloud size={15} class="mt-0.5 flex-none text-cyan" /> 存到雲端，換台電腦也打得開</li>
			<li class="flex items-start gap-2"><Plus size={15} class="mt-0.5 flex-none text-cyan" /> 建立多個分頁、保留版本歷史</li>
			<li class="flex items-start gap-2"><Users size={15} class="mt-0.5 flex-none text-cyan" /> 開即時協作分頁，邀請別人一起看</li>
		</ul>
		<p class="mb-4 text-xs text-muted">登入後，目前這份內容會自動存成你的第一個雲端分頁。</p>
		<div class="flex justify-end gap-2">
			<button class="sl-button sl-button-secondary" onclick={onCancel}>先不用</button>
			<button class="sl-button sl-button-primary" onclick={onConfirm} data-autofocus>
				<Github size={14} /> 使用 GitHub 登入
			</button>
		</div>
	</div>
</div>

