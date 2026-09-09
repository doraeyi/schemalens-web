<script lang="ts">
	import type { Column, Schema, TableId } from '@schemalens/schema-core';
	import { search, type SearchHit } from '@schemalens/schema-graph';
	import { signIn, signOut } from '@auth/sveltekit/client';
	import { clearDraft } from '$lib/persistence/localDraft';
	import type { Session } from '@auth/sveltekit';
	import {
		Database,
		FileText,
		Github,
		LogOut,
		PanelLeftClose,
		PanelLeftOpen,
		Pencil,
		Plus,
		Search as SearchIcon,
		Trash2
	} from '@lucide/svelte';
	import TableInspector from './TableInspector.svelte';

	export interface PageSummary {
		id: string;
		title: string;
		updatedAt: string;
	}

	interface Props {
		schema: Schema | null;
		session: Session | null;
		pages: PageSummary[];
		activePageId: string | null;
		focusedTableId: TableId | null;
		hiddenGroups: ReadonlySet<string>;
		onPickHit: (hit: SearchHit) => void;
		onSearchResults: (hits: SearchHit[]) => void;
		onSelectPage: (pageId: string) => void;
		onCreatePage: () => void;
		onRenamePage: (pageId: string, title: string) => void;
		onDeletePage: (pageId: string) => void;
		onCloseInspector: () => void;
		onFocusTable: (tableId: TableId) => void;
		onToggleGroup: (name: string) => void;
		onDuplicateTable: (tableId: TableId) => void;
		onDeleteTable: (tableId: TableId) => void;
		onRenameTable: (tableId: TableId, name: string) => void;
		onAddColumn: (tableId: TableId) => void;
		onUpdateColumn: (tableId: TableId, columnName: string, patch: Partial<Column>) => void;
		onDeleteColumn: (tableId: TableId, columnName: string) => void;
	}

	let {
		schema,
		session,
		pages,
		activePageId,
		focusedTableId,
		hiddenGroups,
		onPickHit,
		onSearchResults,
		onSelectPage,
		onCreatePage,
		onRenamePage,
		onDeletePage,
		onCloseInspector,
		onFocusTable,
		onToggleGroup,
		onDuplicateTable,
		onDeleteTable,
		onRenameTable,
		onAddColumn,
		onUpdateColumn,
		onDeleteColumn
	}: Props = $props();

	let panelDocked = $state(true);
	let dockZoneEl: HTMLDivElement | undefined = $state();

	let renamingPageId = $state<string | null>(null);

	function focusOnMount(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}

	function commitPageName(event: Event, pageId: string): void {
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		renamingPageId = null;
		if (value) onRenamePage(pageId, value);
	}

	function handleDeletePage(pageId: string, title: string): void {
		if (!confirm(`確定要刪除分頁「${title}」嗎？這個動作無法復原。`)) return;
		onDeletePage(pageId);
	}

	function submitOnEnter(event: KeyboardEvent): void {
		if (event.key === 'Enter') (event.currentTarget as HTMLElement).blur();
	}

	let collapsed = $state(false);

	let query = $state('');
	let hits = $state<SearchHit[]>([]);
	let cursor = $state(-1);
	let resultsOpen = $state(false);
	let searchInput: HTMLInputElement | undefined = $state();
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	export function focusSearch(): void {
		collapsed = false;
		searchInput?.focus();
		searchInput?.select();
	}

	function runSearch(value: string): void {
		if (!schema || !value.trim()) {
			hits = [];
			cursor = -1;
			resultsOpen = false;
			onSearchResults([]);
			return;
		}
		hits = search(schema, value, 60);
		cursor = hits.length ? 0 : -1;
		resultsOpen = hits.length > 0;
		onSearchResults(hits);
	}

	function handleInput(): void {
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(() => runSearch(query), 80);
	}

	function handleSearchKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (hits.length === 0) return;
			cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
		} else if (event.key === 'Enter') {
			const hit = hits[cursor >= 0 ? cursor : 0];
			if (hit) pick(hit);
		} else if (event.key === 'Escape') {
			resultsOpen = false;
		}
	}

	function pick(hit: SearchHit): void {
		resultsOpen = false;
		onPickHit(hit);
	}
</script>

<div
	class="flex h-full flex-none flex-col border-r border-border bg-surface/60 text-xs text-fg transition-[width] duration-150 {collapsed
		? 'w-14'
		: 'w-80'}"
>
	<div class="flex items-center gap-2 border-b border-border p-3 {collapsed ? 'flex-col' : 'flex-row'}">
		<div class="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-cyan text-bg">
			<Database size={15} />
		</div>
		{#if !collapsed}
			<span class="flex-1 truncate font-bold">SchemaLens</span>
		{/if}
		<button
			class="sl-icon-btn flex-none"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? '展開側欄' : '收合側欄'}
			aria-label={collapsed ? '展開側欄' : '收合側欄'}
		>
			{#if collapsed}<PanelLeftOpen size={15} />{:else}<PanelLeftClose size={15} />{/if}
		</button>
	</div>

	{#if !collapsed}
		<div class="relative border-b border-border p-2">
			<div class="flex items-center gap-1.5 rounded-md border border-border bg-bg/60 px-2 py-1.5">
				<SearchIcon size={13} class="text-muted" />
				<input
					bind:this={searchInput}
					bind:value={query}
					oninput={handleInput}
					onkeydown={handleSearchKeydown}
					type="search"
					placeholder="表名 / 關鍵字…"
					class="w-full bg-transparent text-xs text-fg placeholder:text-muted focus:outline-none"
				/>
			</div>
			{#if resultsOpen}
				<div
					class="absolute top-full left-2 right-2 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface shadow-xl shadow-black/40"
				>
					{#each hits as hit, i (hit.kind + hit.tableId + ('column' in hit ? hit.column : ''))}
						<button
							class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-surface-2 {i === cursor ? 'bg-surface-2' : ''}"
							onmousedown={(e) => {
								e.preventDefault();
								pick(hit);
							}}
						>
							<span class="font-mono">{hit.label}</span>
							<span class="ml-auto text-[10px] text-muted">{hit.kind === 'column' ? hit.tableId : hit.matchedOn}</span>
						</button>
					{/each}
					{#if hits.length === 0}
						<div class="px-3 py-2 text-muted">沒有符合的結果</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if !collapsed}
		<div class="max-h-48 overflow-auto border-b border-border p-2">
			<div class="mb-1 flex items-center justify-between px-1">
				<span class="text-muted">分頁</span>
				<button class="sl-icon-btn" onclick={onCreatePage} title="新增分頁" aria-label="新增分頁">
					<Plus size={13} />
				</button>
			</div>
			{#each pages as p (p.id)}
				<div
					class="group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 {activePageId === p.id
						? 'bg-surface-2 text-cyan'
						: 'hover:bg-surface-2'}"
				>
					<FileText size={13} class="flex-none" />
					{#if renamingPageId === p.id}
						<input
							value={p.title}
							use:focusOnMount
							onblur={(e) => commitPageName(e, p.id)}
							onkeydown={submitOnEnter}
							class="w-0 min-w-0 flex-1 rounded border border-border bg-surface px-1 text-fg focus:border-cyan focus:outline-none"
						/>
					{:else}
						<button class="min-w-0 flex-1 truncate text-left" onclick={() => onSelectPage(p.id)}>
							{p.title}
						</button>
						<button
							class="sl-icon-btn flex-none opacity-0 group-hover:opacity-100"
							onclick={() => (renamingPageId = p.id)}
							title="重新命名"
							aria-label="重新命名"
						>
							<Pencil size={11} />
						</button>
						<button
							class="sl-icon-btn flex-none text-red-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
							onclick={() => handleDeletePage(p.id, p.title)}
							title="刪除分頁"
							aria-label="刪除分頁"
						>
							<Trash2 size={11} />
						</button>
					{/if}
				</div>
			{/each}
			{#if pages.length === 0}
				<button
					class="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-muted hover:border-cyan hover:text-cyan"
					onclick={onCreatePage}
				>
					<Plus size={12} /> 新增第一個分頁
				</button>
			{/if}
		</div>
	{/if}

	<div bind:this={dockZoneEl} class="sl-dock-zone flex flex-1 min-h-0 flex-col">
		{#if focusedTableId && schema}
			<TableInspector
				{schema}
				tableId={focusedTableId}
				{hiddenGroups}
				bind:docked={panelDocked}
				{dockZoneEl}
				sidebarCollapsed={collapsed}
				onNearDockZone={() => (collapsed = false)}
				onClose={onCloseInspector}
				{onFocusTable}
				{onToggleGroup}
				{onDuplicateTable}
				{onDeleteTable}
				{onRenameTable}
				{onAddColumn}
				{onUpdateColumn}
				{onDeleteColumn}
			/>
			{#if !collapsed && !panelDocked}
				<div class="m-2 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-center text-muted">
					拖回這裡停靠
				</div>
			{/if}
		{/if}
	</div>

	{#if !collapsed}
		<div class="border-t border-border p-3">
			{#if session?.user}
				<div class="flex items-center gap-2">
					{#if session.user.image}
						<img src={session.user.image} alt="" class="h-7 w-7 flex-none rounded-full" />
					{/if}
					<span class="min-w-0 flex-1 truncate font-semibold">{session.user.name ?? session.user.email}</span>
					<button
						class="sl-icon-btn flex-none"
						onclick={() => {
							clearDraft();
							signOut();
						}}
						title="登出"
						aria-label="登出"
					>
						<LogOut size={14} />
					</button>
				</div>
			{:else}
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 hover:border-cyan hover:text-cyan"
					onclick={() => signIn('github')}
				>
					<Github size={14} /> 使用 GitHub 登入
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(.sl-icon-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 11px;
		font-weight: 700;
	}
	:global(.sl-icon-btn:hover) {
		background: color-mix(in oklab, var(--sl-cyan) 14%, transparent);
	}
	:global(.sl-dock-zone.sl-dock-hover) {
		outline: 2px dashed var(--sl-cyan);
		outline-offset: -2px;
		background: color-mix(in oklab, var(--sl-cyan) 8%, transparent);
	}
</style>
