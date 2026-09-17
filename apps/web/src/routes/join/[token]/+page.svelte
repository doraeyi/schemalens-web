<script lang="ts">
	import { onMount } from 'svelte';
	import { Github } from '@lucide/svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { initTheme } from '$lib/stores/theme.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		initTheme();
	});

	function handleSignIn(): void {
		void signIn('github', { callbackUrl: window.location.href });
	}
</script>

<svelte:head>
	<title>加入即時協作 — SchemaLens</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-2xl">
		{#if !data.loggedIn}
			<h1 class="mb-2 text-sm font-semibold">邀請你加入即時協作</h1>
			<p class="mb-4 text-xs text-muted">用 GitHub 登入後就能加入這個分頁，跟對方一起即時編輯。</p>
			<button
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
				onclick={handleSignIn}
			>
				<Github size={14} /> 使用 GitHub 登入
			</button>
		{:else if data.invalid}
			<h1 class="mb-2 text-sm font-semibold">這條邀請連結已經失效</h1>
			<p class="text-xs text-muted">跟分頁擁有者要一條新的邀請連結看看。</p>
		{/if}
	</div>
</div>
