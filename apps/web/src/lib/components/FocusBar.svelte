<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { TraversalDirection } from '@schemalens/schema-graph';
	import { stringsFor, type UnrelatedMode } from '@schemalens/schema-renderer';
	import { currentLocale, pick } from '$lib/i18n/current';

	/**
	 * 聚焦某張表之後才出現的設定（深度／方向／不相關），浮在畫布上方。
	 * 之前是塞進頂部工具列，一聚焦工具列就從一行變兩行，整個畫布往下跳；浮著就不會推動版面。
	 * VS Code 插件用同一個做法（apps/vscode-extension/src/webview/toolbar.ts 的 .dbs-focus-cluster）。
	 */
	const t = $derived(stringsFor(currentLocale()));
	const m = $derived(pick({ 'zh-hant': { bar: '聚焦設定', reset: '取消聚焦（Esc）' }, en: { bar: 'Focus settings', reset: 'Clear focus (Esc)' } }));

	interface Props {
		tableName: string;
		depth: number | null;
		direction: TraversalDirection;
		unrelated: UnrelatedMode;
		onDepth: (depth: number | null) => void;
		onDirection: (direction: TraversalDirection) => void;
		onUnrelated: (mode: UnrelatedMode) => void;
		onReset: () => void;
	}

	let { tableName, depth, direction, unrelated, onDepth, onDirection, onUnrelated, onReset }: Props = $props();

	const groups = $derived([
		{
			label: t.depthGroup,
			value: depth as string | number | null,
			pick: onDepth as (v: never) => void,
			options: [
				{ label: t.depthLevels(1), value: 1 },
				{ label: t.depthLevels(2), value: 2 },
				{ label: t.depthAll, value: null }
			]
		},
		{
			label: t.directionGroup,
			value: direction,
			pick: onDirection as (v: never) => void,
			options: [
				{ label: t.directionAll, value: 'all', hint: t.directionAllHint },
				{ label: t.directionUpstream, value: 'upstream', hint: t.directionUpstreamHint },
				{ label: t.directionDownstream, value: 'downstream', hint: t.directionDownstreamHint }
			]
		},
		{
			label: t.unrelatedGroup,
			value: unrelated,
			pick: onUnrelated as (v: never) => void,
			options: [
				{ label: t.unrelatedDim, value: 'dim' },
				{ label: t.unrelatedHide, value: 'hide' }
			]
		}
	]);
</script>

<div class="sl-focus-bar" role="toolbar" aria-label="{m.bar}: {tableName}">
	<span class="sl-focus-name" title={tableName}><span class="sl-focus-dot" aria-hidden="true"></span>{tableName}</span>
	{#each groups as group (group.label)}
		<div class="flex flex-none items-center gap-1" role="group" aria-label={group.label}>
			<span class="mr-0.5 text-muted">{group.label}</span>
			{#each group.options as option (String(option.value))}
				<button
					class="sl-chip"
					aria-pressed={option.value === group.value}
					title={'hint' in option ? option.hint : undefined}
					onclick={() => group.pick(option.value as never)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/each}
	<button class="sl-button sl-button-secondary sl-button-sm" onclick={onReset} title={m.reset}>
		<X size={13} />{t.resetFocus}
	</button>
</div>

<style>
	.sl-focus-bar {
		position: absolute;
		top: 12px;
		left: 50%;
		z-index: 25;
		display: flex;
		max-width: calc(100% - 24px);
		transform: translateX(-50%);
		align-items: center;
		gap: 12px;
		overflow-x: auto;
		border: 1px solid color-mix(in oklab, var(--sl-cyan) 35%, var(--sl-border));
		border-radius: 9999px;
		background: color-mix(in oklab, var(--sl-surface) 94%, transparent);
		padding: 5px 6px 5px 14px;
		font-size: 12px;
		white-space: nowrap;
		scrollbar-width: none;
		box-shadow: 0 14px 30px -18px rgb(0 0 0 / 0.55);
		backdrop-filter: blur(10px);
		animation: sl-focus-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes sl-focus-in {
		from {
			opacity: 0;
			transform: translate(-50%, -6px);
		}
	}
	.sl-focus-name {
		display: inline-flex;
		max-width: 12rem;
		flex: none;
		align-items: center;
		gap: 7px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 600;
	}
	.sl-focus-dot {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 9999px;
		background: var(--sl-cyan);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--sl-cyan) 25%, transparent);
	}
</style>
