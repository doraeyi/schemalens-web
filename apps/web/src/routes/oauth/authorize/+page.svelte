<script lang="ts">
	import { Github } from '@lucide/svelte';
	import { signIn } from '@auth/sveltekit/client';
	import Logo from '$lib/components/Logo.svelte';
	import { pick } from '$lib/i18n/current';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const m = $derived(
		pick({
			'zh-hant': {
				title: 'SchemaLens — 授權連線',
				cannot: '無法授權',
				wants: (client: string) => `「${client}」想要連接你的 SchemaLens`,
				scopes: [
					'讀取你的分頁（包含被邀請協作的）',
					'檢查 schema 的問題',
					'修改分頁內容、建立新分頁（每次修改前都會自動存版本，可以從「歷史」還原）'
				],
				returnsTo: '授權完成後會回到：',
				noAccountInfo: 'SchemaLens 不會取得你的 Claude／ChatGPT 帳號資訊。',
				signedInAs: '目前登入：',
				deny: '拒絕',
				allow: '允許',
				signInFirst: '先用 GitHub 登入 SchemaLens'
			},
			en: {
				title: 'SchemaLens — Authorize connection',
				cannot: 'Cannot authorize',
				wants: (client: string) => `"${client}" wants to connect to your SchemaLens`,
				scopes: [
					'Read your pages (including ones you were invited to)',
					'Check your schemas for problems',
					'Edit pages and create new ones (a version is saved before every edit, so you can restore from History)'
				],
				returnsTo: 'After authorizing you will return to:',
				noAccountInfo: 'SchemaLens does not get any information about your Claude / ChatGPT account.',
				signedInAs: 'Signed in as:',
				deny: 'Deny',
				allow: 'Allow',
				signInFirst: 'Sign in to SchemaLens with GitHub first'
			}
		})
	);
</script>

<svelte:head>
	<title>{m.title}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl">
		<div class="mb-4 flex justify-center"><Logo size={36} /></div>

		{#if data.error}
			<h1 class="mb-2 text-sm font-semibold">{m.cannot}</h1>
			<p class="text-xs text-muted">{data.error}</p>
		{:else}
			<h1 class="mb-3 text-center text-sm font-semibold">
				{m.wants(data.clientName ?? '')}
			</h1>
			<ul class="mb-4 list-disc space-y-1 pl-5 text-xs text-muted">
				{#each m.scopes as scope (scope)}<li>{scope}</li>{/each}
			</ul>
			<p class="mb-4 text-[11px] text-muted">
				{m.returnsTo} <span class="font-mono text-fg">{data.redirectHost}</span><br />
				{m.noAccountInfo}
			</p>

			{#if form?.error}
				<p class="mb-3 text-xs text-red-300">{form.error}</p>
			{/if}

			{#if data.signedIn}
				<p class="mb-3 text-xs">{m.signedInAs} <span class="font-semibold">{data.userName}</span></p>
				<form method="POST" class="flex justify-end gap-2">
					<button class="sl-button sl-button-secondary" name="decision" value="deny">{m.deny}</button>
					<button class="sl-button sl-button-primary" name="decision" value="approve">{m.allow}</button>
				</form>
			{:else}
				<button class="sl-button sl-button-primary w-full" onclick={() => signIn('github')}>
					<Github size={13} /> {m.signInFirst}
				</button>
			{/if}
		{/if}
	</div>
</div>

