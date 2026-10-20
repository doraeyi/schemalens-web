<script lang="ts">
	import { ChevronDown, CircleAlert, Code, Lightbulb, TriangleAlert, X } from '@lucide/svelte';
	import { pick } from '$lib/i18n/current';

	const m = $derived(
		pick({
			'zh-hant': {
				errors: (n: number) => `${n} 個錯誤`,
				warnings: (n: number) => `${n} 個警告`,
				advisories: (n: number) => `${n} 個建議`,
				viewSourceTitle: '檢視/複製目前的原始碼——不用下載，直接貼給 AI 改',
				viewSource: '檢視程式碼',
				dismiss: '關閉問題清單'
			},
			en: {
				errors: (n: number) => `${n} error${n === 1 ? '' : 's'}`,
				warnings: (n: number) => `${n} warning${n === 1 ? '' : 's'}`,
				advisories: (n: number) => `${n} hint${n === 1 ? '' : 's'}`,
				viewSourceTitle: 'View or copy the current source — no download, paste it straight into an AI',
				viewSource: 'View source',
				dismiss: 'Close the problem list'
			}
		})
	);

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
		/** Lint 建議（例如外鍵沒建 index）——不影響圖表，預設收合，不跟真正的錯誤搶畫面。 */
		advisory?: boolean;
	}

	interface Props {
		diagnostics: DisplayDiagnostic[];
		onDismiss: () => void;
		onViewSource: () => void;
	}

	let { diagnostics, onDismiss, onViewSource }: Props = $props();

	const problems = $derived(diagnostics.filter((d) => !d.advisory));
	const advisories = $derived(diagnostics.filter((d) => d.advisory));
	const errorCount = $derived(problems.filter((d) => d.severity === 'error').length);
	const tone = $derived<'error' | 'warning' | 'advisory'>(
		errorCount > 0 ? 'error' : problems.length > 0 ? 'warning' : 'advisory'
	);

	/** 只有建議時預設收成一顆 chip；有錯誤或警告時預設展開，因為那會影響圖表正不正確。 */
	let expanded = $state(false);
	let lastProblemCount = 0;
	$effect(() => {
		if (problems.length > lastProblemCount) expanded = true;
		lastProblemCount = problems.length;
	});

	const summary = $derived.by(() => {
		const parts: string[] = [];
		if (errorCount > 0) parts.push(m.errors(errorCount));
		const warnings = problems.length - errorCount;
		if (warnings > 0) parts.push(m.warnings(warnings));
		if (advisories.length > 0) parts.push(m.advisories(advisories.length));
		return parts.join(' · ');
	});

	const visible = $derived([...problems, ...advisories].slice(0, 30));
</script>

{#if diagnostics.length > 0}
	<div class="sl-diag sl-diag-{tone} {expanded ? 'is-expanded' : ''}" role="status" aria-live="polite">
		<div class="flex items-center gap-1.5">
			<button
				class="sl-diag-toggle"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				aria-controls="sl-diag-list"
			>
				{#if tone === 'error'}
					<CircleAlert size={14} />
				{:else if tone === 'warning'}
					<TriangleAlert size={14} />
				{:else}
					<Lightbulb size={14} />
				{/if}
				<span>{summary}</span>
				<ChevronDown size={13} class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</button>
			{#if expanded}
				<button class="sl-diag-action ml-auto" onclick={onViewSource} title={m.viewSourceTitle}>
					<Code size={12} /> {m.viewSource}
				</button>
				<button class="sl-diag-action" onclick={onDismiss} aria-label={m.dismiss} title={m.dismiss}>
					<X size={13} />
				</button>
			{/if}
		</div>
		{#if expanded}
			<ul id="sl-diag-list" class="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
				{#each visible as diagnostic, i (i)}
					<li class="flex gap-2 leading-relaxed">
						<span class="sl-diag-dot sl-diag-dot-{diagnostic.advisory ? 'advisory' : diagnostic.severity}" aria-hidden="true"></span>
						<span class="min-w-0">
							<span class="text-fg">{diagnostic.message}</span>
							<span class="sl-diag-code">{diagnostic.detail ? `${diagnostic.detail} · ` : ''}{diagnostic.code}</span>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	/* 三種語氣各自一組 token：錯誤用紅、警告用琥珀、Lint 建議用中性底加主色。
	   之前三種全部共用 inputValidation 的紅底，連「外鍵沒建 index」這種建議都像整份壞掉。 */
	.sl-diag {
		--diag-accent: var(--sl-cyan);
		--diag-fg: var(--sl-fg);
		position: absolute;
		bottom: 76px;
		left: 12px;
		z-index: 10;
		max-width: min(640px, calc(100% - 24px));
		border: 1px solid color-mix(in oklab, var(--diag-accent) 45%, var(--sl-border));
		border-radius: 10px;
		background: color-mix(in oklab, var(--diag-accent) 7%, var(--sl-surface));
		padding: 6px 8px;
		font-size: 12px;
		color: var(--sl-fg);
		box-shadow: 0 6px 20px -8px rgb(0 0 0 / 0.35);
	}
	.sl-diag.is-expanded {
		right: 12px;
		padding: 8px 10px;
	}
	.sl-diag-error {
		--diag-accent: var(--sl-danger);
	}
	.sl-diag-warning {
		--diag-accent: var(--sl-warning);
	}
	.sl-diag-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 28px;
		border-radius: 6px;
		padding: 0 4px;
		font-weight: 600;
		color: var(--diag-accent);
	}
	.sl-diag-advisory .sl-diag-toggle {
		color: var(--sl-fg);
	}
	.sl-diag-toggle:hover {
		background: color-mix(in oklab, var(--diag-accent) 12%, transparent);
	}
	.sl-diag-action {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 28px;
		border-radius: 6px;
		padding: 0 8px;
		color: var(--sl-muted);
	}
	.sl-diag-action:hover {
		color: var(--sl-fg);
		background: color-mix(in oklab, var(--sl-fg) 8%, transparent);
	}
	/* 白話說明在前，機器代碼縮小放後面（方便搜尋、回報），不再是第一眼看到的東西。 */
	.sl-diag-code {
		margin-left: 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--sl-muted);
	}
	.sl-diag-dot {
		flex: none;
		width: 7px;
		height: 7px;
		margin-top: 7px;
		border-radius: 9999px;
		background: var(--sl-muted);
	}
	.sl-diag-dot-error {
		background: var(--sl-danger);
	}
	.sl-diag-dot-warning {
		background: var(--sl-warning);
	}
	.sl-diag-dot-info,
	.sl-diag-dot-advisory {
		background: var(--sl-cyan);
	}
</style>
