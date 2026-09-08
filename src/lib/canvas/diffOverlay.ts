import type { SchemaDiff } from '$lib/schema/diff';

/**
 * 渲染完 buildMergedSchema() 產生的合成 schema 之後，直接對已經畫出來的 .dbs-card/.dbs-row
 * DOM 節點加樣式——跟 compactOverlay.ts 的 syncCompactOverlay() 是同一種做法，不用改 renderer。
 */
export function applyDiffOverlay(canvasHost: HTMLElement, diff: SchemaDiff): void {
	const addedTableIds = new Set(diff.addedTables.map((t) => t.id));
	const removedTableIds = new Set(diff.removedTables.map((t) => t.id));
	const changedByTable = new Map(diff.changedTables.map((t) => [t.tableId, t]));

	for (const card of canvasHost.querySelectorAll<HTMLElement>('.dbs-card')) {
		const tableId = card.dataset.tableId;
		if (!tableId) continue;

		if (addedTableIds.has(tableId)) {
			card.classList.add('sl-diff-added');
		} else if (removedTableIds.has(tableId)) {
			card.classList.add('sl-diff-removed');
		} else {
			const tableDiff = changedByTable.get(tableId);
			if (tableDiff) {
				card.classList.add('sl-diff-changed');
				const addedCols = new Set(tableDiff.addedColumns.map((c) => c.name));
				const removedCols = new Set(tableDiff.removedColumns.map((c) => c.name));
				const changedCols = new Set(tableDiff.changedColumns.map((c) => c.name));
				for (const row of card.querySelectorAll<HTMLElement>('.dbs-row')) {
					const column = row.dataset.column;
					if (!column) continue;
					if (addedCols.has(column)) row.classList.add('sl-diff-added');
					else if (removedCols.has(column)) row.classList.add('sl-diff-removed');
					else if (changedCols.has(column)) row.classList.add('sl-diff-changed');
				}
			}
		}
	}
}

export function clearDiffOverlay(canvasHost: HTMLElement): void {
	for (const el of canvasHost.querySelectorAll('.sl-diff-added, .sl-diff-removed, .sl-diff-changed')) {
		el.classList.remove('sl-diff-added', 'sl-diff-removed', 'sl-diff-changed');
	}
}
