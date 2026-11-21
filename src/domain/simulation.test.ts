import { describe, expect, it } from "vitest";
import type { GraphDocument } from "@/domain/graph";
import { advanceSimulation, initialSimulation } from "@/domain/simulation";

function makeDocument(edges: GraphDocument["edges"]): GraphDocument {
  return {
    nodes: [
      { id: "Screen", type: "ui", position: { x: 0, y: 0 }, data: { kind: "ui", label: "Checkout" } },
      { id: "API", type: "service", position: { x: 300, y: 0 }, data: { kind: "service", label: "API" } },
      { id: "Order", type: "schema", position: { x: 600, y: 0 }, data: { kind: "schema", label: "Order" } },
    ],
    edges,
  };
}

describe("local storyboard simulation", () => {
  it("starts from the chosen trigger and advances along a declared edge", () => {
    const document = makeDocument([{ id: "screen-api", source: "Screen", target: "API" }]);
    const started = advanceSimulation(document, { ...initialSimulation(), triggerNodeId: "Screen" }, true);
    const advanced = advanceSimulation(document, started, true);

    expect(started).toMatchObject({ activeNodeId: "Screen", activeEdgeId: null, step: 0, running: true });
    expect(advanced).toMatchObject({ activeNodeId: "API", activeEdgeId: "screen-api", step: 1, running: true });
    expect(advanced.message).toContain("API received the sample payload");
  });

  it("chooses an unvisited branch deterministically and reports the terminal node", () => {
    const document = makeDocument([
      { id: "screen-api", source: "Screen", target: "API" },
      { id: "api-order", source: "API", target: "Order" },
    ]);
    const started = advanceSimulation(document, { ...initialSimulation(), triggerNodeId: "API" });
    const advanced = advanceSimulation(document, started);
    const finished = advanceSimulation(document, advanced, true);

    expect(advanced.activeNodeId).toBe("Order");
    expect(finished).toMatchObject({ activeNodeId: "Order", activeEdgeId: null, running: false });
    expect(finished.message).toContain("Flow complete");
  });

  it("stops and reports a cycle without revisiting a node", () => {
    const document = makeDocument([
      { id: "screen-api", source: "Screen", target: "API" },
      { id: "api-screen", source: "API", target: "Screen" },
    ]);
    const started = advanceSimulation(document, { ...initialSimulation(), triggerNodeId: "Screen" });
    const advanced = advanceSimulation(document, started);
    const cycle = advanceSimulation(document, advanced, true);

    expect(cycle).toMatchObject({ activeNodeId: "API", activeEdgeId: "api-screen", running: false });
    expect(cycle.visitedNodeIds).toEqual(["Screen", "API"]);
    expect(cycle.message).toContain("Cycle detected");
  });

  it("reports an empty graph without starting playback", () => {
    const state = { ...initialSimulation(), running: true };
    const result = advanceSimulation({ nodes: [], edges: [] }, state, true);

    expect(result.running).toBe(false);
    expect(result.message).toContain("Add a node");
  });
});
