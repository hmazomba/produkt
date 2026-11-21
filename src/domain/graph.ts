import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";

export type GraphNodeKind = "service" | "schema" | "ui";

export interface GraphNodeData extends Record<string, unknown> {
  kind: GraphNodeKind;
  label: string;
  detail?: string;
  component?: "form" | "action" | "list";
  fields?: Array<{ name: string; type: string; example?: string }>;
  sourcePorts?: string[];
  targetPorts?: string[];
}

export type GraphNode = Node<GraphNodeData, GraphNodeKind>;
export interface FieldMapping {
  from: string;
  to: string;
}

export type GraphEdge = Edge<Record<string, unknown> & { mappings?: FieldMapping[] }>;

export interface GraphDocument {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const GraphNodeDataSchema = z.object({
  kind: z.enum(["service", "schema", "ui"]),
  label: z.string().min(1).max(200),
  detail: z.string().max(500).optional(),
  component: z.enum(["form", "action", "list"]).optional(),
  fields: z.array(z.object({ name: z.string().regex(/^[\w-]{1,64}$/), type: z.string().min(1).max(100), example: z.string().max(500).optional() })).max(100).optional(),
  sourcePorts: z.array(z.string().regex(/^[\w-]{1,64}$/)).max(50).optional(),
  targetPorts: z.array(z.string().regex(/^[\w-]{1,64}$/)).max(50).optional(),
}).passthrough().superRefine((data, context) => {
  if (data.component && data.kind !== "ui") context.addIssue({ code: "custom", message: "Only UI nodes can declare a wireframe component type.", path: ["component"] });
});

export const FieldMappingSchema = z.object({
  from: z.string().regex(/^[\w-]{1,64}$/),
  to: z.string().regex(/^[\w-]{1,64}$/),
}).strict();

export const GraphDocumentSchema = z.object({
  nodes: z.array(z.object({ id: z.string().regex(/^[A-Za-z][\w-]{0,63}$/), type: z.enum(["service", "schema", "ui"]), position: z.object({ x: z.number().finite(), y: z.number().finite() }), data: GraphNodeDataSchema }).passthrough()).max(2000),
  edges: z.array(z.object({
    id: z.string().min(1).max(768), source: z.string().min(1).max(64), target: z.string().min(1).max(64),
    sourceHandle: z.string().max(64).nullish(), targetHandle: z.string().max(64).nullish(),
    label: z.union([z.string(), z.number()]).optional(),
    data: z.object({ mappings: z.array(FieldMappingSchema).max(100).optional() }).passthrough().optional(),
  }).passthrough()).max(5000),
}).strict();

export interface Diagnostic {
  line: number;
  column: number;
  message: string;
}

export interface ParseResult {
  document?: GraphDocument;
  diagnostics: Diagnostic[];
}

export const STARTER_SOURCE = `# A small checkout flow, ready to explore
ui Checkout [label="Checkout form"]
meta Checkout [detail="Form · 3 fields", component="form"]
field Checkout.email [type="Email", example="maya@studio.co"]
field Checkout.plan [type="String", example="Team"]
field Checkout.seats [type="Int", example="8"]
service API [label="API gateway"]
meta API [detail="HTTP · public edge"]
field API.email [type="Email"]
field API.plan [type="String"]
field API.seats [type="Int"]
service Orders [label="Order service"]
meta Orders [detail="TypeScript · internal"]
field Orders.customerEmail [type="Email"]
field Orders.plan [type="String"]
field Orders.seats [type="Int"]
field Orders.status [type="Enum", example="Confirmed"]
schema Order [label="Order record"]
meta Order [detail="4 fields"]
field Order.id [type="UUID"]
field Order.plan [type="String"]
field Order.seats [type="Int"]
field Order.status [type="Enum"]
ui Receipt [label="Order confirmation"]
meta Receipt [detail="Receipt preview", component="list"]
field Receipt.status [type="Enum", example="Awaiting order"]
field Receipt.email [type="Email"]

Checkout.submit -> API.createOrder [id="e-Checkout-API", label="POST /orders"]
map "e-Checkout-API" email -> email
map "e-Checkout-API" plan -> plan
map "e-Checkout-API" seats -> seats
API.createOrder -> Orders.create [id="e-API-Orders", label="create order"]
map "e-API-Orders" email -> customerEmail
map "e-API-Orders" plan -> plan
map "e-API-Orders" seats -> seats
Orders.create -> Receipt.showConfirmation [id="e-Orders-Receipt", label="confirms order"]
map "e-Orders-Receipt" status -> status
map "e-Orders-Receipt" customerEmail -> email
Orders.create -> Order [id="e-Orders-Order", label="writes"]
map "e-Orders-Order" plan -> plan
map "e-Orders-Order" seats -> seats
map "e-Orders-Order" status -> status`;

const declarationPattern = /^(service|schema|ui)\s+([\w-]+)\s+\[label="((?:\\.|[^"\\])*)"\]$/;
const connectionPattern = /^([\w-]+)(?:\.([\w-]+))?\s*->\s*([\w-]+)(?:\.([\w-]+))?(?:\s+\[(?:id="((?:\\.|[^"\\])*)"(?:,\s*label="((?:\\.|[^"\\])*)")?|label="((?:\\.|[^"\\])*)")\])?$/;
const fieldPattern = /^field\s+([\w-]+)\.([\w-]+)\s+\[type="((?:\\.|[^"\\])*)"(?:,\s*example="((?:\\.|[^"\\])*)")?\]$/;
const metadataPattern = /^meta\s+([\w-]+)\s+\[detail="((?:\\.|[^"\\])*)"(?:,\s*component="(form|action|list)")?\]$/;
const mappingPattern = /^map\s+"((?:\\.|[^"\\])*)"\s+([\w-]+)\s*->\s*([\w-]+)$/;
const portPattern = /^port\s+(input|output)\s+([\w-]+)\.([\w-]+)$/;

function unescapeLabel(label: string): string {
  return label.replace(/\\(["\\nr])/g, (_, escaped: string) => escaped === "n" ? "\n" : escaped === "r" ? "\r" : escaped);
}

function escapeLabel(label: string): string {
  return label.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function connectionKey(edge: Pick<GraphEdge, "source" | "sourceHandle" | "target" | "targetHandle">): string {
  return [edge.source, edge.sourceHandle || "out", edge.target, edge.targetHandle || "in"].join("|");
}

export function connectionError(source?: GraphNode, target?: GraphNode): string | undefined {
  if (!source || !target) return "The connection has a missing endpoint.";
  if (target.data.kind === "ui" && source.data.kind !== "service") return "Only a service output can target a UI input.";
  if (source.data.kind === "schema") return `Schema “${source.id}” cannot send connections.`;
}

function sourceEdgeId(parts: string[]): string {
  return `e-${parts.map((part) => part.replace(/-/g, "%2D")).join("-")}`;
}

export function validateMapping(document: GraphDocument, edge: GraphEdge, mapping: FieldMapping): string | undefined {
  const source = document.nodes.find((node) => node.id === edge.source);
  const target = document.nodes.find((node) => node.id === edge.target);
  return mappingError(edge, mapping, source, target);
}

function mappingError(edge: GraphEdge, mapping: FieldMapping, source?: GraphNode, target?: GraphNode): string | undefined {
  const from = source?.data.fields?.find((field) => field.name === mapping.from);
  const to = target?.data.fields?.find((field) => field.name === mapping.to);
  if (!from || !to) return `Mapping ${edge.source}.${mapping.from} → ${edge.target}.${mapping.to} requires both fields to exist.`;
  if (from.type.trim().toLowerCase() !== to.type.trim().toLowerCase()) {
    return `Cannot map ${mapping.from} (${from.type}) to ${mapping.to} (${to.type}). Field types must match.`;
  }
}

export function parseGraphSource(source: string, previous?: GraphDocument): ParseResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const nodeIds = new Set<string>();
  const nodesById = new Map<string, GraphNode>();
  const nodeLines: number[] = [];
  const edgeLines: number[] = [];
  const pendingEdges: Array<{ line: number; match: RegExpExecArray }> = [];
  const pendingFields: Array<{ line: number; match: RegExpExecArray }> = [];
  const pendingMetadata: Array<{ line: number; match: RegExpExecArray }> = [];
  const pendingMappings: Array<{ line: number; match: RegExpExecArray }> = [];
  const pendingPorts: Array<{ line: number; match: RegExpExecArray }> = [];

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const declaration = declarationPattern.exec(line);
    if (declaration) {
      const [, kind, id, rawLabel] = declaration;
      if (nodeIds.has(id)) {
        diagnostics.push({ line: index + 1, column: 1, message: `Node “${id}” is declared more than once.` });
        return;
      }
      nodeIds.add(id);
      const nodeKind = kind as GraphNodeKind;
      nodes.push({
        id,
        type: nodeKind,
        position: { x: 80 + (nodes.length % 3) * 350, y: 90 + Math.floor(nodes.length / 3) * 210 },
        data: { kind: nodeKind, label: unescapeLabel(rawLabel), detail: nodeKind === "ui" ? "Wireframe" : nodeKind === "schema" ? "Data schema" : "Service" },
      });
      nodesById.set(id, nodes[nodes.length - 1]);
      nodeLines.push(index + 1);
      return;
    }

    const field = fieldPattern.exec(line);
    if (field) {
      pendingFields.push({ line: index + 1, match: field });
      return;
    }

    const metadata = metadataPattern.exec(line);
    if (metadata) {
      pendingMetadata.push({ line: index + 1, match: metadata });
      return;
    }

    const connection = connectionPattern.exec(line);
    if (connection) {
      pendingEdges.push({ line: index + 1, match: connection });
      return;
    }

    const mapping = mappingPattern.exec(line);
    if (mapping) {
      pendingMappings.push({ line: index + 1, match: mapping });
      return;
    }
    const port = portPattern.exec(line);
    if (port) {
      pendingPorts.push({ line: index + 1, match: port });
      return;
    }
    diagnostics.push({ line: index + 1, column: 1, message: "Use a node, field, meta, port, or map declaration, or connect nodes with ->." });
  });

  for (const { line, match } of pendingFields) {
    const [, nodeId, fieldName, rawType, rawExample] = match;
    const node = nodesById.get(nodeId);
    if (!node) {
      diagnostics.push({ line, column: 1, message: `Field refers to “${nodeId}”, which has not been declared.` });
      continue;
    }
    if (node.data.fields?.some((field) => field.name === fieldName)) {
      diagnostics.push({ line, column: 1, message: `Field “${nodeId}.${fieldName}” is declared more than once.` });
      continue;
    }
    node.data.fields = [...(node.data.fields ?? []), { name: fieldName, type: unescapeLabel(rawType), ...(rawExample === undefined ? {} : { example: unescapeLabel(rawExample) }) }];
  }

  for (const { line, match } of pendingMetadata) {
    const [, nodeId, rawDetail, component] = match;
    const node = nodesById.get(nodeId);
    if (!node) {
      diagnostics.push({ line, column: 1, message: `Metadata refers to “${nodeId}”, which has not been declared.` });
      continue;
    }
    node.data.detail = unescapeLabel(rawDetail);
    if (component && node.data.kind !== "ui") {
      diagnostics.push({ line, column: 1, message: `Only UI nodes can declare a wireframe component type.` });
      continue;
    }
    if (component) node.data.component = component as GraphNodeData["component"];
  }

  for (const { line, match } of pendingPorts) {
    const [, direction, nodeId, name] = match;
    const node = nodesById.get(nodeId);
    if (!node || (direction === "output" && node.data.kind === "schema")) {
      diagnostics.push({ line, column: 1, message: `Choose a node that supports an ${direction} port.` });
      continue;
    }
    const key = direction === "input" ? "targetPorts" : "sourcePorts";
    if (!node.data[key]?.includes(name)) node.data[key] = [...(node.data[key] ?? []), name];
  }

  const edgesById = new Map<string, GraphEdge>();
  const connections = new Set<string>();
  const previousIds = new Map(previous?.edges.map((edge) => [connectionKey(edge), edge.id]));
  for (const { line, match } of pendingEdges) {
    const [, sourceId, sourcePort, targetId, targetPort, rawId, labelWithId, labelOnly] = match;
    const rawLabel = labelWithId ?? labelOnly;
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      const missing = !nodeIds.has(sourceId) ? sourceId : targetId;
      diagnostics.push({ line, column: 1, message: `Connection refers to “${missing}”, which has not been declared.` });
      continue;
    }
    const connection = { source: sourceId, target: targetId, sourceHandle: sourcePort, targetHandle: targetPort };
    const key = connectionKey(connection);
    const id = rawId === undefined ? previousIds.get(key) ?? sourceEdgeId(key.split("|")) : unescapeLabel(rawId);
    if (edgesById.has(id) || connections.has(key)) {
      diagnostics.push({ line, column: 1, message: `Connection “${id}” or its endpoints are already declared.` });
      continue;
    }
    const sourceNode = nodesById.get(sourceId);
    const targetNode = nodesById.get(targetId);
    if (sourceNode?.data.kind === "schema") {
      diagnostics.push({ line, column: 1, message: `Schema “${sourceId}” cannot be used as a connection source.` });
      continue;
    }
    const endpointError = connectionError(sourceNode, targetNode);
    if (endpointError) {
      diagnostics.push({ line, column: 1, message: endpointError });
      continue;
    }
    if (sourcePort && sourceNode && !sourceNode.data.sourcePorts?.includes(sourcePort)) {
      sourceNode.data.sourcePorts = [...(sourceNode.data.sourcePorts ?? []), sourcePort];
    }
    if (targetPort && targetNode && !targetNode.data.targetPorts?.includes(targetPort)) {
      targetNode.data.targetPorts = [...(targetNode.data.targetPorts ?? []), targetPort];
    }
    const edge = { ...connection, id, type: "smoothstep", label: rawLabel === undefined ? undefined : unescapeLabel(rawLabel) };
    edges.push(edge);
    edgesById.set(id, edge);
    connections.add(key);
    edgeLines.push(line);
  }

  const document = { nodes, edges };
  for (const { line, match } of pendingMappings) {
    const [, rawId, from, to] = match;
    const id = unescapeLabel(rawId);
    const edge = edgesById.get(id);
    const mapping = { from, to };
    const error = edge ? mappingError(edge, mapping, nodesById.get(edge.source), nodesById.get(edge.target)) : `Mapping refers to unknown connection “${id}”.`;
    if (error || edge?.data?.mappings?.some((item) => item.to === to)) {
      diagnostics.push({ line, column: 1, message: error ?? `Field “${to}” already has a mapping on this connection.` });
      continue;
    }
    if (edge) edge.data = { mappings: [...(edge.data?.mappings ?? []), mapping] };
  }

  const parsed = GraphDocumentSchema.safeParse(document);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [collection, index] = issue.path;
      const line = typeof index === "number" ? (collection === "nodes" ? nodeLines : edgeLines)[index] : 1;
      diagnostics.push({ line: line ?? 1, column: 1, message: `${issue.path.slice(2).join(".") || "Graph"}: ${issue.message}` });
    }
  }
  for (const [index, node] of nodes.entries()) {
    if (!node.data.label.trim()) diagnostics.push({ line: nodeLines[index], column: 1, message: `Node “${node.id}” needs a label.` });
  }
  diagnostics.sort((a, b) => a.line - b.line);
  return diagnostics.length ? { diagnostics } : { document, diagnostics };
}

export function retainGraphMetadata(document: GraphDocument, previous: GraphDocument): GraphDocument {
  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  const previousEdges = new Map(previous.edges.map((edge) => [edge.id, edge]));
  return {
    nodes: document.nodes.map((node) => {
      const existing = previousNodes.get(node.id);
      if (!existing || existing.type !== node.type) return node;
      const data = { ...existing.data, ...node.data };
      for (const key of ["component", "fields", "sourcePorts", "targetPorts"] as const) {
        if (node.data[key] === undefined) delete data[key];
      }
      return { ...existing, ...node, position: existing.position, data };
    }),
    edges: document.edges.map((edge) => {
      const existing = previousEdges.get(edge.id);
      if (!existing) return edge;
      const data = { ...existing.data, ...edge.data };
      if (!edge.data?.mappings) delete data.mappings;
      return { ...existing, ...edge, data: Object.keys(data).length ? data : undefined };
    }),
  };
}

export function serializeGraph(document: GraphDocument): string {
  const declarations = document.nodes.flatMap(({ id, data }) => [
    `${data.kind} ${id} [label="${escapeLabel(data.label)}"]`,
    ...(data.detail !== undefined || data.component ? [`meta ${id} [detail="${escapeLabel(data.detail ?? "")}"${data.component ? `, component="${data.component}"` : ""}]`] : []),
    ...(data.fields ?? []).map((field) => `field ${id}.${field.name} [type="${escapeLabel(field.type)}"${field.example === undefined ? "" : `, example="${escapeLabel(field.example)}"`}]`),
    ...(data.sourcePorts ?? []).map((port) => `port output ${id}.${port}`),
    ...(data.targetPorts ?? []).map((port) => `port input ${id}.${port}`),
  ]);
  const connections = document.edges.map((edge) => {
    const source = edge.sourceHandle ? `${edge.source}.${edge.sourceHandle}` : edge.source;
    const target = edge.targetHandle ? `${edge.target}.${edge.targetHandle}` : edge.target;
    const label = typeof edge.label === "string" || typeof edge.label === "number" ? `, label="${escapeLabel(String(edge.label))}"` : "";
    const id = escapeLabel(edge.id);
    return [`${source} -> ${target} [id="${id}"${label}]`, ...(edge.data?.mappings ?? []).map(({ from, to }) => `map "${id}" ${from} -> ${to}`)];
  });
  return [...declarations, "", ...connections.flat()].join("\n");
}

export function validateGraph(document: GraphDocument): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const edgeIds = new Set<string>();
  const connections = new Set<string>();
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  for (const node of document.nodes) {
    if (!/^[A-Za-z][\w-]{0,63}$/.test(node.id)) errors.push(`Node ID “${node.id}” is invalid.`);
    if (ids.has(node.id)) errors.push(`Duplicate node ID: ${node.id}.`);
    ids.add(node.id);
    if (!node.data.label.trim()) errors.push(`Node ${node.id} needs a label.`);
    if (node.type !== node.data.kind) errors.push(`Node ${node.id} has inconsistent types.`);
    const fields = node.data.fields ?? [];
    if (new Set(fields.map((field) => field.name)).size !== fields.length) errors.push(`Node ${node.id} has duplicate fields.`);
  }
  for (const edge of document.edges) {
    if (edgeIds.has(edge.id)) errors.push(`Duplicate connection ID: ${edge.id}.`);
    edgeIds.add(edge.id);
    const key = connectionKey(edge);
    if (connections.has(key)) errors.push(`Connection ${edge.id} duplicates existing endpoints.`);
    connections.add(key);
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    const endpointError = connectionError(source, target);
    if (endpointError) errors.push(`Connection ${edge.id}: ${endpointError}`);
    if (edge.sourceHandle && edge.sourceHandle !== "out" && !source?.data.sourcePorts?.includes(edge.sourceHandle)) errors.push(`Connection ${edge.id} uses an undeclared output port.`);
    if (edge.targetHandle && edge.targetHandle !== "in" && !target?.data.targetPorts?.includes(edge.targetHandle)) errors.push(`Connection ${edge.id} uses an undeclared input port.`);
    const destinations = new Set<string>();
    for (const mapping of edge.data?.mappings ?? []) {
      const error = mappingError(edge, mapping, source, target);
      if (error) errors.push(error);
      if (destinations.has(mapping.to)) errors.push(`Connection ${edge.id} maps field “${mapping.to}” more than once.`);
      destinations.add(mapping.to);
    }
  }
  return errors;
}

const starter = parseGraphSource(STARTER_SOURCE);
if (!starter.document) throw new Error(`Invalid starter graph: ${starter.diagnostics[0]?.message}`);

const starterPositions: Record<string, GraphNode["position"]> = {
  Checkout: { x: 76, y: 204 },
  API: { x: 430, y: 116 },
  Orders: { x: 784, y: 204 },
  Order: { x: 1138, y: 326 },
  Receipt: { x: 1138, y: 116 },
};

export const STARTER_DOCUMENT: GraphDocument = {
  ...starter.document,
  nodes: starter.document.nodes.map((node) => ({
    ...node,
    position: starterPositions[node.id] ?? node.position,
  })),
};
