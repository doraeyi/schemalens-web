import { computeBounds } from '@schemalens/schema-layout';
import type { LayoutEngine, LayoutInput, LayoutNode, PositionedGraph, PositionedNode } from '@schemalens/schema-layout';
import type { Schema, TableId } from '@schemalens/schema-core';

// Must clear compactOverlay.ts's zone padding + label on both sides of the
// gap (28px padding below one band + 28px padding + 40px label above the
// next), or adjacent zone boxes visually overlap.
const BAND_GAP = 120;
const NODE_GAP_X = 24;
const NODE_GAP_Y = 20;
const BAND_MAX_WIDTH = 1500;

function placeBand(nodes: readonly LayoutNode[], startY: number, out: PositionedNode[]): number {
	if (nodes.length === 0) return startY;
	let x = 0;
	let y = startY;
	let rowHeight = 0;
	for (const node of nodes) {
		if (x > 0 && x + node.width > BAND_MAX_WIDTH) {
			x = 0;
			y += rowHeight + NODE_GAP_Y;
			rowHeight = 0;
		}
		out.push({ ...node, x, y, layer: 0 });
		x += node.width + NODE_GAP_X;
		rowHeight = Math.max(rowHeight, node.height);
	}
	return y + rowHeight;
}

/**
 * Compact-mode layout (schemalens-web only): one horizontal band per group,
 * stacked top to bottom, so the zone boxes drawn in compactOverlay.ts never
 * overlap — unlike the default layered layout, which interleaves tables from
 * different groups spatially based on their relations, not their group.
 *
 * `getSchema` is a getter (not a snapshot) so the same engine instance keeps
 * working correctly if the user imports a different schema while still in
 * compact mode.
 */
export function createCompactLayoutEngine(getSchema: () => Schema | null): LayoutEngine {
	return {
		name: 'compact-grouped',
		layout(input: LayoutInput): PositionedGraph {
			const schema = getSchema();
			const groupById = new Map<TableId, string | undefined>();
			if (schema) for (const table of schema.tables) groupById.set(table.id, table.group);

			const declaredOrder = (schema?.groups ?? []).map((g) => g.name);
			const declaredSet = new Set(declaredOrder);
			const implicitGroups = [
				...new Set(
					input.nodes
						.map((n) => groupById.get(n.id))
						.filter((g): g is string => !!g && !declaredSet.has(g))
				)
			].sort((a, b) => a.localeCompare(b));
			const order = [...declaredOrder, ...implicitGroups];

			const buckets = new Map<string, LayoutNode[]>();
			const ungrouped: LayoutNode[] = [];
			for (const node of input.nodes) {
				const group = groupById.get(node.id);
				if (!group) {
					ungrouped.push(node);
					continue;
				}
				(buckets.get(group) ?? buckets.set(group, []).get(group)!).push(node);
			}

			const positioned: PositionedNode[] = [];
			let y = 0;
			for (const name of order) {
				y = placeBand(buckets.get(name) ?? [], y, positioned);
				if (buckets.has(name)) y += BAND_GAP;
			}
			placeBand(ungrouped, y, positioned);

			const positionById = new Map(positioned.map((n) => [n.id, n] as const));
			// 精簡模式的分區排版跟「依群組聚攏」是不同機制（外層分區色塊自己管群組），
			// 不需要畫群組外框，回空 Map 就好。
			return { nodes: positioned, positionById, bounds: computeBounds(positioned), groupBounds: new Map() };
		}
	};
}
