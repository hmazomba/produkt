import { z } from "zod";
import { connectionKey, FieldMappingSchema, GraphDocumentSchema, validateGraph, type GraphDocument, type GraphEdge, type GraphNode } from "@/domain/graph";

export const GraphProposalSchema = z.object({
  rationale: z.string().min(1).max(1200),
  nodes: z.array(z.object({
    id: z.string().regex(/^[A-Za-z][\w-]{0,63}$/),
    kind: z.enum(["service", "schema", "ui"]),
    component: z.enum(["form", "action", "list"]).optional(),
    label: z.string().min(1).max(200),
    detail: z.string().max(500).optional(),
    fields: z.array(z.object({ name: z.string().regex(/^[\w-]{1,64}$/), type: z.string().min(1).max(100), example: z.string().max(500).optional() })).max(30).optional(),
  })).max(20),
  edges: z.array(z.object({
    source: z.string().regex(/^[A-Za-z][\w-]{0,63}$/),
    target: z.string().regex(/^[A-Za-z][\w-]{0,63}$/),
    sourcePort: z.string().regex(/^[\w-]{1,64}$/).optional(),
    targetPort: z.string().regex(/^[\w-]{1,64}$/).optional(),
    label: z.string().max(200).optional(),
    mappings: z.array(FieldMappingSchema).max(30).optional(),
  })).max(40),
}).strict();

export type GraphProposal = z.infer<typeof GraphProposalSchema>;

export interface ProposalApplyResult {
  document?: GraphDocument;
  errors: string[];
}

export function applyGraphProposal(document: GraphDocument, proposal: GraphProposal): ProposalApplyResult {
  const errors: string[] = [];
  const existingIds = new Set(document.nodes.map((node) => node.id));
  const proposedIds = new Set<string>();
  for (const node of proposal.nodes) {
    if (existingIds.has(node.id) || proposedIds.has(node.id)) errors.push(`Node ID “${node.id}” already exists.`);
    proposedIds.add(node.id);
  }
  const allIds = new Set([...existingIds, ...proposedIds]);
  const nodeKinds = new Map(document.nodes.map((node) => [node.id, node.data.kind]));
  proposal.nodes.forEach((node) => nodeKinds.set(node.id, node.kind));
  const edgeKeys = new Set<string>();
  for (const edge of proposal.edges) {
    if (!allIds.has(edge.source) || !allIds.has(edge.target)) errors.push(`Connection ${edge.source} → ${edge.target} refers to a missing node.`);
    const sourceKind = nodeKinds.get(edge.source);
    const targetKind = nodeKinds.get(edge.target);
    if (sourceKind === "schema") errors.push(`Schema “${edge.source}” cannot send connections.`);
    if (targetKind === "ui" && sourceKind !== "service") errors.push(`Connections from ${sourceKind ?? "unknown nodes"} cannot target UI node “${edge.target}”.`);
    const key = connectionKey({ ...edge, sourceHandle: edge.sourcePort, targetHandle: edge.targetPort });
    const duplicate = document.edges.some((existing) => connectionKey(existing) === key);
    if (duplicate || edgeKeys.has(key)) errors.push(`Connection ${edge.source} → ${edge.target} already exists.`);
    edgeKeys.add(key);
  }
  if (errors.length) return { errors };

  const maxX = document.nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
  const nodes: GraphNode[] = proposal.nodes.map((node, index) => ({
    id: node.id,
    type: node.kind,
    position: { x: maxX + 300 + (index % 2) * 320, y: 80 + Math.floor(index / 2) * 220 },
    data: { kind: node.kind, ...(node.component && node.kind === "ui" ? { component: node.component } : {}), label: node.label, detail: node.detail ?? (node.kind === "ui" ? "Wireframe" : node.kind === "schema" ? "Data schema" : "Service"), ...(node.fields ? { fields: node.fields } : {}) },
  }));
  let mergedNodes = [...document.nodes.map((node) => ({ ...node, data: { ...node.data } })), ...nodes];
  for (const edge of proposal.edges) {
    mergedNodes = mergedNodes.map((node) => {
      if (node.id === edge.source && edge.sourcePort && !node.data.sourcePorts?.includes(edge.sourcePort)) return { ...node, data: { ...node.data, sourcePorts: [...(node.data.sourcePorts ?? []), edge.sourcePort] } };
      if (node.id === edge.target && edge.targetPort && !node.data.targetPorts?.includes(edge.targetPort)) return { ...node, data: { ...node.data, targetPorts: [...(node.data.targetPorts ?? []), edge.targetPort] } };
      return node;
    });
  }
  const edges: GraphEdge[] = proposal.edges.map((edge, index) => {
    return {
      id: `proposal-${edge.source}-${edge.sourcePort ?? "out"}-${edge.target}-${edge.targetPort ?? "in"}-${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourcePort,
      targetHandle: edge.targetPort,
      label: edge.label,
        ...(edge.mappings?.length ? { data: { mappings: edge.mappings } } : {}),
      type: "smoothstep",
    };
  });
  const merged = { nodes: mergedNodes, edges: [...document.edges, ...edges] };
  const shape = GraphDocumentSchema.safeParse(merged);
  if (!shape.success) return { errors: shape.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const graphErrors = validateGraph(merged);
  return graphErrors.length ? { errors: graphErrors } : { document: merged, errors: [] };
}
