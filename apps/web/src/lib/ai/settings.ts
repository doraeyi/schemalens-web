export type AiProviderId = 'anthropic' | 'openai';

export interface AiSettings {
	provider: AiProviderId;
	apiKey: string;
	model: string;
}

export interface AiProviderInfo {
	id: AiProviderId;
	label: string;
	/** 申請 API key 的頁面。 */
	keyUrl: string;
	keyPlaceholder: string;
	/** 設定畫面顯示的申請步驟。 */
	steps: string[];
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
	anthropic: {
		id: 'anthropic',
		label: 'Claude（Anthropic）',
		keyUrl: 'https://console.anthropic.com/settings/keys',
		keyPlaceholder: 'sk-ant-...',
		steps: [
			'登入 Anthropic Console（跟 claude.ai 的訂閱是分開的帳號／計費）',
			'到 Settings → Billing 儲值',
			'到 Settings → API Keys 按「Create Key」，複製產生的 key',
			'貼到下面的欄位'
		]
	},
	openai: {
		id: 'openai',
		label: 'GPT（OpenAI）',
		keyUrl: 'https://platform.openai.com/api-keys',
		keyPlaceholder: 'sk-...',
		steps: [
			'登入 OpenAI Platform（跟 ChatGPT Plus 的訂閱是分開計費的）',
			'到 Settings → Billing 儲值',
			'到 API keys 按「Create new secret key」，複製產生的 key',
			'貼到下面的欄位'
		]
	}
};

/**
 * 刻意跟 localDraft 的 key 分開，而且只存在 localStorage——API key 只留在使用者自己的瀏覽器，
 * 不送到我們的後端，也絕對不能放進 Yjs 共享文件（會透過 relay 同步給同房間的每一個協作者）。
 */
const STORAGE_KEY = 'schemalens:ai-settings:v1';

export function loadAiSettings(): AiSettings | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<AiSettings>;
		if ((parsed.provider !== 'anthropic' && parsed.provider !== 'openai') || !parsed.apiKey || !parsed.model) return null;
		return { provider: parsed.provider, apiKey: parsed.apiKey, model: parsed.model };
	} catch {
		return null;
	}
}

export function saveAiSettings(settings: AiSettings): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// storage full / private mode——這次就不記住，下次重新輸入
	}
}

export function clearAiSettings(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
