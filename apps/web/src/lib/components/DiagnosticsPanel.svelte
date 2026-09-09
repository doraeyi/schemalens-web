<script lang="ts">
	import { AlertTriangle, Code, X } from '@lucide/svelte';

	/**
	 * 刻意不用 @schemalens/schema-core 的 SchemaDiagnostic（那個 code 欄位是 vendor package
	 * 定義的封閉 union）——這裡要同時顯示「真正的解析/驗證錯誤」跟「Lint 風格警告」
	 * （src/lib/schema/lint.ts，網頁版專屬，不在 vendor package 裡），用一個結構寬鬆的本地型別，
	 * 呼叫端各自把兩種來源轉成這個形狀。
	 */
	export interface DisplayDiagnostic {
		code: string;
		severity: 'error' | 'warning' | 'info';
		message: string;
		/** 位置描述，parse 錯誤是「行:列」，Lint 警告是「表.欄位」，格式化字串留給呼叫端決定。 */
		detail?: string;
	}

	interface Props {
		diagnostics: DisplayDiagnostic[];
		onDismiss: () => void;
		onViewSource: () => void;
	}

	let { diagnostics, onDismiss, onViewSource }: Props = $props();

	const severityColor: Record<DisplayDiagnostic['severity'], string> = {
		error: 'text-red-300',
		warning: 'text-yellow-300',
		info: 'text-cyan'
	};
</script>

{#if diagnostics.length > 0}
	<div
		class="absolute bottom-20 left-3 right-3 z-10 max-h-40 overflow-auto rounded-lg border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] p-2.5 text-xs text-fg shadow-lg"
	>
		<div class="mb-1 flex items-center gap-1.5 font-semibold">
			<AlertTriangle size={13} />
			{diagnostics.length} 個 Schema 問題
			<button
				class="ml-auto flex items-center gap-1 rounded border border-current px-1.5 py-0.5 text-[10px] font-normal text-muted hover:text-fg"
				onclick={onViewSource}
				title="檢視/複製目前的原始碼——不用下載，直接貼給 AI 改"
			>
				<Code size={11} /> 檢視程式碼
			</button>
			<button class="text-muted hover:text-fg" onclick={onDismiss}><X size={13} /></button>
		</div>
		{#each diagnostics.slice(0, 30) as diagnostic, i (i)}
			<div class="py-0.5">
				<span class={severityColor[diagnostic.severity]}>{diagnostic.code}</span>{diagnostic.detail
					? `:${diagnostic.detail}`
					: ''} — {diagnostic.message}
			</div>
		{/each}
	</div>
{/if}
