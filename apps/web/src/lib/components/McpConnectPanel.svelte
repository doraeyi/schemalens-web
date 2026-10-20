<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import { pick } from '$lib/i18n/current';

	const m = $derived(
		pick({
			'zh-hant': {
				copy: '複製',
				leadBefore: '已經有 Claude 或 ChatGPT 訂閱的話，把 SchemaLens 加成 connector，就能在那邊直接叫 AI 讀取、檢查、修改你的分頁，',
				free: '不用另外付費',
				leadAfter: '。改完會直接出現在這裡的畫布上，每次修改前也會自動存版本。',
				needSignIn: 'connector 操作的是雲端分頁，要先用 GitHub 登入 SchemaLens。',
				url: 'Connector 網址',
				claudeTitle: 'claude.ai／Claude 桌面版',
				claudeSteps: [
					'設定 → Connectors → 新增自訂 connector（Add custom connector）',
					'名稱填 SchemaLens，網址貼上面那串',
					'按連接，會跳到 SchemaLens 用 GitHub 登入、按「允許」',
					'在對話裡開啟 SchemaLens connector，例如說「幫我看『電商』分頁有什麼問題並修好」'
				],
				claudeCodeBefore: '在終端機執行，然後在 Claude Code 裡輸入',
				claudeCodeAfter: '完成登入：',
				chatgpt: '在設定的 Apps／Connectors 裡新增自訂 connector（可能要先開啟開發者模式），貼上同一個網址。各方案能不能用自訂 connector 以 OpenAI 目前的規定為準。'
			},
			en: {
				copy: 'Copy',
				leadBefore: 'If you already pay for Claude or ChatGPT, add SchemaLens as a connector and ask the AI there to read, check and edit your pages, ',
				free: 'at no extra cost',
				leadAfter: '. Changes show up on this canvas right away, and a version is saved before every edit.',
				needSignIn: 'Connectors work on cloud pages, so sign in to SchemaLens with GitHub first.',
				url: 'Connector URL',
				claudeTitle: 'claude.ai / Claude desktop',
				claudeSteps: [
					'Settings → Connectors → Add custom connector',
					'Name it SchemaLens and paste the URL above',
					'Click Connect; SchemaLens opens, sign in with GitHub and click Allow',
					'Turn on the SchemaLens connector in a chat, e.g. "Check my Shop page for problems and fix them"'
				],
				claudeCodeBefore: 'Run this in a terminal, then type',
				claudeCodeAfter: 'in Claude Code to sign in:',
				chatgpt: 'Add a custom connector under Apps / Connectors in settings (you may need to turn on developer mode first) and paste the same URL. Whether your plan allows custom connectors is up to OpenAI.'
			}
		})
	);

	interface Props {
		signedIn: boolean;
	}

	let { signedIn }: Props = $props();

	const mcpUrl = `${window.location.origin}/api/mcp`;
	const claudeCodeCommand = `claude mcp add --transport http schemalens ${mcpUrl}`;

	let copied = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy(value: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			copied = value;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = null), 2000);
		} catch {
			// 剪貼簿被瀏覽器擋下——文字本來就選取得到，使用者可以自己手動複製。
		}
	}
</script>

{#snippet copyField(value: string)}
	<div class="mb-2 flex items-center gap-2">
		<code class="flex-1 truncate rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[11px] select-all">{value}</code>
		<button class="shrink-0 text-muted hover:text-cyan" onclick={() => copy(value)} aria-label={m.copy}>
			{#if copied === value}<Check size={13} class="text-cyan" />{:else}<Copy size={13} />{/if}
		</button>
	</div>
{/snippet}

<p class="mb-3 text-xs text-muted">
	{m.leadBefore}<span class="text-fg">{m.free}</span>{m.leadAfter}
</p>

{#if !signedIn}
	<p class="mb-3 rounded-lg border border-yellow-300/40 p-2 text-xs text-yellow-300">
		{m.needSignIn}
	</p>
{/if}

<div class="mb-1 text-xs text-muted">{m.url}</div>
{@render copyField(mcpUrl)}

<div class="mt-3 space-y-3 text-xs">
	<div class="rounded-lg border border-border bg-bg/60 p-3">
		<div class="mb-1.5 font-semibold">{m.claudeTitle}</div>
		<ol class="list-decimal space-y-0.5 pl-4 text-muted">
			{#each m.claudeSteps as step (step)}<li>{step}</li>{/each}
		</ol>
	</div>

	<div class="rounded-lg border border-border bg-bg/60 p-3">
		<div class="mb-1.5 font-semibold">Claude Code</div>
		<p class="mb-1.5 text-muted">{m.claudeCodeBefore} <code>/mcp</code> {m.claudeCodeAfter}</p>
		{@render copyField(claudeCodeCommand)}
	</div>

	<div class="rounded-lg border border-border bg-bg/60 p-3">
		<div class="mb-1.5 font-semibold">ChatGPT</div>
		<p class="text-muted">
			{m.chatgpt}
		</p>
	</div>
</div>
