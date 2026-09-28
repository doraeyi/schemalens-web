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
  // 每個連通元件先各自排在自己的區域座標裡，最後再用 packComponents 擺到一起。
  const laidOut: Array<{ positions: Map<TableId, { x: number; y: number; layer: number }>; width: number; height: number }> = [];

  for (const component of connectedComponents(nodeIds, edges)) {
    const local = new Map<TableId, { x: number; y: number; layer: number }>();
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

    let localWidth = 0;
    let localHeight = 0;
    for (const p of placements) {
      const centering = (componentExtent - (crossExtentByLayer.get(p.layer) ?? 0)) / 2;
      const cross = p.cross + Math.max(0, centering);
      const x = opts.direction === "LR" ? p.main : cross;
      const y = opts.direction === "LR" ? cross : p.main;
      local.set(p.id, { x, y, layer: p.layer });
      const size = sizeById.get(p.id)!;
      localWidth = Math.max(localWidth, x + size.width);
      localHeight = Math.max(localHeight, y + size.height);
    }
    laidOut.push({ positions: local, width: localWidth, height: localHeight });
  }

  for (const block of packComponents(laidOut, opts.componentGap)) {
    for (const [id, pos] of block.item.positions) {
      positions.set(id, { x: pos.x + block.x, y: pos.y + block.y, layer: pos.layer });
    }
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

/**
 * 把一堆矩形像排書架一樣擺在一起：由左往右，超過目標寬度就換行，讓整體接近方形。
 *
 * 以前連通元件是沿次要軸一路往下疊：一個群組裡如果有很多彼此沒有關聯的表（每張都是一個元件），
 * 就會排成一條又細又長的直條，畫面大部分是空白。輸入已經依大小排好（大的在前）。
 */
function packComponents<T extends { width: number; height: number }>(
  items: readonly T[],
  gap: number,
): Array<{ item: T; x: number; y: number }> {
  if (items.length === 0) return [];
  const widest = items.reduce((max, item) => Math.max(max, item.width), 0);
  const totalArea = items.reduce((sum, item) => sum + (item.width + gap) * (item.height + gap), 0);
  // 稍微偏寬：螢幕是橫的。
  const targetWidth = Math.max(widest, Math.sqrt(totalArea * 1.6));

  const placed: Array<{ item: T; x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const item of items) {
    if (x > 0 && x + item.width > targetWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    placed.push({ item, x, y });
    x += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }
  return placed;
}

/**
 * 決定每個群組區塊擺在哪裡（以前是照字母順序一列一列排，完全不看群組之間的關聯）。
 *
 * 一次放一塊：先放跟其他群組關聯最多的那塊當中心，之後每次挑跟「已經放好的」關聯最多的那塊，
 * 在已放好區塊的上下左右找候選位置，選 Σ(關聯數 × 中心距離) 最小的——關聯多的群組會貼在一起。
 * 另外加一點「整體外框變長」的代價，沒有關聯的群組才會往空位補、整體接近方形，不會越擺越散。
 * 回傳每塊左上角座標（已平移成從 0,0 開始）。
 */
function placeBlocks(
  blocks: ReadonlyArray<{ width: number; height: number }>,
  weights: ReadonlyArray<ReadonlyArray<number>>,
  gap: number,
): Array<{ x: number; y: number }> {
  const n = blocks.length;
  const result: Array<{ x: number; y: number }> = blocks.map(() => ({ x: 0, y: 0 }));
  if (n === 0) return result;

  const size = (i: number) => blocks[i]!;
  const weight = (i: number, j: number) => weights[i]![j]!;
  const totalWeight = (i: number) => weights[i]!.reduce((sum, w) => sum + w, 0);
  const area = (i: number) => size(i).width * size(i).height;

  const placed: number[] = [];
  const isPlaced = new Array<boolean>(n).fill(false);
  const overlapsPlaced = (x: number, y: number, w: number, h: number) =>
    placed.some((j) => {
      const p = result[j]!;
      const b = size(j);
      return x < p.x + b.width + gap && p.x < x + w + gap && y < p.y + b.height + gap && p.y < y + h + gap;
    });

  // 第一塊：關聯最多的，一樣多就取面積大的。
  let first = 0;
  for (let i = 1; i < n; i++) {
    if (totalWeight(i) > totalWeight(first) || (totalWeight(i) === totalWeight(first) && area(i) > area(first))) first = i;
  }
  placed.push(first);
  isPlaced[first] = true;
  let bounds = { minX: 0, minY: 0, maxX: size(first).width, maxY: size(first).height };

  // 「外框變長」代價的尺度：跟區塊的平均邊長同一個量級，才能跟距離代價互相比較。
  const typicalSide = blocks.reduce((sum, b) => sum + Math.sqrt(b.width * b.height), 0) / n;

  while (placed.length < n) {
    // 下一塊：跟已放好的關聯最多的；都沒有關聯就取面積最大的。
    let next = -1;
    let nextAttachment = -1;
    for (let i = 0; i < n; i++) {
      if (isPlaced[i]) continue;
      const attachment = placed.reduce((sum, j) => sum + weight(i, j), 0);
      if (next === -1 || attachment > nextAttachment || (attachment === nextAttachment && area(i) > area(next))) {
        next = i;
        nextAttachment = attachment;
      }
    }

    const { width: w, height: h } = size(next);
    let best: { x: number; y: number } | null = null;
    let bestCost = Infinity;
    for (const j of placed) {
      const p = result[j]!;
      const b = size(j);
      const candidates = [
        { x: p.x + b.width + gap, y: p.y },
        { x: p.x + b.width + gap, y: p.y + b.height - h },
        { x: p.x - w - gap, y: p.y },
        { x: p.x - w - gap, y: p.y + b.height - h },
        { x: p.x, y: p.y + b.height + gap },
        { x: p.x + b.width - w, y: p.y + b.height + gap },
        { x: p.x, y: p.y - h - gap },
        { x: p.x + b.width - w, y: p.y - h - gap },
      ];
      for (const c of candidates) {
        if (overlapsPlaced(c.x, c.y, w, h)) continue;
        let cost = 0;
        for (const k of placed) {
          const wk = weight(next, k);
          if (wk === 0) continue;
          const q = result[k]!;
          const qb = size(k);
          cost += wk * Math.hypot(c.x + w / 2 - (q.x + qb.width / 2), c.y + h / 2 - (q.y + qb.height / 2));
        }
        // 用新外框「較長的那一邊」衡量（寬度打 1.6 折，因為螢幕是橫的），偏好接近方形。
        const longSide = Math.max(
          (Math.max(bounds.maxX, c.x + w) - Math.min(bounds.minX, c.x)) / 1.6,
          Math.max(bounds.maxY, c.y + h) - Math.min(bounds.minY, c.y),
        );
        cost += (longSide * typicalSide) / 400;
        if (cost < bestCost) {
          bestCost = cost;
          best = c;
        }
      }
    }

    // 所有候選位置都會重疊的極端情況：放到目前外框右邊。
    const position = best ?? { x: bounds.maxX + gap, y: bounds.minY };
    result[next] = position;
    placed.push(next);
    isPlaced[next] = true;
    bounds = {
      minX: Math.min(bounds.minX, position.x),
      minY: Math.min(bounds.minY, position.y),
      maxX: Math.max(bounds.maxX, position.x + w),
      maxY: Math.max(bounds.maxY, position.y + h),
    };
  }

  return result.map((p) => ({ x: p.x - bounds.minX, y: p.y - bounds.minY }));
}

/**
 * 群組內部是只看群組內關聯排出來的，不知道外面的群組擺在哪：要連到右邊群組的表，
 * 可能剛好在最左邊，線就會橫越整個群組、跟別的線交叉。這裡讓每個群組在四種方向
 * （原樣、左右翻、上下翻、都翻）裡挑「交叉數 + 跨群組連線總長」最小的，重複幾輪直到穩定。
 * 交叉以卡片中心之間的直線估算（實際畫的是曲線，但趨勢一樣）。
 * 翻轉不改變群組內部的排版品質，所以只會改善、不會變差。直接改寫 block.result.positions。
 */
function orientBlocks(
  blocks: ReadonlyArray<{ result: SubsetResult }>,
  placements: ReadonlyArray<{ x: number; y: number }>,
  edges: readonly LayoutEdge[],
  sizeById: ReadonlyMap<TableId, LayoutNode>,
  opts: ResolvedOptions,
): void {
  const blockOf = new Map<TableId, number>();
  blocks.forEach((block, index) => {
    for (const id of block.result.positions.keys()) blockOf.set(id, index);
  });
  const allEdges = edges.filter((e) => e.source !== e.target && blockOf.has(e.source) && blockOf.has(e.target));
  const crossEdges = allEdges.filter((e) => blockOf.get(e.source) !== blockOf.get(e.target));
  if (crossEdges.length === 0) return;
  // 一個交叉大約等於多長的線：取區塊平均邊長的一半，讓兩種代價同一個量級。
  const crossingPenalty =
    blocks.reduce((sum, b) => sum + Math.sqrt(Math.max(1, b.result.width * b.result.height)), 0) / blocks.length / 2;
  // 算交叉數的成本大約是「跨群組連線數 × 全部連線數」。排版每次重畫都會跑，線太多時只看連線長度
  // （400 張表左右才會碰到；只看長度也比不翻轉好，只是少了最後那一點改善）。
  const countCrossingsToo = crossEdges.length * allEdges.length <= 60_000;

  const flips = blocks.map(() => ({ x: false, y: false }));
  const centerOf = (id: TableId, flip: { x: boolean; y: boolean }) => {
    const index = blockOf.get(id)!;
    const { result } = blocks[index]!;
    const pos = result.positions.get(id)!;
    const size = sizeById.get(id)!;
    const x = flip.x ? result.width - pos.x - size.width : pos.x;
    const y = flip.y ? result.height - pos.y - size.height : pos.y;
    return {
      x: placements[index]!.x + opts.groupPadding + x + size.width / 2,
      y: placements[index]!.y + opts.groupHeaderHeight + y + size.height / 2,
    };
  };
  const flipFor = (id: TableId, index: number, candidate: { x: boolean; y: boolean }) =>
    blockOf.get(id) === index ? candidate : flips[blockOf.get(id)!]!;

  const options = [
    { x: false, y: false },
    { x: true, y: false },
    { x: false, y: true },
    { x: true, y: true },
  ];
  const innerByBlock: LayoutEdge[][] = blocks.map(() => []);
  for (const e of allEdges) {
    const a = blockOf.get(e.source)!;
    if (a === blockOf.get(e.target)) innerByBlock[a]!.push(e);
  }
  const incidentByBlock = blocks.map((_, index) =>
    crossEdges.filter((e) => blockOf.get(e.source) === index || blockOf.get(e.target) === index),
  );
  // 端點編成數字：交叉計算是這個函式最熱的迴圈，比對字串 id 太慢。
  const nodeNumber = new Map<TableId, number>();
  for (const id of blockOf.keys()) nodeNumber.set(id, nodeNumber.size);
  const makeSegment = (e: LayoutEdge, a: { x: number; y: number }, b: { x: number; y: number }): Segment => ({
    e,
    s: nodeNumber.get(e.source)!,
    t: nodeNumber.get(e.target)!,
    a,
    b,
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  });
  const currentSegment = (e: LayoutEdge): Segment =>
    makeSegment(e, centerOf(e.source, flips[blockOf.get(e.source)!]!), centerOf(e.target, flips[blockOf.get(e.target)!]!));
  const countCrossings = (moved: readonly Segment[], others: readonly Segment[]): number => {
    let count = 0;
    for (const p of moved) {
      for (const q of others) {
        // 外框不重疊就一定不相交，大部分線對在這裡就排除掉了。
        if (p.maxX < q.minX || q.maxX < p.minX || p.maxY < q.minY || q.maxY < p.minY) continue;
        if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
        if (segmentsCross(p.a, p.b, q.a, q.b)) count++;
      }
    }
    return count;
  };

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let index = 0; index < blocks.length; index++) {
      const incident = incidentByBlock[index]!;
      if (incident.length === 0) continue;
      // 翻轉會改變的交叉只有「至少一條是跨群組連線」的線對：同一群組內部的兩條線一起翻，
      // 相對位置不變；不同群組內部的線各自落在互不重疊的外框裡，本來就不可能交叉。
      // 不隨這個群組翻轉而改變的線段，每個群組只算一次。
      const incidentSet = new Set(incident);
      const otherCross = countCrossingsToo ? crossEdges.filter((e) => !incidentSet.has(e)).map(currentSegment) : [];
      const otherInner = countCrossingsToo
        ? innerByBlock.flatMap((list, i) => (i === index ? [] : list)).map(currentSegment)
        : [];

      let best = flips[index]!;
      let bestCost = Infinity;
      // 目前的方向排第一個：平手時才會保留它，不會在幾輪之間來回翻。
      for (const candidate of [flips[index]!, ...options]) {
        const segment = (e: LayoutEdge): Segment =>
          makeSegment(
            e,
            centerOf(e.source, flipFor(e.source, index, candidate)),
            centerOf(e.target, flipFor(e.target, index, candidate)),
          );
        const movedCross = incident.map(segment);

        let cost = 0;
        for (const { a, b } of movedCross) cost += Math.hypot(a.x - b.x, a.y - b.y);
        if (countCrossingsToo) {
          const movedInner = innerByBlock[index]!.map(segment);
          let crossings = countCrossings(movedCross, otherCross) + countCrossings(movedCross, otherInner);
          crossings += countCrossings(movedCross, movedInner) + countCrossings(movedInner, otherCross);
          for (let i = 0; i < movedCross.length; i++) crossings += countCrossings([movedCross[i]!], movedCross.slice(i + 1));
          cost += crossings * crossingPenalty;
        }

        if (cost < bestCost - 1e-6) {
          bestCost = cost;
          best = candidate;
        }
      }
      if (best.x !== flips[index]!.x || best.y !== flips[index]!.y) {
        flips[index] = best;
        changed = true;
      }
    }
    if (!changed) break;
  }

  blocks.forEach((block, index) => {
    const flip = flips[index]!;
    if (!flip.x && !flip.y) return;
    const { result } = block;
    for (const [id, pos] of result.positions) {
      const size = sizeById.get(id)!;
      result.positions.set(id, {
        ...pos,
        x: flip.x ? result.width - pos.x - size.width : pos.x,
        y: flip.y ? result.height - pos.y - size.height : pos.y,
      });
    }
  });
}

/** 以卡片中心之間的直線近似一條關聯線；s／t 是端點編號，min／max 是外框。 */
interface Segment {
  e: LayoutEdge;
  s: number;
  t: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function segmentsCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const orient = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
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

    const partitioned = partitionByGroup(input.nodes);
    const blocks = partitioned.map((block) => {
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

    // 群組之間的關聯數：關聯多的兩個群組要擺在一起，跨群組的線才不會拉得又長又亂。
    const blockOf = new Map<TableId, number>();
    partitioned.forEach((block, index) => {
      for (const id of block.ids) blockOf.set(id, index);
    });
    const weights = blocks.map(() => new Array<number>(blocks.length).fill(0));
    for (const e of edges) {
      const a = blockOf.get(e.source);
      const b = blockOf.get(e.target);
      if (a === undefined || b === undefined || a === b) continue;
      weights[a]![b]! += 1;
      weights[b]![a]! += 1;
    }
    const placements = placeBlocks(
      blocks.map((b) => ({ width: b.outerWidth, height: b.outerHeight })),
      weights,
      opts.groupGap,
    );

    orientBlocks(blocks, placements, edges, sizeById, opts);

    const groupBounds = new Map<string, Rect>();
    const nodes: PositionedNode[] = [];

    for (const [index, block] of blocks.entries()) {
      const { x: cursorX, y: cursorY } = placements[index]!;

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
