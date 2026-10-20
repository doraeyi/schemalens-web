<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { onMount, untrack } from 'svelte';
	import { Eye, EyeOff, ExternalLink, Loader2, X } from '@lucide/svelte';
	import { AI_PROVIDERS, type AiProviderId, type AiSettings } from '$lib/ai/settings';
	import { AiKeyError, listModels, type AiModelOption } from '$lib/ai/providers';
	import McpConnectPanel from './McpConnectPanel.svelte';
	import { currentLocale, pick } from '$lib/i18n/current';
	import { COMMON } from '$lib/i18n/common';

	const common = $derived(pick(COMMON));
	const m = $derived(
		pick({
			'zh-hant': {
				noModels: '這把 key 沒有任何可用的對話模型',
				keyError: (e: AiKeyError) =>
					e.kind === 'invalid' ? 'API key 無效，請確認有完整複製' : e.kind === 'permission' ? '這把 key 沒有權限，請確認帳號已儲值' : `連不到 ${e.provider}，請檢查網路`,
				verifyFailed: (detail: string) => `驗證失敗：${detail}`,
				tabConnect: '用訂閱連接（免費）',
				tabApiKey: 'API key（照用量付費）',
				title: 'AI 助手',
				whichProvider: '要用哪一家的 AI？費用直接算在你自己的帳號。',
				howToGetKey: '怎麼取得 API key',
				getKey: '前往申請頁面',
				hideKey: '隱藏 key',
				showKey: '顯示 key',
				verify: '驗證',
				pickModel: '✓ key 可以用，選擇模型',
				privacy: 'key 只存在這個瀏覽器，不會送到 SchemaLens 的伺服器，也不會同步給協作者。使用 AI 功能時，目前的 schema 內容會送到你選的 AI 供應商。',
				removeKey: '移除已存的 key',
				save: '儲存'
			},
			en: {
				noModels: 'This key has no chat models available',
				keyError: (e: AiKeyError) =>
					e.kind === 'invalid' ? 'Invalid API key; check that you copied all of it' : e.kind === 'permission' ? 'This key lacks permission; check that the account has credit' : `Cannot reach ${e.provider}; check your network`,
				verifyFailed: (detail: string) => `Verification failed: ${detail}`,
				tabConnect: 'Connect a subscription (free)',
				tabApiKey: 'API key (pay per use)',
				title: 'AI assistant',
				whichProvider: 'Which AI do you want? Usage is billed to your own account.',
				howToGetKey: 'How to get an API key',
				getKey: 'Go to the key page',
				hideKey: 'Hide key',
				showKey: 'Show key',
				verify: 'Verify',
				pickModel: '✓ Key works. Pick a model',
				privacy: 'The key stays in this browser. It is never sent to the SchemaLens server or shared with collaborators. When you use AI features, the current schema is sent to the AI provider you picked.',
				removeKey: 'Remove saved key',
				save: 'Save'
			}
		})
	);

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
				error = m.noModels;
				return;
			}
			models = list;
			if (!list.some((m) => m.id === model)) model = list[0].id;
		} catch (e) {
			error = e instanceof AiKeyError ? m.keyError(e) : m.verifyFailed(e instanceof Error ? e.message : String(e));
		} finally {
			verifying = false;
		}
	}

	onMount(() => {
		if (initial) void verify();
	});

	const TABS = $derived([
		{ id: 'connect', label: m.tabConnect },
		{ id: 'apikey', label: m.tabApiKey }
	] as const);

	function save(): void {
		if (!verified || !model) return;
		onSave({ provider, apiKey: apiKey.trim(), model });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" use:modal={onClose}>
	<div class="flex max-h-[85vh] w-full max-w-md flex-col overflow-auto rounded-xl border border-border bg-surface p-5 text-fg shadow-2xl">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">{m.title}</h2>
			<button class="sl-close-btn" onclick={onClose} aria-label={common.close} title={common.closeEsc}><X size={16} /></button>
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
				<button class="sl-button sl-button-secondary" onclick={onClose}>{common.close}</button>
			</div>
		{:else}

			<p class="mb-2 text-xs text-muted">{m.whichProvider}</p>
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
				<div class="mb-1.5 font-semibold">{m.howToGetKey}</div>
				<ol class="list-decimal space-y-0.5 pl-4 text-muted">
					{#each info.steps[currentLocale()] as step (step)}
						<li>{step}</li>
					{/each}
				</ol>
				<a
					class="mt-2 inline-flex items-center gap-1 text-cyan hover:opacity-80"
					href={info.keyUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					{m.getKey} <ExternalLink size={11} />
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
						aria-label={showKey ? m.hideKey : m.showKey}
					>
						{#if showKey}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
					</button>
				</div>
				<button class="sl-button sl-button-secondary" onclick={verify} disabled={verifying || !apiKey.trim()}>
					{#if verifying}<Loader2 size={12} class="animate-spin" />{/if}
					{m.verify}
				</button>
			</div>

			{#if error}
				<p class="mb-2 text-xs text-red-300">{error}</p>
		{/if}

		{#if verified}
			<label class="mb-1 block text-xs text-muted" for="ai-model">{m.pickModel}</label>
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
			{m.privacy}
		</p>

		<div class="flex items-center gap-2">
			{#if current}
				<button class="text-xs text-muted hover:text-red-300" onclick={onClear}>{m.removeKey}</button>
			{/if}
			<div class="ml-auto flex gap-2">
				<button class="sl-button sl-button-secondary" onclick={onClose}>{common.cancel}</button>
				<button class="sl-button sl-button-primary" onclick={save} disabled={!verified || !model}>{m.save}</button>
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
</style>
