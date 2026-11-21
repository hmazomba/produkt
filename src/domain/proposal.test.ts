import { describe, expect, it } from "vitest";
import { STARTER_DOCUMENT, validateGraph } from "@/domain/graph";
import { applyGraphProposal, GraphProposalSchema, type GraphProposal } from "@/domain/proposal";

const proposal: GraphProposal = {
  rationale: "Publish a confirmation after the order is written.",
  nodes: [{ id: "Confirmation", kind: "service", label: "Confirmation event", detail: "Event publisher" }],
  edges: [{ source: "Orders", sourcePort: "created", target: "Confirmation", targetPort: "publish", label: "order created" }],
};

describe("validated additive graph proposals", () => {
  it("adds proposed content without replacing unrelated nodes or edges", () => {
    const before = structuredClone(STARTER_DOCUMENT);
    const result = applyGraphProposal(STARTER_DOCUMENT, proposal);

    expect(result.errors).toEqual([]);
    expect(result.document).toBeDefined();
    expect(result.document?.nodes.map((node) => node.id)).toContain("Confirmation");
    const existingNodes = result.document?.nodes.filter((node) => node.id !== "Confirmation") ?? [];
    expect(existingNodes.filter((node) => node.id !== "Orders")).toEqual(before.nodes.filter((node) => node.id !== "Orders"));
    expect(existingNodes.find((node) => node.id === "Orders")?.data.sourcePorts).toEqual(["create", "created"]);
    expect(result.document?.edges.slice(0, before.edges.length)).toEqual(before.edges);
    expect(result.document?.edges.at(-1)).toMatchObject({
      source: "Orders",
      sourceHandle: "created",
      target: "Confirmation",
      targetHandle: "publish",
      label: "order created",
    });
    expect(validateGraph(result.document!)).toEqual([]);
    expect(STARTER_DOCUMENT).toEqual(before);
  });

  it("rejects collisions, missing endpoints, and incompatible connection kinds", () => {
    const result = applyGraphProposal(STARTER_DOCUMENT, {
      rationale: "Invalid proposal",
      nodes: [{ id: "API", kind: "service", label: "Collision" }],
      edges: [
        { source: "Missing", target: "API" },
        { source: "Order", target: "Checkout" },
        { source: "Checkout", target: "Confirmation" },
      ],
    });

    expect(result.document).toBeUndefined();
    expect(result.errors.join(" ")).toContain("already exists");
    expect(result.errors.join(" ")).toContain("missing node");
    expect(result.errors.join(" ")).toContain("cannot send connections");
    expect(result.errors.join(" ")).toContain("cannot target UI");
  });

  it("rejects unknown fields and malformed IDs at the proposal boundary", () => {
    const parsed = GraphProposalSchema.safeParse({
      ...proposal,
      unexpected: "do not silently accept",
    });
    const malformed = GraphProposalSchema.safeParse({
      ...proposal,
      nodes: [{ id: "bad id", kind: "service", label: "Bad ID" }],
    });

    expect(parsed.success).toBe(false);
    expect(malformed.success).toBe(false);
  });
});
