<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Eye, EyeOff, ExternalLink, Loader2, X } from '@lucide/svelte';
	import { AI_PROVIDERS, type AiProviderId, type AiSettings } from '$lib/ai/settings';
	import { AiKeyError, listModels, type AiModelOption } from '$lib/ai/providers';
	import McpConnectPanel from './McpConnectPanel.svelte';

	interface Props {
		current: AiSettings | null;
		signedIn: boolean;
		onSave: (settings: AiSettings) => void;
		onClear: () => void;
		onClose: () => void;
	}

	let { current, signedIn, onSave, onClear, onClose }: Props = $props();

	/** 預設先給「用訂閱連接」——大多數人已經有 Claude／ChatGPT 訂閱，不用另外付費；API key 是給想直接在這裡聊的人。 */
	let tab = $state<'connect' | 'apikey'>(untrack(() => current) ? 'apikey' : 'connect');

	// 表單只拿開啟當下的設定當初始值，之後由使用者自己改。
	const initial = untrack(() => current);
	let provider = $state<AiProviderId>(initial?.provider ?? 'anthropic');
	let apiKey = $state(initial?.apiKey ?? '');
	let showKey = $state(false);
	let models = $state<AiModelOption[]>([]);
	let model = $state(initial?.model ?? '');
	let verifying = $state(false);
	let error = $state<string | null>(null);

	const info = $derived(AI_PROVIDERS[provider]);
	/** key 或供應商一改，之前驗證出來的模型清單就不算數了，要重新驗證才能存。 */
	const verified = $derived(models.length > 0);

	function selectProvider(next: AiProviderId): void {
		if (next === provider) return;
		provider = next;
		apiKey = initial?.provider === next ? initial.apiKey : '';
		resetVerification();
	}

	function resetVerification(): void {
		models = [];
		error = null;
	}

	async function verify(): Promise<void> {
		const key = apiKey.trim();
		if (!key) return;
		verifying = true;
		error = null;
		try {
			const list = await listModels(provider, key);
			if (list.length === 0) {
				error = '這把 key 沒有任何可用的對話模型';
				return;
			}
			models = list;
			if (!list.some((m) => m.id === model)) model = list[0].id;
		} catch (e) {
			error = e instanceof AiKeyError ? e.message : `驗證失敗：${e instanceof Error ? e.message : String(e)}`;
		} finally {
			verifying = false;
		}
	}

	onMount(() => {
		if (initial) void verify();
	});

	const TABS = [
		{ id: 'connect', label: '用訂閱連接（免費）' },
		{ id: 'apikey', label: 'API key（照用量付費）' }
	] as const;

	function save(): void {
		if (!verified || !model) return;
		onSave({ provider, apiKey: apiKey.trim(), model });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="flex max-h-[85vh] w-full max-w-md flex-col overflow-auto rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">AI 助手</h2>
			<button class="text-muted hover:text-fg" onclick={onClose}><X size={16} /></button>
		</div>

		<div class="mb-4 flex gap-1 rounded-lg bg-bg/60 p-1">
			{#each TABS as t (t.id)}
				<button
					class="flex-1 rounded-md px-2 py-1 text-xs {tab === t.id ? 'bg-surface text-cyan shadow' : 'text-muted hover:text-fg'}"
					onclick={() => (tab = t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>

		{#if tab === 'connect'}
			<McpConnectPanel {signedIn} />
			<div class="mt-4 flex justify-end">
				<button class="sl-btn" onclick={onClose}>關閉</button>
			</div>
		{:else}

			<p class="mb-2 text-xs text-muted">要用哪一家的 AI？費用直接算在你自己的帳號。</p>
			<div class="mb-4 grid grid-cols-2 gap-2">
				{#each Object.values(AI_PROVIDERS) as p (p.id)}
					<button
						class="rounded-lg border px-3 py-2 text-xs {provider === p.id
							? 'border-cyan text-cyan'
							: 'border-border text-muted hover:text-fg'}"
						onclick={() => selectProvider(p.id)}
					>
						{p.label}
					</button>
				{/each}
			</div>

			<div class="mb-3 rounded-lg border border-border bg-bg/60 p-3 text-xs">
				<div class="mb-1.5 font-semibold">怎麼取得 API key</div>
				<ol class="list-decimal space-y-0.5 pl-4 text-muted">
					{#each info.steps as step (step)}
						<li>{step}</li>
					{/each}
				</ol>
				<a
					class="mt-2 inline-flex items-center gap-1 text-cyan hover:opacity-80"
					href={info.keyUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					前往申請頁面 <ExternalLink size={11} />
				</a>
			</div>

			<label class="mb-1 block text-xs text-muted" for="ai-api-key">API key</label>
			<div class="mb-2 flex gap-2">
				<div class="relative flex-1">
					<input
						id="ai-api-key"
						class="w-full rounded-md border border-border bg-bg px-2 py-1.5 pr-7 font-mono text-xs outline-none focus:border-cyan"
						class:masked={!showKey}
						type="text"
						name="ai-api-key"
						placeholder={info.keyPlaceholder}
						autocomplete="off"
						spellcheck="false"
						data-1p-ignore
						data-lpignore="true"
						data-form-type="other"
						bind:value={apiKey}
						oninput={resetVerification}
						onkeydown={(e) => e.key === 'Enter' && void verify()}
					/>
					<button
						class="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted hover:text-fg"
						onclick={() => (showKey = !showKey)}
						aria-label={showKey ? '隱藏 key' : '顯示 key'}
					>
						{#if showKey}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
					</button>
				</div>
				<button class="sl-btn" onclick={verify} disabled={verifying || !apiKey.trim()}>
					{#if verifying}<Loader2 size={12} class="animate-spin" />{/if}
					驗證
				</button>
			</div>

			{#if error}
				<p class="mb-2 text-xs text-red-300">{error}</p>
		{/if}

		{#if verified}
			<label class="mb-1 block text-xs text-muted" for="ai-model">✓ key 可以用，選擇模型</label>
			<select
				id="ai-model"
				class="mb-3 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-cyan"
				bind:value={model}
			>
				{#each models as m (m.id)}
					<option value={m.id}>{m.label === m.id ? m.id : `${m.label}（${m.id}）`}</option>
				{/each}
			</select>
		{/if}

		<p class="mb-4 text-[11px] leading-relaxed text-muted">
			key 只存在這個瀏覽器，不會送到 SchemaLens 的伺服器，也不會同步給協作者。使用 AI 功能時，目前的
			schema 內容會送到你選的 AI 供應商。
		</p>

		<div class="flex items-center gap-2">
			{#if current}
				<button class="text-xs text-muted hover:text-red-300" onclick={onClear}>移除已存的 key</button>
			{/if}
			<div class="ml-auto flex gap-2">
				<button class="sl-btn" onclick={onClose}>取消</button>
				<button class="sl-btn sl-btn-primary" onclick={save} disabled={!verified || !model}>儲存</button>
			</div>
		</div>
		{/if}
	</div>
</div>

<style>
	/*
	 * 刻意不用 type="password"：瀏覽器看到密碼欄位會直接把這個網域存過的帳密自動填進來
	 * （autocomplete="off" 對密碼欄位無效），API key 欄位被填進別的密碼。改用一般文字欄位加遮罩。
	 */
	.masked {
		-webkit-text-security: disc;
	}
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
		font-size: 12px;
		cursor: pointer;
	}
	.sl-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.sl-btn-primary {
		background: var(--sl-cyan);
		border-color: transparent;
		color: var(--sl-bg);
	}
</style>
