import { z } from "zod";
import type { GraphDocument, GraphEdge } from "@/domain/graph";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SamplePayload = Record<string, JsonValue>;

export const DEFAULT_SAMPLE = '{\n  "email": "maya@studio.co",\n  "plan": "Team",\n  "seats": 8\n}';

export const StoryboardSetupSchema = z.object({
  triggerNodeId: z.string().regex(/^[A-Za-z][\w-]{0,63}$/).nullable(),
  payloadDraft: z.string(),
}).strict();

export type StoryboardSetup = z.infer<typeof StoryboardSetupSchema>;
export const DEFAULT_STORYBOARD_SETUP: StoryboardSetup = { triggerNodeId: null, payloadDraft: DEFAULT_SAMPLE };

export interface SimulationStep {
  nodeId: string;
  payload: SamplePayload;
  message: string;
}

export interface SimulationState extends StoryboardSetup {
  branchEdgeId: string | null;
  activeNodeId: string | null;
  activeEdgeId: string | null;
  visitedNodeIds: string[];
  step: number;
  running: boolean;
  finished: boolean;
  message: string;
  payload: SamplePayload;
  payloadError: string;
  trace: SimulationStep[];
  uiValues: ReadonlyMap<string, SamplePayload>;
}

export function parseSamplePayload(draft: string): { payload: SamplePayload; error?: never } | { error: string; payload?: never } {
  try {
    const value: unknown = JSON.parse(draft, (_, field: unknown) => {
      if (typeof field === "number" && !Number.isFinite(field)) throw new Error("Non-finite number");
      return field;
    });
    if (value && typeof value === "object" && !Array.isArray(value)) return { payload: value as SamplePayload };
  } catch {
    return { error: "Enter valid JSON with finite numbers." };
  }
  return { error: "Enter a JSON object with named fields." };
}

export function findStoryboardTrigger(document: GraphDocument, id: string | null) {
  return document.nodes.find((node) => node.id === id && node.data.kind !== "schema");
}

export function initialSimulation({ triggerNodeId, payloadDraft }: StoryboardSetup = DEFAULT_STORYBOARD_SETUP): SimulationState {
  const sample = parseSamplePayload(payloadDraft);
  return {
    triggerNodeId, branchEdgeId: null, activeNodeId: null, activeEdgeId: null,
    visitedNodeIds: [], step: 0, running: false, finished: false, trace: [], uiValues: new Map(),
    message: sample.error ? "Fix the sample payload before starting." : triggerNodeId ? "Ready to run the storyboard." : "Choose a trigger to preview a local flow.",
    payload: sample.payload ?? {}, payloadDraft, payloadError: sample.error ?? "",
  };
}

export function defaultBranch(edges: GraphEdge[], visited: string[]): GraphEdge | undefined {
  return edges.find((edge) => !visited.includes(edge.target)) ?? edges[0];
}

export function advanceSimulation(document: GraphDocument, state: SimulationState, keepPlaying = false): SimulationState {
  if (state.finished) return state;
  if (!document.nodes.length) return { ...state, running: false, message: "Add a node before starting the storyboard." };
  if (!state.activeNodeId) {
    const trigger = findStoryboardTrigger(document, state.triggerNodeId);
    if (!trigger) return { ...state, running: false, message: "Choose a trigger before starting." };
    const sample = parseSamplePayload(state.payloadDraft);
    if (sample.error !== undefined) return { ...state, running: false, payloadError: sample.error, message: "Fix the sample payload before starting." };
    const payload = sample.payload;
    const message = `Started at ${trigger.data.label}.`;
    const uiValues = new Map(state.uiValues);
    if (trigger.data.kind === "ui") uiValues.set(trigger.id, payload);
    return {
      ...state, activeNodeId: trigger.id, visitedNodeIds: [trigger.id], running: keepPlaying, payload, message, uiValues,
      trace: [{ nodeId: trigger.id, payload, message }],
    };
  }

  const activeId = state.activeNodeId;
  const candidates = document.edges.filter((edge) => edge.source === activeId);
  const edge = candidates.find((candidate) => candidate.id === state.branchEdgeId) ?? defaultBranch(candidates, state.visitedNodeIds);
  if (!edge) {
    return { ...state, activeEdgeId: null, running: false, finished: true, message: `Reached ${document.nodes.find((node) => node.id === activeId)?.data.label ?? activeId}. Flow complete.` };
  }
  const next = document.nodes.find((node) => node.id === edge.target);
  if (state.visitedNodeIds.includes(edge.target)) {
    return { ...state, activeEdgeId: edge.id, running: false, finished: true, message: `Cycle detected at ${next?.data.label ?? edge.target}. Reset to trace another path.` };
  }
  if (!next) return { ...state, running: false, finished: true, message: `Connection ${edge.id} has a missing destination.` };

  const mappings = edge.data?.mappings ?? [];
  const source = document.nodes.find((node) => node.id === activeId);
  const outputFields = source?.data.kind === "service" ? source.data.fields ?? [] : [];
  const copied: [string, JsonValue][] = [];
  const mockOutputs = new Set<string>();
  const missing = new Set<string>();
  for (const { from, to } of mappings) {
    if (Object.hasOwn(state.payload, from)) {
      copied.push([to, state.payload[from]]);
      continue;
    }
    const example = outputFields.find((field) => field.name === from)?.example;
    if (example === undefined) {
      missing.add(from);
      continue;
    }
    copied.push([to, example]);
    mockOutputs.add(from);
  }
  const payload = mappings.length ? Object.fromEntries(copied) : state.payload;
  const destinationFields = next.data.fields ?? [];
  const unmapped = destinationFields.filter(({ name }) => !mappings.some(({ to }) => to === name)).map(({ name }) => name);
  const message = [
    `${next.data.label} received the sample payload.`,
    candidates.length > 1 ? `Branch ${candidates.indexOf(edge) + 1} of ${candidates.length}: ${edge.label || next.data.label}.` : "",
    mappings.length ? "" : "No field mappings on this link. Payload carried forward unchanged.",
    mockOutputs.size ? `Mock outputs from ${source?.data.label}: ${[...mockOutputs].join(", ")}.` : "",
    missing.size ? `Missing sample fields: ${[...missing].join(", ")}.` : "",
    unmapped.length ? `Unmapped destination fields: ${unmapped.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  const uiValues = new Map(state.uiValues);
  if (next.data.kind === "ui" && mappings.length) uiValues.set(next.id, { ...uiValues.get(next.id), ...payload });
  return {
    ...state, activeNodeId: next.id, activeEdgeId: edge.id, branchEdgeId: null,
    visitedNodeIds: [...state.visitedNodeIds, next.id], step: state.step + 1, running: keepPlaying,
    payload, message, uiValues, trace: [...state.trace, { nodeId: next.id, payload, message }],
  };
}
