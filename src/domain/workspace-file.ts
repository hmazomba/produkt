import { z } from "zod";
import { GraphDocumentSchema, parseGraphSource, retainGraphMetadata, serializeGraph, validateGraph, type Diagnostic, type GraphDocument } from "@/domain/graph";
import { findStoryboardTrigger, parseSamplePayload, StoryboardSetupSchema, type StoryboardSetup } from "@/domain/simulation";

const FORMAT = "produkt-workspace";
export const MAX_WORKSPACE_FILE_BYTES = 10 * 1024 * 1024;

const WorkspaceFileBase = z.object({
  format: z.literal(FORMAT),
  source: z.string(),
  document: GraphDocumentSchema,
  draft: z.string().optional(),
}).strict();

const WorkspaceFileSchema = z.discriminatedUnion("version", [
  WorkspaceFileBase.extend({ version: z.literal(1) }),
  WorkspaceFileBase.extend({
    version: z.literal(2),
    storyboard: StoryboardSetupSchema.extend({ triggerNodeId: StoryboardSetupSchema.shape.triggerNodeId.unwrap() }),
  }),
]);

interface WorkspaceSources {
  document: GraphDocument;
  source: string;
  committedSource: string;
}

export interface WorkspaceSnapshot extends WorkspaceSources {
  diagnostics: Diagnostic[];
  storyboardSetup?: StoryboardSetup;
}

function portableDocument(document: GraphDocument): GraphDocument {
  return {
    nodes: document.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: document.edges.map(({ id, source, sourceHandle, target, targetHandle, label, data }) => ({
      id, source, sourceHandle, target, targetHandle, label, data,
    })),
  };
}

export function restoreWorkspaceSources(document: GraphDocument, committedSource: string, source = committedSource): WorkspaceSnapshot {
  if (source === committedSource) return { document, committedSource, source, diagnostics: [] };
  const parsed = parseGraphSource(source, document);
  if (!parsed.document) return { document, committedSource, source, diagnostics: parsed.diagnostics };
  return { document: retainGraphMetadata(parsed.document, document), committedSource: source, source, diagnostics: [] };
}

function storyboardSetupError(document: GraphDocument, setup: StoryboardSetup): string | undefined {
  if (!findStoryboardTrigger(document, setup.triggerNodeId)) {
    return "The storyboard setup requires a service or wireframe trigger from this workspace.";
  }
  return parseSamplePayload(setup.payloadDraft).error;
}

export function serializeWorkspaceFile({ document, source, committedSource }: WorkspaceSources, storyboard?: StoryboardSetup): string {
  if (storyboard) {
    const snapshot = restoreWorkspaceSources(document, committedSource, source);
    const error = storyboardSetupError(snapshot.document, storyboard);
    if (error) throw new Error(error);
  }
  return JSON.stringify({
    format: FORMAT,
    ...(storyboard ? { version: 2, storyboard } : { version: 1 }),
    source: committedSource,
    document: portableDocument(document),
    ...(source === committedSource ? {} : { draft: source }),
  }, null, 2);
}

export function parseWorkspaceFile(text: string): { workspace: WorkspaceSnapshot } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "This file is not valid JSON. Choose a workspace exported from produkt." };
  }
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== FORMAT) {
    return { error: "Choose a workspace exported from produkt." };
  }
  if (!("version" in value) || (value.version !== 1 && value.version !== 2)) return { error: "This workspace file version is unsupported." };

  const file = WorkspaceFileSchema.safeParse(value);
  if (!file.success) {
    const issue = file.error.issues[0];
    return { error: `Invalid workspace at ${issue.path.join(".") || "the file root"}. ${issue.message}` };
  }

  const document = portableDocument(file.data.document);
  const graphError = validateGraph(document)[0];
  if (graphError) return { error: graphError };

  const parsed = parseGraphSource(file.data.source, document);
  if (!parsed.document) {
    const diagnostic = parsed.diagnostics[0];
    return { error: `Invalid workspace source on line ${diagnostic.line}. ${diagnostic.message}` };
  }
  const storedAuthoring = parseGraphSource(serializeGraph(document), document).document;
  if (!storedAuthoring || serializeGraph(parsed.document) !== serializeGraph(storedAuthoring)) {
    return { error: "The source and saved graph disagree. Export a fresh copy from produkt." };
  }

  const workspace = restoreWorkspaceSources(document, file.data.source, file.data.draft);
  if (file.data.version === 1) return { workspace };
  const error = storyboardSetupError(workspace.document, file.data.storyboard);
  if (error) return { error };
  return { workspace: { ...workspace, storyboardSetup: file.data.storyboard } };
}
