import { describe, expect, it } from "vitest";
import { buildGraph } from "@schemalens/schema-graph";
import { generateSchema } from "@schemalens/schema-fixtures";
import { layeredLayout, routeEdge, toSvgPath, type LayoutInput } from "@schemalens/schema-layout";

function inputFor(tableCount: number): LayoutInput {
  const schema = generateSchema({ tableCount });
  const graph = buildGraph(schema);
  return {
    nodes: schema.tables.map((t) => ({ id: t.id, width: 260, height: 40 + t.columns.length * 22 })),
    edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

describe("layeredLayout", () => {
  it("每個節點都會拿到位置", () => {
    const input = inputFor(50);
    const result = layeredLayout.layout(input);
    expect(result.nodes).toHaveLength(input.nodes.length);
    for (const node of input.nodes) {
      expect(result.positionById.get(node.id)).toBeDefined();
    }
  });

  it("節點不重疊（基本碰撞避免）", () => {
    const result = layeredLayout.layout(inputFor(50));
    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        expect(overlaps(result.nodes[i]!, result.nodes[j]!)).toBe(false);
      }
    }
  });

  it("bounds 涵蓋所有節點", () => {
    const result = layeredLayout.layout(inputFor(20));
    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(result.bounds.x);
      expect(node.y).toBeGreaterThanOrEqual(result.bounds.y);
      expect(node.x + node.width).toBeLessThanOrEqual(result.bounds.x + result.bounds.width + 0.001);
      expect(node.y + node.height).toBeLessThanOrEqual(result.bounds.y + result.bounds.height + 0.001);
    }
  });

  it("被參照的表會被排到參照者的左邊（FK 方向）", () => {
    const result = layeredLayout.layout({
      nodes: [
        { id: "dbo.Users", width: 200, height: 100 },
        { id: "dbo.Posts", width: 200, height: 100 },
      ],
      edges: [{ id: "FK_Posts_Users", source: "dbo.Posts", target: "dbo.Users" }],
    });
    const users = result.positionById.get("dbo.Users")!;
    const posts = result.positionById.get("dbo.Posts")!;
    expect(users.x).toBeLessThan(posts.x);
    expect(users.layer).toBeLessThan(posts.layer);
  });

  it("有 cycle 也能收斂，不會卡住", () => {
    const result = layeredLayout.layout({
      nodes: [
        { id: "a", width: 100, height: 50 },
        { id: "b", width: 100, height: 50 },
        { id: "c", width: 100, height: 50 },
      ],
      edges: [
        { id: "1", source: "a", target: "b" },
        { id: "2", source: "b", target: "c" },
        { id: "3", source: "c", target: "a" },
      ],
    });
    expect(result.nodes).toHaveLength(3);
  });

  it("空輸入回傳空 bounds", () => {
    const result = layeredLayout.layout({ nodes: [], edges: [] });
    expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("200 表的排版在 1 秒內完成（Stress Test）", () => {
    const input = inputFor(200);
    const start = performance.now();
    layeredLayout.layout(input);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("routeEdge", () => {
  const left = { node: { x: 0, y: 0, width: 200, height: 100 }, rowCenterY: 30 };
  const right = { node: { x: 400, y: 0, width: 200, height: 100 }, rowCenterY: 70 };

  it("錨點取的是欄位 Row 的高度，不是卡片中心（約束 #17）", () => {
    const routed = routeEdge(left, right);
    expect(routed.from.y).toBe(30);
    expect(routed.to.y).toBe(70);
  });

  it("左邊的卡片從右側出線，右邊的卡片從左側接線", () => {
    const routed = routeEdge(left, right);
    expect(routed.fromSide).toBe("right");
    expect(routed.from.x).toBe(200);
    expect(routed.toSide).toBe("left");
    expect(routed.to.x).toBe(400);
  });

  it("來源在右側時自動翻面，線不會穿過卡片", () => {
    const routed = routeEdge(right, left);
    expect(routed.fromSide).toBe("left");
    expect(routed.toSide).toBe("right");
  });

  it("輸出合法的 SVG 路徑", () => {
    expect(toSvgPath(routeEdge(left, right))).toMatch(/^M [\d.-]+ [\d.-]+ C /);
  });
});
