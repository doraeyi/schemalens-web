import type { AiProviderId } from './settings';

export interface AiModelOption {
	id: string;
	label: string;
}

export class AiKeyError extends Error {}

/** Claude 這邊的預設選擇；key 的清單裡沒有這個模型時退回清單第一個（API 回傳的順序本來就是新到舊）。 */
const PREFERRED_ANTHROPIC_MODEL = 'claude-opus-5';

/** OpenAI 的 /models 會連 embedding、語音、圖片模型一起回傳，只留下能拿來對話的。 */
function isOpenAiChatModel(id: string): boolean {
	if (!/^(gpt-|o\d)/.test(id)) return false;
	return !/(audio|realtime|tts|transcribe|image|embedding|search|instruct)/.test(id);
}

/**
 * 用使用者的 key 列出可用的模型，同時當作「key 能不能用」的測試——列模型不花 token，
 * 又能讓使用者從 key 實際有權限的模型裡挑，不用我們寫死一份很快就過時的模型名單。
 * SDK 用動態 import，沒開 AI 功能的人不用多載這兩包。
 */
export async function listModels(provider: AiProviderId, apiKey: string): Promise<AiModelOption[]> {
	if (provider === 'anthropic') {
		const { default: Anthropic } = await import('@anthropic-ai/sdk');
		const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
		try {
			const models: AiModelOption[] = [];
			for await (const model of client.models.list()) {
				models.push({ id: model.id, label: model.display_name });
			}
			const preferred = models.findIndex((m) => m.id === PREFERRED_ANTHROPIC_MODEL);
			if (preferred > 0) models.unshift(...models.splice(preferred, 1));
			return models;
		} catch (error) {
			if (error instanceof Anthropic.AuthenticationError) throw new AiKeyError('API key 無效，請確認有完整複製');
			if (error instanceof Anthropic.PermissionDeniedError) throw new AiKeyError('這把 key 沒有權限，請確認帳號已儲值');
			if (error instanceof Anthropic.APIConnectionError) throw new AiKeyError('連不到 Anthropic，請檢查網路');
			throw error;
		}
	}

	const { default: OpenAI } = await import('openai');
	const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
	try {
		const models: { id: string; created: number }[] = [];
		for await (const model of client.models.list()) {
			if (isOpenAiChatModel(model.id)) models.push({ id: model.id, created: model.created });
		}
		return models.sort((a, b) => b.created - a.created).map((m) => ({ id: m.id, label: m.id }));
	} catch (error) {
		if (error instanceof OpenAI.AuthenticationError) throw new AiKeyError('API key 無效，請確認有完整複製');
		if (error instanceof OpenAI.PermissionDeniedError) throw new AiKeyError('這把 key 沒有權限，請確認帳號已儲值');
		if (error instanceof OpenAI.APIConnectionError) throw new AiKeyError('連不到 OpenAI，請檢查網路');
		throw error;
	}
}
