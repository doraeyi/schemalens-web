/**
 * 排版品質的回歸測試：群組不要排成細長條、關聯多的群組要擺在一起、群組朝向連出去的方向。
 * 量化指標（交叉數、連線長度、填滿率）用 `pnpm layout:metrics <schema 檔>` 看。
 */
import { describe, expect, it } from "vitest";
import { buildGraph } from "@schemalens/schema-graph";
import { generateSchema } from "@schemalens/schema-fixtures";
import { layeredLayout, type LayoutEdge, type LayoutInput, type LayoutNode, type Rect } from "@schemalens/schema-layout";

function node(id: string, group?: string, height = 100): LayoutNode {
  return { id, width: 200, height, group };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function centerDistance(a: Rect, b: Rect): number {
  return Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
}

let edgeId = 0;
const edge = (source: string, target: string): LayoutEdge => ({ id: `e${edgeId++}`, source, target });

describe("群組內沒有關聯的表", () => {
  it("排成接近方形，不會疊成一條細長的直條", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => node(`t${i}`, "Lookup"));
    const bounds = layeredLayout.layout({ nodes, edges: [] }).groupBounds.get("Lookup")!;
    const aspect = bounds.width / bounds.height;
    expect(aspect).toBeGreaterThan(0.5);
    expect(aspect).toBeLessThan(3);
  });

  it("不分群組時也一樣（整張圖都是互不相關的表）", () => {
    const nodes = Array.from({ length: 16 }, (_, i) => node(`t${i}`));
    const { bounds } = layeredLayout.layout({ nodes, edges: [] });
    expect(bounds.width / bounds.height).toBeGreaterThan(0.5);
    expect(bounds.width / bounds.height).toBeLessThan(3);
  });
});

describe("群組的擺放", () => {
  // Core 跟 Orders 之間很多關聯；Misc1..Misc4 彼此跟誰都沒關係。
  const nodes = [
    ...["c1", "c2", "c3"].map((id) => node(id, "Core")),
    ...["o1", "o2", "o3"].map((id) => node(id, "Orders")),
    ...["m1", "m2", "m3", "m4"].map((id, i) => node(id, `Misc${i + 1}`)),
  ];
  const edges = [edge("o1", "c1"), edge("o2", "c1"), edge("o3", "c2"), edge("o2", "c3"), edge("c2", "c1")];
  const result = layeredLayout.layout({ nodes, edges });
  const box = (g: string) => result.groupBounds.get(g)!;

  it("關聯多的兩個群組擺在一起（比跟任何無關群組都近）", () => {
    const together = centerDistance(box("Core"), box("Orders"));
    for (const misc of ["Misc1", "Misc2", "Misc3", "Misc4"]) {
      expect(together).toBeLessThan(centerDistance(box("Core"), box(misc)));
    }
  });

  it("群組互不重疊，節點也互不重疊", () => {
    const rects = [...result.groupBounds.values()];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
    const placed = result.nodes;
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i]!, placed[j]!)).toBe(false);
  });

  it("結果是確定的：同樣的輸入永遠排出同樣的位置", () => {
    const again = layeredLayout.layout({ nodes, edges });
    expect(again.nodes).toEqual(result.nodes);
  });
});

describe("群組朝向連出去的方向", () => {
  it("要連到別的群組的表，會在自己群組靠近對方的那一側", () => {
    // Hub 群組只有一張被大量引用的表；Child 群組裡 child → mid → leaf 一條鏈，只有 child 連到 Hub。
    const nodes = [node("hub", "Hub", 400), node("leaf", "Child"), node("mid", "Child"), node("child", "Child")];
    const edges = [edge("child", "hub"), edge("child", "mid"), edge("mid", "leaf")];
    const result = layeredLayout.layout({ nodes, edges });
    const hub = result.positionById.get("hub")!;
    const child = result.positionById.get("child")!;
    const leaf = result.positionById.get("leaf")!;
    // child 應該比同群組最遠的 leaf 更靠近 hub。
    expect(centerDistance(child, hub)).toBeLessThan(centerDistance(leaf, hub));
  });
});

describe("大型 schema", () => {
  it.each([100, 200, 400])("%i 張表：沒有任何重疊，而且排版夠快", (tableCount) => {
    const schema = generateSchema({ tableCount });
    const graph = buildGraph(schema);
    const input: LayoutInput = {
      nodes: schema.tables.map((t) => node(t.id, t.group, 60 + t.columns.length * 22)),
      edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    const start = performance.now();
    const result = layeredLayout.layout(input);
    const elapsed = performance.now() - start;

    const placed = result.nodes;
    let overlapCount = 0;
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (overlaps(placed[i]!, placed[j]!)) overlapCount++;
    expect(overlapCount).toBe(0);
    // 每次重畫都會跑排版（而且一次跑兩遍），要留很大的餘裕。CI 機器比較慢，門檻放寬。
    expect(elapsed).toBeLessThan(500);
  });
});
