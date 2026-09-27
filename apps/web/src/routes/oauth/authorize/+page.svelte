<script lang="ts">
	import { Github } from '@lucide/svelte';
	import { signIn } from '@auth/sveltekit/client';
	import logoUrl from '$lib/assets/logo.png';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>SchemaLens — 授權連線</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl">
		<img src={logoUrl} alt="SchemaLens" class="mx-auto mb-4 h-10" />

		{#if data.error}
			<h1 class="mb-2 text-sm font-semibold">無法授權</h1>
			<p class="text-xs text-muted">{data.error}</p>
		{:else}
			<h1 class="mb-3 text-center text-sm font-semibold">
				「{data.clientName}」想要連接你的 SchemaLens
			</h1>
			<ul class="mb-4 list-disc space-y-1 pl-5 text-xs text-muted">
				<li>讀取你的分頁（包含被邀請協作的）</li>
				<li>檢查 schema 的問題</li>
				<li>修改分頁內容、建立新分頁（每次修改前都會自動存版本，可以從「歷史」還原）</li>
			</ul>
			<p class="mb-4 text-[11px] text-muted">
				授權完成後會回到：<span class="font-mono text-fg">{data.redirectHost}</span><br />
				SchemaLens 不會取得你的 Claude／ChatGPT 帳號資訊。
			</p>

			{#if form?.error}
				<p class="mb-3 text-xs text-red-300">{form.error}</p>
			{/if}

			{#if data.signedIn}
				<p class="mb-3 text-xs">目前登入：<span class="font-semibold">{data.userName}</span></p>
				<form method="POST" class="flex justify-end gap-2">
					<button class="sl-btn" name="decision" value="deny">拒絕</button>
					<button class="sl-btn sl-btn-primary" name="decision" value="approve">允許</button>
				</form>
			{:else}
				<button class="sl-btn sl-btn-primary w-full justify-center" onclick={() => signIn('github')}>
					<Github size={13} /> 先用 GitHub 登入 SchemaLens
				</button>
			{/if}
		{/if}
	</div>
</div>

<style>
	.sl-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 14px;
		border-radius: 6px;
		border: 1px solid var(--sl-border);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.sl-btn-primary {
		background: var(--sl-cyan);
		border-color: transparent;
		color: var(--sl-bg);
	}
</style>
