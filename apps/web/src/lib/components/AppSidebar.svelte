<script lang="ts">
	import type { Column, Schema, TableId } from '@schemalens/schema-core';
	import { signIn, signOut } from '@auth/sveltekit/client';
	import { clearDraft } from '$lib/persistence/localDraft';
	import type { Session } from '@auth/sveltekit';
	import { onMount } from 'svelte';
	import { currentLocale, pick } from '$lib/i18n/current';

	const m = $derived(
		pick({
			'zh-hant': {
				confirmDeletePage: (title: string) => `確定要刪除分頁「${title}」嗎？這個動作無法復原。`,
				collapse: '收合側欄',
				expand: '展開側欄',
				openSidebar: '開啟側欄：分頁、資料表詳情、登入',
				sidebar: '側欄',
				home: '回首頁',
				pages: '分頁',
				newPageTitle: '新增分頁（一般或即時協作）',
				newPage: '新增分頁',
				localDraft: '本機草稿',
				browserOnly: '只存在這個瀏覽器',
				saveToCloud: '存到雲端、建立更多分頁…',
				realtime: '即時協作分頁',
				rename: '重新命名',
				deletePage: '刪除分頁',
				firstPage: '新增第一個分頁',
				dockHere: '拖回這裡停靠',
				signOut: '登出',
				signIn: '使用 GitHub 登入'
			},
			en: {
				confirmDeletePage: (title: string) => `Delete the page "${title}"? This cannot be undone.`,
				collapse: 'Collapse sidebar',
				expand: 'Expand sidebar',
				openSidebar: 'Open sidebar: pages, table details, sign-in',
				sidebar: 'Sidebar',
				home: 'Back to home',
				pages: 'Pages',
				newPageTitle: 'New page (normal or live collaboration)',
				newPage: 'New page',
				localDraft: 'Local draft',
				browserOnly: 'This browser only',
				saveToCloud: 'Save to the cloud, add more pages…',
				realtime: 'Live collaboration page',
				rename: 'Rename',
				deletePage: 'Delete page',
				firstPage: 'Create your first page',
				dockHere: 'Drag back here to dock',
				signOut: 'Sign out',
				signIn: 'Sign in with GitHub'
			}
		})
	);
	const homeHref = $derived(currentLocale() === 'en' ? '/en' : '/');
	import {
		Cloud,
		FileText,
		HardDrive,
		Github,
		LogOut,
		Menu,
		PanelLeftClose,
		PanelLeftOpen,
		Pencil,
		Plus,
		Trash2
	} from '@lucide/svelte';
	import TableInspector from './TableInspector.svelte';
	import Logo from './Logo.svelte';

	export interface PageSummary {
		id: string;
		title: string;
		updatedAt: string;
		mode: 'normal' | 'realtime';
	}

	interface Props {
		schema: Schema | null;
		session: Session | null;
		pages: PageSummary[];
		activePageId: string | null;
		focusedTableId: TableId | null;
		hiddenGroups: ReadonlySet<string>;
		onSelectPage: (pageId: string) => void;
		onCreatePage: (event: MouseEvent) => void;
		/** 訪客按「存到雲端」：開說明登入好處的對話框，不是直接跳 GitHub。 */
		onSaveToCloud: () => void;
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
		onSelectPage,
		onCreatePage,
		onSaveToCloud,
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
		if (!confirm(m.confirmDeletePage(title))) return;
		onDeletePage(pageId);
	}

	function submitOnEnter(event: KeyboardEvent): void {
		if (event.key === 'Enter') (event.currentTarget as HTMLElement).blur();
	}

	let collapsed = $state(false);
	/** 手機寬度：側欄改成蓋在畫布上的抽屜，預設收起來，不然 320px 的側欄會把畫布擠到只剩一條。 */
	let isNarrow = $state(false);

	onMount(() => {
		const query = window.matchMedia('(max-width: 767px)');
		isNarrow = query.matches;
		if (isNarrow) collapsed = true;
		const handleChange = (event: MediaQueryListEvent) => {
			isNarrow = event.matches;
			if (event.matches) collapsed = true;
		};
		// 手機上展開的側欄是蓋在畫布上的抽屜，Esc 要能關掉它（跟對話框一樣）。
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !isNarrow || collapsed) return;
			// 上面還開著對話框的話，Esc 先交給對話框。
			if (document.querySelector('[aria-modal="true"]')) return;
			event.stopImmediatePropagation();
			collapsed = true;
		};
		query.addEventListener('change', handleChange);
		window.addEventListener('keydown', handleKeydown, true);
		return () => {
			query.removeEventListener('change', handleChange);
			window.removeEventListener('keydown', handleKeydown, true);
		};
	});

</script>

{#if isNarrow && !collapsed}
	<button
		class="absolute inset-0 z-40 bg-black/40"
		aria-label={m.collapse}
		tabindex="-1"
		onclick={() => (collapsed = true)}
	></button>
{/if}

{#if isNarrow && collapsed}
	<!-- 手機：不留 56px 的窄欄（佔掉 14% 寬度），改成左上角一顆選單鈕 -->
	<button
		class="sl-menu-fab"
		onclick={() => (collapsed = false)}
		aria-label={m.openSidebar}
		title={m.sidebar}
	>
		<Menu size={18} />
	</button>
{/if}

<div class="relative h-full flex-none {isNarrow ? 'w-0' : collapsed ? 'w-14' : 'w-80'}" class:hidden={isNarrow && collapsed}>
<div
	class="absolute inset-y-0 left-0 flex flex-col border-r border-border text-xs text-fg transition-[width] duration-150 {collapsed
		? 'w-14 bg-surface/60'
		: 'z-50 w-[min(20rem,calc(100vw-3rem))] bg-surface shadow-2xl md:w-80 md:bg-surface/60 md:shadow-none'}"
>
	<div class="flex items-center gap-2 border-b border-border p-3 {collapsed ? 'flex-col' : 'flex-row'}">
		<a href={homeHref} title={m.home} class="{collapsed ? 'flex-none' : 'flex-1'} min-w-0">
			{#if collapsed}
				<Logo size={30} wordmark={false} />
			{:else}
				<Logo size={30} />
			{/if}
		</a>
		<button
			class="sl-icon-btn flex-none"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? m.expand : m.collapse}
			aria-label={collapsed ? m.expand : m.collapse}
		>
			{#if collapsed}<PanelLeftOpen size={15} />{:else}<PanelLeftClose size={15} />{/if}
		</button>
	</div>

	{#if !collapsed}
		<div class="max-h-48 overflow-auto border-b border-border p-2">
			<div class="mb-1 flex items-center justify-between px-1">
				<span class="text-muted">{m.pages}</span>
				{#if session?.user}
					<button class="sl-icon-btn" onclick={onCreatePage} title={m.newPageTitle} aria-label={m.newPage}>
						<Plus size={13} />
					</button>
				{/if}
			</div>
			{#if !session?.user}
				<div class="flex items-center gap-1.5 rounded-md bg-surface-2 px-1.5 py-1.5 text-cyan">
					<HardDrive size={13} class="flex-none" />
					<span class="min-w-0 flex-1 truncate">{m.localDraft}</span>
					<span class="flex-none text-[11px] text-muted">{m.browserOnly}</span>
				</div>
				<button
					class="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-muted hover:border-cyan hover:text-cyan"
					onclick={onSaveToCloud}
				>
					<Cloud size={12} /> {m.saveToCloud}
				</button>
			{/if}
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
						<button class="flex min-w-0 flex-1 items-center gap-1 truncate text-left" onclick={() => onSelectPage(p.id)}>
							<span class="min-w-0 truncate">{p.title}</span>
							{#if p.mode === 'realtime'}
								<span class="flex-none text-[10px]" title={m.realtime}>🔗</span>
							{/if}
						</button>
						<button
							class="sl-icon-btn flex-none opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
							onclick={() => (renamingPageId = p.id)}
							title={m.rename}
							aria-label={m.rename}
						>
							<Pencil size={11} />
						</button>
						<button
							class="sl-icon-btn flex-none text-red-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
							onclick={() => handleDeletePage(p.id, p.title)}
							title={m.deletePage}
							aria-label={m.deletePage}
						>
							<Trash2 size={11} />
						</button>
					{/if}
				</div>
			{/each}
			{#if session?.user && pages.length === 0}
				<button
					class="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-muted hover:border-cyan hover:text-cyan"
					onclick={onCreatePage}
				>
					<Plus size={12} /> {m.firstPage}
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
					{m.dockHere}
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
						title={m.signOut}
						aria-label={m.signOut}
					>
						<LogOut size={14} />
					</button>
				</div>
			{:else}
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 hover:border-cyan hover:text-cyan"
					onclick={() => signIn('github')}
				>
					<Github size={14} /> {m.signIn}
				</button>
			{/if}
		</div>
	{/if}
</div>
</div>

<style>
	.sl-menu-fab {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 36;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--sl-border);
		border-radius: 9999px;
		background: var(--sl-surface);
		color: var(--sl-fg);
		box-shadow: 0 8px 20px -12px rgb(0 0 0 / 0.5);
	}
	:global(.sl-dock-zone.sl-dock-hover) {
		outline: 2px dashed var(--sl-cyan);
		outline-offset: -2px;
		background: color-mix(in oklab, var(--sl-cyan) 8%, transparent);
	}
</style>
