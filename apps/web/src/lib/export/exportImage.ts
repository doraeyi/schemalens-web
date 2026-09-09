import { toBlob, toSvg } from 'html-to-image';
import { toDsl } from '@schemalens/schema-serializer';
import type { Schema, TableId } from '@schemalens/schema-core';

/**
 * Restricts an export to a subset of tables: hides every `.dbs-card` not in
 * `tableIds`, and every `.dbs-edge` whose relation doesn't connect two tables
 * that are both in the set. The exported image keeps the full canvas
 * dimensions — cards outside the selection just leave blank space rather
 * than the image being cropped to the selection's bounding box.
 */
export interface SelectionFilter {
	schema: Schema;
	tableIds: ReadonlySet<TableId>;
}

function buildSelectionFilter({ schema, tableIds }: SelectionFilter): (node: HTMLElement) => boolean {
	const relationByName = new Map(schema.relations.map((relation) => [relation.name, relation] as const));
	return (node: HTMLElement): boolean => {
		const classList = (node as unknown as Element).classList as DOMTokenList | undefined;
		if (!classList) return true;
		if (classList.contains('dbs-card')) {
			const id = node.dataset?.tableId;
			return !!id && tableIds.has(id);
		}
		if (classList.contains('dbs-edge')) {
			const relation = relationByName.get(node.dataset?.relation ?? '');
			if (!relation) return true;
			return tableIds.has(relation.sourceTable) && tableIds.has(relation.targetTable);
		}
		return true;
	};
}

/**
 * Copies the diagram host element as a PNG image to the clipboard.
 * Widely supported: every major browser accepts `image/png` via the Clipboard API.
 * Pass `selection` to only include a subset of tables (and the relations between them).
 */
export async function copyDiagramAsPng(node: HTMLElement, selection?: SelectionFilter): Promise<void> {
	const filter = selection ? buildSelectionFilter(selection) : undefined;
	const blob = await toBlob(node, { pixelRatio: 2, filter });
	if (!blob) throw new Error('Failed to render diagram to PNG');
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

export type SvgCopyResult = 'image' | 'text';

/**
 * Copies the diagram as SVG. Most browsers don't yet accept `image/svg+xml`
 * as a Clipboard API payload, so this falls back to copying the raw SVG
 * markup as text — the caller should tell the user which one happened.
 * Pass `selection` to only include a subset of tables (and the relations between them).
 */
export async function copyDiagramAsSvg(node: HTMLElement, selection?: SelectionFilter): Promise<SvgCopyResult> {
	const filter = selection ? buildSelectionFilter(selection) : undefined;
	const dataUrl = await toSvg(node, { filter });
	const svgMarkup = await (await fetch(dataUrl)).text();

	const canTryImage =
		typeof ClipboardItem !== 'undefined' &&
		(!('supports' in ClipboardItem) || ClipboardItem.supports('image/svg+xml'));

	if (canTryImage) {
		try {
			const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml' });
			await navigator.clipboard.write([new ClipboardItem({ 'image/svg+xml': svgBlob })]);
			return 'image';
		} catch {
			// fall through to text copy
		}
	}

	await navigator.clipboard.writeText(svgMarkup);
	return 'text';
}

/** Copies the whole schema, serialized back to DSL text. */
export async function copySchemaAsText(schema: Schema): Promise<void> {
	await navigator.clipboard.writeText(toDsl(schema));
}

/** Copies a single table's DSL definition (built as a one-table schema so we can reuse toDsl). */
export async function copyTableAsText(schema: Schema, tableId: TableId): Promise<void> {
	await copyTablesAsText(schema, [tableId]);
}

/** Copies several tables' DSL definitions (relations are dropped, same as the single-table case). */
export async function copyTablesAsText(schema: Schema, tableIds: readonly TableId[]): Promise<void> {
	const idSet = new Set(tableIds);
	const tables = schema.tables.filter((t) => idSet.has(t.id));
	if (tables.length === 0) return;
	const snippet: Schema = { ...schema, tables, relations: [], groups: [] };
	await navigator.clipboard.writeText(toDsl(snippet));
}

export function downloadFile(fileName: string, contents: string, mimeType = 'text/plain'): void {
	const blob = new Blob([contents], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
}
