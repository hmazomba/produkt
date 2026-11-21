import { describe, expect, it } from "vitest";
import { STARTER_DOCUMENT } from "@/domain/graph";
import { layoutGraph } from "@/domain/layout";

describe("Dagre node layout", () => {
  it("returns a new layout while preserving graph identity, content, and edges", () => {
    const input = {
      ...STARTER_DOCUMENT,
      nodes: STARTER_DOCUMENT.nodes.map((node, index) => ({ ...node, position: { x: index * 9, y: index * 13 } })),
    };
    const originalPositions = input.nodes.map((node) => node.position);

    const result = layoutGraph(input);

    expect(result).not.toBe(input);
    expect(result.nodes.map((node) => node.id)).toEqual(input.nodes.map((node) => node.id));
    expect(result.nodes.map((node) => node.data)).toEqual(input.nodes.map((node) => node.data));
    expect(result.edges).toEqual(input.edges);
    expect(input.nodes.map((node) => node.position)).toEqual(originalPositions);
    expect(new Set(result.nodes.map((node) => `${node.position.x}:${node.position.y}`)).size).toBe(result.nodes.length);
  });
});
