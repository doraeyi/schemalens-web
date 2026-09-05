import type { TableId } from "@schemalens/schema-core";
import type {
  LayoutEdge,
  LayoutEngine,
  LayoutInput,
  LayoutOptions,
  PositionedGraph,
  PositionedNode,
  Rect,
} from "./types.js";

interface ResolvedOptions {
  nodeGap: number;
  layerGap: number;
  componentGap: number;
  direction: "LR" | "TB";
}

function resolve(options: LayoutOptions | undefined): ResolvedOptions {
  return {
    nodeGap: options?.nodeGap ?? 48,
    layerGap: options?.layerGap ?? 140,
    componentGap: options?.componentGap ?? 96,
    direction: options?.direction ?? "LR",
  };
}

/** 無向鄰接，用來切連通元件。 */
function undirectedAdjacency(
  nodeIds: readonly TableId[],
  edges: readonly LayoutEdge[],
): Map<TableId, TableId[]> {
  const adj = new Map<TableId, TableId[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    if (e.source === e.target) continue;
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  return adj;
}

function connectedComponents(
  nodeIds: readonly TableId[],
  edges: readonly LayoutEdge[],
): TableId[][] {
  const adj = undirectedAdjacency(nodeIds, edges);
  const seen = new Set<TableId>();
  const components: TableId[][] = [];
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    const component: TableId[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of adj.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    components.push(component);
  }
  // 大的元件先排，讓主結構出現在左上角，符合「打開就看到重點」的 UX。
  components.sort((a, b) => b.length - a.length);
  return components;
}

/**
 * 依 FK 方向分層（source 在 target 右邊：被參照的維度表往左收）。
 * 用迭代鬆弛而非遞迴，避免大型 schema 的 cycle 造成無限遞迴。
 */
function assignLayers(nodeIds: readonly TableId[], edges: readonly LayoutEdge[]): Map<TableId, number> {
  const layer = new Map<TableId, number>();
  for (const id of nodeIds) layer.set(id, 0);
  const inComponent = new Set(nodeIds);
  const relevant = edges.filter(
    (e) => inComponent.has(e.source) && inComponent.has(e.target) && e.source !== e.target,
  );

  // 最多掃 n 輪；有 cycle 時會自然停在上限，不會發散。
  const maxPasses = Math.max(1, nodeIds.length);
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const e of relevant) {
      // target 被 source 參照 → target 應該比 source 更靠左（層數更小）。
      const want = layer.get(e.target)! + 1;
      if (layer.get(e.source)! < want) {
        layer.set(e.source, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

/** Barycenter 排序：讓同層節點靠近其鄰居，降低交叉線。 */
function orderWithinLayers(
  layers: Map<number, TableId[]>,
  edges: readonly LayoutEdge[],
  passes = 4,
): void {
  const neighbors = new Map<TableId, TableId[]>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    (neighbors.get(e.source) ?? neighbors.set(e.source, []).get(e.source)!).push(e.target);
    (neighbors.get(e.target) ?? neighbors.set(e.target, []).get(e.target)!).push(e.source);
  }

  const rank = new Map<TableId, number>();
  for (const ids of layers.values()) {
    ids.forEach((id, i) => rank.set(id, i));
  }

  const layerKeys = [...layers.keys()].sort((a, b) => a - b);
  for (let pass = 0; pass < passes; pass++) {
    const keys = pass % 2 === 0 ? layerKeys : [...layerKeys].reverse();
    for (const key of keys) {
      const ids = layers.get(key)!;
      const bary = new Map<TableId, number>();
      for (const id of ids) {
        const ns = neighbors.get(id) ?? [];
        const ranks = ns.map((n) => rank.get(n)).filter((r): r is number => r !== undefined);
        bary.set(id, ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : rank.get(id)!);
      }
      ids.sort((a, b) => bary.get(a)! - bary.get(b)! || a.localeCompare(b));
      ids.forEach((id, i) => rank.set(id, i));
    }
  }
}

/**
 * 內建的 layered layout。
 *
 * 這是 Stage 0 的預設實作；`LayoutEngine` 介面讓之後換成 ELK / Dagre
 * 時，Renderer 與 Extension 完全不需要改動。
 */
export const layeredLayout: LayoutEngine = {
  name: "layered",
  layout(input: LayoutInput, options?: LayoutOptions): PositionedGraph {
    const opts = resolve(options);
    const sizeById = new Map(input.nodes.map((n) => [n.id, n]));
    const nodeIds = input.nodes.map((n) => n.id);
    const edges = input.edges.filter((e) => sizeById.has(e.source) && sizeById.has(e.target));

    const positioned: PositionedNode[] = [];
    // 元件沿次要軸（LR 時為 y）依序堆疊，彼此不重疊。
    let componentOffset = 0;

    for (const component of connectedComponents(nodeIds, edges)) {
      const componentSet = new Set(component);
      const componentEdges = edges.filter(
        (e) => componentSet.has(e.source) && componentSet.has(e.target),
      );
      const layerOf = assignLayers(component, componentEdges);

      const layers = new Map<number, TableId[]>();
      for (const id of component) {
        const l = layerOf.get(id)!;
        (layers.get(l) ?? layers.set(l, []).get(l)!).push(id);
      }
      for (const ids of layers.values()) ids.sort((a, b) => a.localeCompare(b));
      orderWithinLayers(layers, componentEdges);

      const layerKeys = [...layers.keys()].sort((a, b) => a - b);
      // 主軸（LR 時為 x）：每層寬度取該層最大節點。
      let mainAxis = 0;
      let componentExtent = 0;
      const placements: Array<{ id: TableId; main: number; cross: number; layer: number }> = [];

      for (const key of layerKeys) {
        const ids = layers.get(key)!;
        let layerThickness = 0;
        let cross = 0;
        for (const id of ids) {
          const size = sizeById.get(id)!;
          const mainSize = opts.direction === "LR" ? size.width : size.height;
          const crossSize = opts.direction === "LR" ? size.height : size.width;
          placements.push({ id, main: mainAxis, cross, layer: key });
          cross += crossSize + opts.nodeGap;
          layerThickness = Math.max(layerThickness, mainSize);
        }
        componentExtent = Math.max(componentExtent, cross - opts.nodeGap);
        mainAxis += layerThickness + opts.layerGap;
      }

      // 每層置中對齊，讓元件在視覺上平衡。
      const crossExtentByLayer = new Map<number, number>();
      for (const p of placements) {
        const size = sizeById.get(p.id)!;
        const crossSize = opts.direction === "LR" ? size.height : size.width;
        crossExtentByLayer.set(p.layer, Math.max(crossExtentByLayer.get(p.layer) ?? 0, p.cross + crossSize));
      }

      for (const p of placements) {
        const size = sizeById.get(p.id)!;
        const centering = (componentExtent - (crossExtentByLayer.get(p.layer) ?? 0)) / 2;
        const cross = p.cross + Math.max(0, centering) + componentOffset;
        positioned.push({
          id: p.id,
          layer: p.layer,
          width: size.width,
          height: size.height,
          x: opts.direction === "LR" ? p.main : cross,
          y: opts.direction === "LR" ? cross : p.main,
        });
      }

      componentOffset += componentExtent + opts.componentGap;
    }

    const positionById = new Map(positioned.map((n) => [n.id, n]));
    return { nodes: positioned, positionById, bounds: computeBounds(positioned) };
  },
};

export function computeBounds(nodes: readonly PositionedNode[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
