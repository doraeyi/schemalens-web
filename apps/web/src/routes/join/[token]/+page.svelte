<script lang="ts">
	import { onMount } from 'svelte';
	import { Github } from '@lucide/svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { initTheme } from '$lib/stores/theme.svelte';
	import type { PageData } from './$types';
	import { pick } from '$lib/i18n/current';

	const m = $derived(
		pick({
			'zh-hant': {
				title: '加入即時協作 — SchemaLens',
				invited: '邀請你加入即時協作',
				signInHint: '用 GitHub 登入後就能加入這個分頁，跟對方一起即時編輯。',
				signIn: '使用 GitHub 登入',
				expired: '這條邀請連結已經失效',
				askAgain: '跟分頁擁有者要一條新的邀請連結看看。'
			},
			en: {
				title: 'Join live collaboration — SchemaLens',
				invited: 'You are invited to collaborate live',
				signInHint: 'Sign in with GitHub to join this page and edit it together in real time.',
				signIn: 'Sign in with GitHub',
				expired: 'This invite link has expired',
				askAgain: 'Ask the page owner for a new invite link.'
			}
		})
	);

	let { data }: { data: PageData } = $props();

	onMount(() => {
		initTheme();
	});

	function handleSignIn(): void {
		void signIn('github', { callbackUrl: window.location.href });
	}
</script>

<svelte:head>
	<title>{m.title}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
	<div class="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-2xl">
		{#if !data.loggedIn}
			<h1 class="mb-2 text-sm font-semibold">{m.invited}</h1>
			<p class="mb-4 text-xs text-muted">{m.signInHint}</p>
			<button
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
				onclick={handleSignIn}
			>
				<Github size={14} /> {m.signIn}
			</button>
		{:else if data.invalid}
			<h1 class="mb-2 text-sm font-semibold">{m.expired}</h1>
			<p class="text-xs text-muted">{m.askAgain}</p>
		{/if}
	</div>
</div>
