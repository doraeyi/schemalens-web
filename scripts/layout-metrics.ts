/**
 * 排版品質量測：拿實際的 schema 檔跑排版，印出客觀指標，改排版演算法前後比較用。
 *
 *   pnpm layout:metrics examples/large-schema.schema.md path/to/other.dbschema
 *
 * 卡片尺寸用 renderer 自己的估算（buildCardModels），跟畫面上的一致；連線以卡片中心之間的直線近似
 * ——實際畫的是側邊出線的曲線，但交叉多寡、長短的趨勢相同。
 */
import { readFileSync } from "node:fs";
import type { Schema } from "@schemalens/schema-core";
import { buildGraph } from "@schemalens/schema-graph";
import { layeredLayout, type PositionedGraph, type Rect } from "@schemalens/schema-layout";
import { parseMarkdownSchema, parseSchema } from "@schemalens/schema-parser";
import { DEFAULT_VIEW_STATE, buildCardModels, toLayoutNodes } from "@schemalens/schema-renderer";

// 跟 renderer.ts 的 GROUP_BOX 一致。
const GROUP_BOX = { padding: 28, headerHeight: 46 };

export interface LayoutMetrics {
  tables: number;
  relations: number;
  crossings: number;
  avgEdgeLength: number;
  /** 跨群組的連線平均長度——群組擺得好不好主要看這個。 */
  avgCrossGroupEdgeLength: number;
  /** 卡片總面積 ÷ 外框面積，越高代表空白越少。 */
  fillRatio: number;
  aspectRatio: number;
  nodeOverlaps: number;
  groupOverlaps: number;
}

function load(path: string): Schema {
  const text = readFileSync(path, "utf8");
  return /\.schema\.md$/i.test(path) ? parseMarkdownSchema(text, path).schema : parseSchema(text, path).schema;
}

function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
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

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function layoutFor(schema: Schema): PositionedGraph {
  const cards = buildCardModels(schema, DEFAULT_VIEW_STATE);
  const graph = buildGraph(schema);
  return layeredLayout.layout(
    { nodes: toLayoutNodes(cards), edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) },
    { clusterByGroup: true, groupPadding: GROUP_BOX.padding, groupHeaderHeight: GROUP_BOX.headerHeight },
  );
}

export function measure(schema: Schema, layout: PositionedGraph = layoutFor(schema)): LayoutMetrics {
  const groupOf = new Map(schema.tables.map((t) => [t.id, t.group]));
  const edges = buildGraph(schema)
    .edges.filter((e) => e.source !== e.target)
    .map((e) => {
      const s = layout.positionById.get(e.source);
      const t = layout.positionById.get(e.target);
      return s && t ? { a: center(s), b: center(t), source: e.source, target: e.target } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i]!;
      const f = edges[j]!;
      const shared = e.source === f.source || e.source === f.target || e.target === f.source || e.target === f.target;
      if (!shared && segmentsCross(e.a, e.b, f.a, f.b)) crossings++;
    }
  }

  const length = (e: (typeof edges)[number]) => Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y);
  const crossGroup = edges.filter((e) => groupOf.get(e.source) !== groupOf.get(e.target));
  const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);

  let nodeOverlaps = 0;
  const nodes = layout.nodes;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (overlaps(nodes[i]!, nodes[j]!)) nodeOverlaps++;
  const groups = [...layout.groupBounds.values()];
  let groupOverlaps = 0;
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) if (overlaps(groups[i]!, groups[j]!)) groupOverlaps++;

  const bounds = [...nodes, ...groups].reduce(
    (b, r) => ({
      minX: Math.min(b.minX, r.x),
      minY: Math.min(b.minY, r.y),
      maxX: Math.max(b.maxX, r.x + r.width),
      maxY: Math.max(b.maxY, r.y + r.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const nodeArea = nodes.reduce((s, n) => s + n.width * n.height, 0);

  return {
    tables: nodes.length,
    relations: edges.length,
    crossings,
    avgEdgeLength: Math.round(avg(edges.map(length))),
    avgCrossGroupEdgeLength: Math.round(avg(crossGroup.map(length))),
    fillRatio: Number((nodeArea / (width * height)).toFixed(3)),
    aspectRatio: Number((width / height).toFixed(2)),
    nodeOverlaps,
    groupOverlaps,
  };
}

const files = process.argv.slice(2);
if (files.length > 0) {
  const rows = files.map((file) => ({ file: file.split(/[\\/]/).pop(), ...measure(load(file)) }));
  console.table(rows);
}
