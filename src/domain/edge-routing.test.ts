import { describe, expect, it } from "vitest";
import type { GraphDocument } from "@/domain/graph";
import { routeGraphEdges } from "@/domain/edge-routing";

function makeDocument(edges: GraphDocument["edges"]): GraphDocument {
  return {
    nodes: [
      { id: "A", type: "service", position: { x: 0, y: 0 }, data: { kind: "service", label: "A" } },
      { id: "B", type: "service", position: { x: 300, y: 0 }, data: { kind: "service", label: "B" } },
      { id: "C", type: "service", position: { x: 600, y: 0 }, data: { kind: "service", label: "C" } },
    ],
    edges,
  };
}

describe("edge routing", () => {
  it("uses standard routing for a forward acyclic edge", () => {
    const result = routeGraphEdges(makeDocument([{ id: "A-B", source: "A", target: "B" }]));

    expect(result[0]).toMatchObject({ id: "A-B", type: "smoothstep" });
    expect(result[0].data?.routeFallback).toBeUndefined();
  });

  it("marks every edge in a directed cycle for a visible fallback", () => {
    const result = routeGraphEdges(makeDocument([
      { id: "A-B", source: "A", target: "B" },
      { id: "B-A", source: "B", target: "A" },
    ]));

    expect(result.map((edge) => edge.id)).toEqual(["A-B", "B-A"]);
    expect(result.every((edge) => edge.type === "produkt-fallback")).toBe(true);
    expect(result.every((edge) => edge.data?.routeFallback?.includes("cycle"))).toBe(true);
  });

  it("marks self-loops, reverse-direction edges, and parallel edges", () => {
    const result = routeGraphEdges(makeDocument([
      { id: "loop", source: "A", target: "A" },
      { id: "reverse", source: "C", target: "A" },
      { id: "parallel-1", source: "A", target: "B", sourceHandle: "out-1" },
      { id: "parallel-2", source: "A", target: "B", sourceHandle: "out-2" },
    ]));

    expect(result.map((edge) => edge.id)).toEqual(["loop", "reverse", "parallel-1", "parallel-2"]);
    expect(result[0].data?.routeFallback).toContain("self-loop");
    expect(result[1].data?.routeFallback).toContain("reverse direction");
    expect(result[2].data?.routeFallback).toContain("overlapping connections");
    expect(result[3].data?.routeOffset).toBe(1);
  });

  it("preserves authored edge metadata while adding presentation data", () => {
    const edge = { id: "loop", source: "A", target: "A", label: "retry", data: { authored: true } };
    const result = routeGraphEdges(makeDocument([edge]));

    expect(result[0]).toMatchObject({ ...edge, type: "produkt-fallback" });
    expect(result[0].data).toMatchObject({ authored: true, routeFallback: "self-loop, cycle", routeOffset: 0 });
    expect(edge.data).toEqual({ authored: true });
  });
});
