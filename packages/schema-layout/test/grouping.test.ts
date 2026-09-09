/**
 * 群組聚攏。
 *
 * 外框要有意義，前提是同群組的表被排在一起——
 * 散落各處的話外框會互相重疊，比沒有外框更難看懂。
 */
import { describe, expect, it } from "vitest";
import { layeredLayout, type LayoutInput, type Rect } from "@schemalens/schema-layout";

function node(id: string, group?: string) {
  return { id, width: 200, height: 100, group };
}

const input: LayoutInput = {
  nodes: [
    node("a1", "A"),
    node("a2", "A"),
    node("a3", "A"),
    node("b1", "B"),
    node("b2", "B"),
    node("free"),
  ],
  edges: [
    { id: "e1", source: "a2", target: "a1" },
    { id: "e2", source: "a3", target: "a1" },
    { id: "e3", source: "b2", target: "b1" },
    // 跨群組的邊：仍要能畫，但不該把兩個群組黏在一起。
    { id: "cross", source: "b1", target: "a1" },
  ],
};

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("依群組聚攏", () => {
  const result = layeredLayout.layout(input);

  it("回報每個群組的外框", () => {
    expect([...result.groupBounds.keys()].sort()).toEqual(["A", "B"]);
  });

  it("外框涵蓋該群組的所有節點", () => {
    for (const [group, rect] of result.groupBounds) {
      const members = input.nodes.filter((n) => n.group === group);
      for (const member of members) {
        const pos = result.positionById.get(member.id)!;
        expect(pos.x).toBeGreaterThanOrEqual(rect.x);
        expect(pos.y).toBeGreaterThanOrEqual(rect.y);
        expect(pos.x + pos.width).toBeLessThanOrEqual(rect.x + rect.width + 0.001);
        expect(pos.y + pos.height).toBeLessThanOrEqual(rect.y + rect.height + 0.001);
      }
    }
  });

  it("不同群組的外框不重疊", () => {
    const rects = [...result.groupBounds.values()];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it("其他群組的節點不會落進別人的外框裡", () => {
    for (const [group, rect] of result.groupBounds) {
      for (const other of input.nodes.filter((n) => n.group !== group)) {
        const pos = result.positionById.get(other.id)!;
        expect(overlaps(rect, pos)).toBe(false);
      }
    }
  });

  it("沒有群組的節點不會產生外框，但仍有位置", () => {
    expect(result.groupBounds.has("free")).toBe(false);
    expect(result.positionById.get("free")).toBeDefined();
  });

  it("節點之間仍然不重疊", () => {
    const nodes = result.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(overlaps(nodes[i]!, nodes[j]!)).toBe(false);
      }
    }
  });

  it("外框頂端保留標題空間，節點不會壓到標題", () => {
    const headerHeight = 46;
    for (const [group, rect] of result.groupBounds) {
      for (const member of input.nodes.filter((n) => n.group === group)) {
        expect(result.positionById.get(member.id)!.y).toBeGreaterThanOrEqual(rect.y + headerHeight);
      }
    }
  });

  it("關掉 clusterByGroup 就回到原本的排版，且沒有外框", () => {
    const flat = layeredLayout.layout(input, { clusterByGroup: false });
    expect(flat.groupBounds.size).toBe(0);
    expect(flat.nodes).toHaveLength(input.nodes.length);
  });

  it("完全沒有群組時自動略過聚攏", () => {
    const plain = layeredLayout.layout({
      nodes: [node("x"), node("y")],
      edges: [{ id: "e", source: "y", target: "x" }],
    });
    expect(plain.groupBounds.size).toBe(0);
  });

  it("邊距可調整", () => {
    const wide = layeredLayout.layout(input, { groupPadding: 80 });
    const normal = layeredLayout.layout(input);
    expect(wide.groupBounds.get("A")!.width).toBeGreaterThan(normal.groupBounds.get("A")!.width);
  });
});
