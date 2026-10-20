import type { Locale } from './locale';

/** 很多對話框都會用到的按鈕文字。 */
export const COMMON = {
	'zh-hant': {
		close: '關閉',
		closeEsc: '關閉（Esc）',
		cancel: '取消',
		copy: '複製',
		copied: '已複製',
		copyToClipboard: '複製到剪貼簿'
	},
	en: {
		close: 'Close',
		closeEsc: 'Close (Esc)',
		cancel: 'Cancel',
		copy: 'Copy',
		copied: 'Copied',
		copyToClipboard: 'Copy to clipboard'
	}
} satisfies Record<Locale, Record<string, string>>;
