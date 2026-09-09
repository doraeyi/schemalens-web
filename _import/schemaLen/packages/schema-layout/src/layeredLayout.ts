import type { TableId } from "@schemalens/schema-core";
import type {
  LayoutEdge,
  LayoutEngine,
  LayoutNode,
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
  clusterByGroup: boolean;
  groupPadding: number;
  groupHeaderHeight: number;
  groupGap: number;
}

function resolve(options: LayoutOptions | undefined): ResolvedOptions {
  return {
    nodeGap: options?.nodeGap ?? 48,
    layerGap: options?.layerGap ?? 140,
    componentGap: options?.componentGap ?? 96,
    direction: options?.direction ?? "LR",
    clusterByGroup: options?.clusterByGroup ?? true,
    groupPadding: options?.groupPadding ?? 28,
    groupHeaderHeight: options?.groupHeaderHeight ?? 46,
    groupGap: options?.groupGap ?? 72,
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

interface SubsetResult {
  /** 區域座標（左上角為 0,0）。 */
  positions: Map<TableId, { x: number; y: number; layer: number }>;
  width: number;
  height: number;
}

/**
 * 對一組節點做 layered 排版，回傳區域座標。
 *
 * 抽出來是為了讓「整張圖」與「單一群組」共用同一套演算法——
 * 群組聚攏只是把節點先切成幾組，各自排完再把整塊擺到畫布上。
 */
function layoutSubset(
  nodeIds: readonly TableId[],
  edges: readonly LayoutEdge[],
  sizeById: ReadonlyMap<TableId, LayoutNode>,
  opts: ResolvedOptions,
): SubsetResult {
  const positions = new Map<TableId, { x: number; y: number; layer: number }>();
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
      crossExtentByLayer.set(
        p.layer,
        Math.max(crossExtentByLayer.get(p.layer) ?? 0, p.cross + crossSize),
      );
    }

    for (const p of placements) {
      const centering = (componentExtent - (crossExtentByLayer.get(p.layer) ?? 0)) / 2;
      const cross = p.cross + Math.max(0, centering) + componentOffset;
      positions.set(p.id, {
        x: opts.direction === "LR" ? p.main : cross,
        y: opts.direction === "LR" ? cross : p.main,
        layer: p.layer,
      });
    }

    componentOffset += componentExtent + opts.componentGap;
  }

  let width = 0;
  let height = 0;
  for (const [id, pos] of positions) {
    const size = sizeById.get(id)!;
    width = Math.max(width, pos.x + size.width);
    height = Math.max(height, pos.y + size.height);
  }
  return { positions, width, height };
}

/** 依群組把節點分塊；沒有群組的節點集中成一塊放最後。 */
function partitionByGroup(
  nodes: readonly LayoutNode[],
): Array<{ key: string | null; ids: TableId[] }> {
  const grouped = new Map<string, TableId[]>();
  const ungrouped: TableId[] = [];

  for (const node of nodes) {
    if (!node.group) {
      ungrouped.push(node.id);
      continue;
    }
    const list = grouped.get(node.group);
    if (list) list.push(node.id);
    else grouped.set(node.group, [node.id]);
  }

  const blocks: Array<{ key: string | null; ids: TableId[] }> = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, ids]) => ({ key, ids }));
  if (ungrouped.length > 0) blocks.push({ key: null, ids: ungrouped });
  return blocks;
}

function toPositionedNodes(
  result: SubsetResult,
  sizeById: ReadonlyMap<TableId, LayoutNode>,
  offsetX: number,
  offsetY: number,
): PositionedNode[] {
  const nodes: PositionedNode[] = [];
  for (const [id, pos] of result.positions) {
    const size = sizeById.get(id)!;
    nodes.push({
      id,
      layer: pos.layer,
      width: size.width,
      height: size.height,
      x: pos.x + offsetX,
      y: pos.y + offsetY,
    });
  }
  return nodes;
}

/**
 * 內建的 layered layout。
 *
 * 這是 Stage 0 的預設實作；`LayoutEngine` 介面讓之後換成 ELK / Dagre
 * 時，Renderer 與 Extension 完全不需要改動。
 *
 * 節點帶 `group` 時會**先依群組聚攏**再排版：同群組的表排在一起，
 * 群組外框才有意義——散落各處的話外框會互相重疊，反而更難看懂。
 */
export const layeredLayout: LayoutEngine = {
  name: "layered",
  layout(input: LayoutInput, options?: LayoutOptions): PositionedGraph {
    const opts = resolve(options);
    const sizeById = new Map(input.nodes.map((n) => [n.id, n]));
    const nodeIds = input.nodes.map((n) => n.id);
    const edges = input.edges.filter((e) => sizeById.has(e.source) && sizeById.has(e.target));

    const clusterByGroup = opts.clusterByGroup && input.nodes.some((n) => Boolean(n.group));

    if (!clusterByGroup) {
      const result = layoutSubset(nodeIds, edges, sizeById, opts);
      const nodes = toPositionedNodes(result, sizeById, 0, 0);
      return {
        nodes,
        positionById: new Map(nodes.map((n) => [n.id, n])),
        bounds: computeBounds(nodes),
        groupBounds: new Map(),
      };
    }

    const blocks = partitionByGroup(input.nodes).map((block) => {
      const memberSet = new Set(block.ids);
      // 只用群組內部的邊來排版；跨群組的關聯仍會畫，但不影響聚攏。
      const innerEdges = edges.filter((e) => memberSet.has(e.source) && memberSet.has(e.target));
      const result = layoutSubset(block.ids, innerEdges, sizeById, opts);
      return {
        key: block.key,
        result,
        outerWidth: result.width + opts.groupPadding * 2,
        outerHeight: result.height + opts.groupPadding + opts.groupHeaderHeight,
      };
    });

    // 分塊以列為單位排放，超過目標寬度就換行；
    // 目標寬度取總面積的平方根，讓整體接近方形而不是拉成一長條。
    const totalArea = blocks.reduce((sum, b) => sum + b.outerWidth * b.outerHeight, 0);
    const widest = blocks.reduce((max, b) => Math.max(max, b.outerWidth), 0);
    const targetWidth = Math.max(widest, Math.sqrt(totalArea) * 1.4);

    const groupBounds = new Map<string, Rect>();
    const nodes: PositionedNode[] = [];

    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;

    for (const block of blocks) {
      if (cursorX > 0 && cursorX + block.outerWidth > targetWidth) {
        cursorX = 0;
        cursorY += rowHeight + opts.groupGap;
        rowHeight = 0;
      }

      // 節點在塊內要讓出外框的邊距與標題列。
      nodes.push(
        ...toPositionedNodes(
          block.result,
          sizeById,
          cursorX + opts.groupPadding,
          cursorY + opts.groupHeaderHeight,
        ),
      );
      if (block.key !== null) {
        groupBounds.set(block.key, {
          x: cursorX,
          y: cursorY,
          width: block.outerWidth,
          height: block.outerHeight,
        });
      }

      cursorX += block.outerWidth + opts.groupGap;
      rowHeight = Math.max(rowHeight, block.outerHeight);
    }

    return {
      nodes,
      positionById: new Map(nodes.map((n) => [n.id, n])),
      bounds: computeBounds(nodes),
      groupBounds,
    };
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
