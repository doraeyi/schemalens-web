<script lang="ts">
	import type { Column, Schema, TableId } from '@schemalens/schema-core';
	import { groupColor } from '@schemalens/schema-renderer';
	import { relationsTouching } from '$lib/schema/mutations';
	import ConfirmDeleteDialog from './ConfirmDeleteDialog.svelte';
	import { ArrowRight, Copy, EyeOff, Eye, Key, Plus, Trash2, X } from '@lucide/svelte';

	interface Props {
		schema: Schema;
		tableId: TableId;
		hiddenGroups: ReadonlySet<string>;
		docked?: boolean;
		dockZoneEl: HTMLElement | null;
		sidebarCollapsed: boolean;
		onNearDockZone?: () => void;
		onClose: () => void;
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
		tableId,
		hiddenGroups,
		docked = $bindable(true),
		dockZoneEl,
		sidebarCollapsed,
		onNearDockZone,
		onClose,
		onFocusTable,
		onToggleGroup,
		onDuplicateTable,
		onDeleteTable,
		onRenameTable,
		onAddColumn,
		onUpdateColumn,
		onDeleteColumn
	}: Props = $props();

	// 側欄收合時沒有空間可以停靠，強制用浮動樣式顯示，不管 docked 本身是什麼。
	const effectiveDocked = $derived(docked && !sidebarCollapsed);
	const DOCK_MARGIN = 24;

	function isNearDockZone(clientX: number, clientY: number): boolean {
		const rect = dockZoneEl?.getBoundingClientRect();
		if (!rect) return false;
		return (
			clientX >= rect.left - DOCK_MARGIN &&
			clientX <= rect.right + DOCK_MARGIN &&
			clientY >= rect.top - DOCK_MARGIN &&
			clientY <= rect.bottom + DOCK_MARGIN
		);
	}

	const table = $derived(schema.tables.find((t) => t.id === tableId));
	const relations = $derived(
		schema.relations
			.filter((r) => r.sourceTable === tableId || r.targetTable === tableId)
			.map((r) => {
				const isSource = r.sourceTable === tableId;
				return {
					relation: r,
					otherTable: isSource ? r.targetTable : r.sourceTable,
					localColumns: isSource ? r.sourceColumns : r.targetColumns
				};
			})
	);

	function commitName(event: Event): void {
		if (!table) return;
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		if (value) onRenameTable(table.id, value);
	}

	function commitColumnField(event: Event, columnName: string, field: 'name' | 'type'): void {
		if (!table) return;
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		if (!value) return;
		onUpdateColumn(table.id, columnName, { [field]: value });
	}

	function submitOnEnter(event: KeyboardEvent): void {
		if (event.key === 'Enter') (event.currentTarget as HTMLElement).blur();
	}

	let pendingDelete = $state<{ kind: 'table' } | { kind: 'column'; columnName: string } | null>(null);

	function handleDeleteTableClick(): void {
		pendingDelete = { kind: 'table' };
	}

	function requestDeleteColumn(columnName: string): void {
		pendingDelete = { kind: 'column', columnName };
	}

	function confirmPendingDelete(): void {
		if (!table || !pendingDelete) return;
		if (pendingDelete.kind === 'table') onDeleteTable(table.id);
		else onDeleteColumn(table.id, pendingDelete.columnName);
		pendingDelete = null;
	}

	function cancelPendingDelete(): void {
		pendingDelete = null;
	}

	const COLUMN_TYPES = [
		'bigint',
		'integer',
		'smallint',
		'varchar',
		'nvarchar',
		'text',
		'char',
		'boolean',
		'date',
		'datetime',
		'timestamp',
		'decimal',
		'float',
		'uuid',
		'json'
	];

	// ------------------------------------------------------------ 拖動 / 停靠面板
	// 面板只在「從關閉變成開啟」時才是全新的元件實例（外層 {#if focusedTableId} 只有
	// null → id 這個轉折才會真的重新掛載），所以 docked/座標用元件內的 $state 初始化
	// 即可自然做到「重新開啟回到預設的 docked 狀態、面板內切換表格不重置」，
	// 不需要額外的重置邏輯。
	let panelEl: HTMLDivElement | undefined = $state();
	let dragging = $state(false);
	let dragged = false;
	let posX = $state(0);
	let posY = $state(0);
	let hasCustomPosition = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragOriginLeft = 0;
	let dragOriginTop = 0;

	// 側欄收合會強制變浮動，但這不是使用者拖出來的——如果從沒真的拖過（posX/posY 還是
	// 初始值），用左上角 (0,0) 會直接疊到側欄收合鈕上面。這裡補一個沒拖過時的合理預設位置。
	$effect(() => {
		if (!effectiveDocked && !hasCustomPosition) {
			posX = Math.max(16, window.innerWidth - 336);
			posY = 16;
		}
	});

	function handleHeaderPointerDown(event: PointerEvent): void {
		if (event.button !== 0) return;
		if ((event.target as HTMLElement).closest('button, input')) return;
		const rect = panelEl?.getBoundingClientRect();
		if (!rect) return;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragOriginLeft = rect.left;
		dragOriginTop = rect.top;
		dragging = true;
		dragged = false;
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (!dragging) return;
		const dx = event.clientX - dragStartX;
		const dy = event.clientY - dragStartY;
		if (!dragged && Math.hypot(dx, dy) < 4) return;
		dragged = true;

		if (effectiveDocked) {
			// 還沒拖出停靠區之前面板留在原地不動；一旦指標離開停靠區才「彈出」變浮動，
			// 從離開的那一刻用目前指標對應的連續座標，視覺上不會跳一下。
			if (isNearDockZone(event.clientX, event.clientY)) return;
			posX = dragOriginLeft + dx;
			posY = dragOriginTop + dy;
			hasCustomPosition = true;
			docked = false;
			return;
		}

		posX = dragOriginLeft + dx;
		posY = dragOriginTop + dy;
		hasCustomPosition = true;
		const near = isNearDockZone(event.clientX, event.clientY);
		dockZoneEl?.classList.toggle('sl-dock-hover', near);
		// 側欄收合時拖過來也算「靠近」，讓 AppSidebar 自動展開，這樣才有地方真的停靠進去。
		if (near && sidebarCollapsed) onNearDockZone?.();
	}

	function handleWindowPointerUp(event: PointerEvent): void {
		if (dragging && dragged && !effectiveDocked && isNearDockZone(event.clientX, event.clientY)) {
			docked = true;
		}
		dockZoneEl?.classList.remove('sl-dock-hover');
		dragging = false;
	}
</script>

<svelte:window onpointermove={handleWindowPointerMove} onpointerup={handleWindowPointerUp} />

{#if table}
	<div
		bind:this={panelEl}
		class={effectiveDocked
			? 'flex w-full flex-1 min-h-0 flex-col overflow-hidden border-t border-border bg-surface text-xs text-fg'
			: 'fixed z-30 flex max-h-[calc(100vh-2rem)] w-80 flex-col overflow-hidden rounded-xl border border-border bg-surface text-xs text-fg shadow-2xl shadow-black/40'}
		style:top={effectiveDocked ? undefined : `${posY}px`}
		style:left={effectiveDocked ? undefined : `${posX}px`}
	>
		<div
			role="presentation"
			class="flex flex-none cursor-grab items-start justify-between border-b border-border p-3 active:cursor-grabbing"
			onpointerdown={handleHeaderPointerDown}
		>
			<div class="min-w-0 flex-1">
				{#if table.group}
					<div class="mb-1 flex items-center gap-1.5 text-muted">
						<span class="h-2 w-2 flex-none rounded-full" style:background={groupColor(table.group)}></span>
						<span class="truncate">{table.group}</span>
						<button
							class="sl-icon-btn flex-none"
							onclick={() => table && onToggleGroup(table.group as string)}
							title={table.group && hiddenGroups.has(table.group) ? '顯示此主題區域' : '隱藏此主題區域'}
							aria-label="切換主題區域顯示"
						>
							{#if table.group && hiddenGroups.has(table.group)}<EyeOff size={12} />{:else}<Eye size={12} />{/if}
						</button>
					</div>
				{/if}
				<input
					value={table.name}
					onblur={commitName}
					onkeydown={submitOnEnter}
					class="w-full rounded border border-transparent bg-transparent px-1 -mx-1 text-sm font-bold text-fg hover:border-border focus:border-cyan focus:bg-bg/60 focus:outline-none"
				/>
				<div class="mt-1 text-muted">Schema: {table.schema}</div>
			</div>
			<div class="flex flex-none items-center gap-0.5">
				<button class="sl-icon-btn" onclick={() => onDuplicateTable(table.id)} title="建立副本" aria-label="建立副本">
					<Copy size={13} />
				</button>
				<button
					class="sl-icon-btn text-red-400 hover:text-red-300"
					onclick={handleDeleteTableClick}
					title="刪除資料表"
					aria-label="刪除資料表"
				>
					<Trash2 size={13} />
				</button>
				<button class="sl-icon-btn" onclick={onClose} title="關閉" aria-label="關閉"><X size={14} /></button>
			</div>
		</div>

		<div class="flex-1 overflow-auto">
			{#if table.comment}
				<div class="border-b border-border p-3 text-muted">{table.comment}</div>
			{/if}

			<div class="p-3">
				<div class="mb-2 font-semibold">欄位</div>
				<div class="flex flex-col gap-1.5">
					{#each table.columns as column (column.name)}
						<div class="flex items-center gap-1">
							<button
								class="sl-icon-btn flex-none {column.primaryKey ? 'text-yellow-400' : 'text-muted'}"
								onclick={() => onUpdateColumn(table.id, column.name, { primaryKey: !column.primaryKey })}
								title="主鍵"
								aria-label="切換主鍵"
							>
								<Key size={12} />
							</button>
							<input
								value={column.name}
								onblur={(e) => commitColumnField(e, column.name, 'name')}
								onkeydown={submitOnEnter}
								class="w-0 min-w-0 flex-1 rounded border border-border bg-bg/60 px-1.5 py-1 font-mono focus:border-cyan focus:outline-none"
							/>
							<input
								value={column.type}
								list="sl-inspector-column-types"
								onblur={(e) => commitColumnField(e, column.name, 'type')}
								onkeydown={submitOnEnter}
								class="w-20 flex-none rounded border border-border bg-bg/60 px-1.5 py-1 font-mono focus:border-cyan focus:outline-none"
							/>
							<button
								class="sl-icon-btn flex-none {column.nullable ? 'text-cyan' : 'text-muted'}"
								onclick={() => onUpdateColumn(table.id, column.name, { nullable: !column.nullable })}
								title="允許 NULL"
								aria-label="切換允許 NULL"
							>
								?
							</button>
							<button
								class="sl-icon-btn flex-none text-red-400 hover:text-red-300"
								onclick={() => requestDeleteColumn(column.name)}
								title="刪除欄位"
								aria-label="刪除欄位"
							>
								<Trash2 size={12} />
							</button>
						</div>
					{/each}
				</div>
				<button
					class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1 text-muted hover:border-cyan hover:text-cyan"
					onclick={() => onAddColumn(table.id)}
				>
					<Plus size={12} /> 新增屬性
				</button>
			</div>

			<div class="border-t border-border p-3">
				<div class="mb-2 font-semibold">關聯 ({relations.length})</div>
				<div class="flex flex-col gap-1.5">
					{#each relations as item (item.relation.name)}
						<button
							class="w-full rounded-md border border-border px-2.5 py-2 text-left hover:border-cyan hover:text-cyan"
							onclick={() => onFocusTable(item.otherTable)}
						>
							<div class="flex items-center gap-1.5 font-mono">
								<ArrowRight size={12} class="flex-none" />
								{item.otherTable}
							</div>
							<div class="mt-0.5 pl-[18px] text-muted">{item.localColumns.join(', ')}</div>
						</button>
					{/each}
					{#if relations.length === 0}
						<div class="text-muted">沒有關聯</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

{#if table && pendingDelete}
	<ConfirmDeleteDialog
		title={pendingDelete.kind === 'table'
			? `確定要刪除資料表「${table.name}」嗎？`
			: `確定要刪除欄位「${pendingDelete.columnName}」嗎？`}
		relations={pendingDelete.kind === 'table'
			? relationsTouching(schema, table.id)
			: relationsTouching(schema, table.id, pendingDelete.columnName)}
		onConfirm={confirmPendingDelete}
		onCancel={cancelPendingDelete}
	/>
{/if}

<datalist id="sl-inspector-column-types">
	{#each COLUMN_TYPES as type (type)}
		<option value={type}></option>
	{/each}
</datalist>

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
</style>
