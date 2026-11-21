import { describe, expect, it } from "vitest";
import {
  GraphDocumentSchema,
  STARTER_SOURCE,
  parseGraphSource,
  serializeGraph,
  validateGraph,
} from "@/domain/graph";

describe("native graph DSL", () => {
  it("parses the starter source into the authored graph", () => {
    const result = parseGraphSource(STARTER_SOURCE);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes.map((node) => node.id)).toEqual(["Checkout", "API", "Orders", "Order", "Receipt"]);
    expect(result.document?.edges).toHaveLength(4);
    expect(result.document?.nodes[0].data.fields?.[0]).toEqual({ name: "email", type: "Email", example: "maya@studio.co" });
  });

  it("round-trips supported metadata, escaped labels, ports, and stable IDs", () => {
    const source = [
      'ui Checkout [label="Checkout \\"form\\""]',
      'meta Checkout [detail="Form · secure", component="form"]',
      'field Checkout.email [type="Email", example="maya@studio.co"]',
      'service API [label="API"]',
      'Checkout.submit -> API.create [label="POST /checkout"]',
    ].join("\n");
    const parsed = parseGraphSource(source);
    expect(parsed.document).toBeDefined();

    const roundTrip = parseGraphSource(serializeGraph(parsed.document!));

    expect(roundTrip.diagnostics).toEqual([]);
    expect(roundTrip.document?.nodes.map((node) => node.id)).toEqual(["Checkout", "API"]);
    expect(roundTrip.document?.nodes[0].data).toMatchObject({
      label: 'Checkout "form"',
      detail: "Form · secure",
      component: "form",
      fields: [{ name: "email", type: "Email", example: "maya@studio.co" }],
      sourcePorts: ["submit"],
    });
    expect(roundTrip.document?.edges[0]).toMatchObject({
      id: "e-Checkout-submit-API-create",
      source: "Checkout",
      sourceHandle: "submit",
      target: "API",
      targetHandle: "create",
      label: "POST /checkout",
    });
  });

  it("reports actionable line diagnostics and withholds invalid documents", () => {
    const result = parseGraphSource('service API [label="API"]\nUnknown.call -> API [label="bad"]');

    expect(result.document).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({ line: 2, column: 1 });
    expect(result.diagnostics[0].message).toContain("Unknown");
  });

  it("rejects duplicate declarations and incompatible connections", () => {
    const duplicate = parseGraphSource('service API [label="API"]\nservice API [label="Again"]');
    const incompatible = parseGraphSource('schema Data [label="Data"]\nservice API [label="API"]\nData -> API');

    expect(duplicate.diagnostics[0].message).toContain("declared more than once");
    expect(incompatible.diagnostics[0].message).toContain("cannot be used as a connection source");
  });

  it("validates graph documents and retains supported extension metadata", () => {
    const parsed = parseGraphSource(STARTER_SOURCE).document!;
    const extended = {
      ...parsed,
      nodes: parsed.nodes.map((node) => ({ ...node, data: { ...node.data, customMetadata: { source: "design" } } })),
    };

    expect(validateGraph(extended)).toEqual([]);
    expect(GraphDocumentSchema.parse(extended).nodes[0].data).toHaveProperty("customMetadata");
    expect(validateGraph({ ...parsed, edges: [{ ...parsed.edges[0], target: "Missing" }] }).join(" ")).toContain("has a missing endpoint.");
  });
});
