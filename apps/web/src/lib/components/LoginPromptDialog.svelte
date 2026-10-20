<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { Cloud, Github, Plus, Users, X } from '@lucide/svelte';
	import { currentLocale, pick } from '$lib/i18n/current';
	import { COMMON } from '$lib/i18n/common';

	const common = $derived(pick(COMMON));
	const m = $derived(
		pick({
			'zh-hant': {
				title: '把工作存到雲端',
				lead: '{m.lead}',
				cloud: '存到雲端，換台電腦也打得開',
				pages: '建立多個分頁、保留版本歷史',
				collab: '開即時協作分頁，邀請別人一起看',
				after: '登入後，目前這份內容會自動存成你的第一個雲端分頁。',
				later: '先不用',
				signIn: '使用 GitHub 登入'
			},
			en: {
				title: 'Save your work to the cloud',
				lead: 'Your content is already saved in this browser, and you can keep viewing and editing without signing in. Sign in with GitHub to:',
				cloud: 'Save to the cloud and open it from any computer',
				pages: 'Create several pages and keep version history',
				collab: 'Open live collaboration pages and invite others',
				after: 'After you sign in, the current content becomes your first cloud page.',
				later: 'Not now',
				signIn: 'Sign in with GitHub'
			}
		})
	);

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
			<h2 class="text-sm font-semibold">{m.title}</h2>
			<button class="sl-close-btn" onclick={onCancel} aria-label={common.close} title={common.closeEsc}><X size={16} /></button>
		</div>
		<p class="mb-3 text-sm text-muted">
			{m.lead}
		</p>
		<ul class="mb-4 space-y-1.5 text-sm">
			<li class="flex items-start gap-2"><Cloud size={15} class="mt-0.5 flex-none text-cyan" /> {m.cloud}</li>
			<li class="flex items-start gap-2"><Plus size={15} class="mt-0.5 flex-none text-cyan" /> {m.pages}</li>
			<li class="flex items-start gap-2"><Users size={15} class="mt-0.5 flex-none text-cyan" /> {m.collab}</li>
		</ul>
		<p class="mb-4 text-xs text-muted">{m.after}</p>
		<div class="flex justify-end gap-2">
			<button class="sl-button sl-button-secondary" onclick={onCancel}>{m.later}</button>
			<button class="sl-button sl-button-primary" onclick={onConfirm} data-autofocus>
				<Github size={14} /> {m.signIn}
			</button>
		</div>
	</div>
</div>

