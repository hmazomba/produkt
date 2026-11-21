import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UIMessage } from "ai";
import {
  connectionKey, GraphDocumentSchema, STARTER_DOCUMENT, STARTER_SOURCE, parseGraphSource, retainGraphMetadata,
  serializeGraph, validateGraph, type Diagnostic, type FieldMapping, type GraphDocument, type GraphEdge, type GraphNode,
} from "@/domain/graph";
import { applyGraphProposal, type GraphProposal } from "@/domain/proposal";
import { restoreWorkspaceSources, type WorkspaceSnapshot } from "@/domain/workspace-file";
import { DEFAULT_STORYBOARD_SETUP, findStoryboardTrigger, StoryboardSetupSchema, type StoryboardSetup } from "@/domain/simulation";
import { useSimulation } from "@/state/simulation";

interface WorkspaceState {
  document: GraphDocument;
  source: string;
  committedSource: string;
  sourceRevision: number;
  documentRevision: number;
  workspaceGeneration: number;
  syncStatus: "synced" | "pending" | "invalid";
  diagnostics: Diagnostic[];
  graphError: string;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  chatMessages: UIMessage[];
  storyboardSetup: StoryboardSetup;
  setSource: (source: string) => void;
  commitSource: (revision: number) => void;
  discardDraft: () => void;
  setDocument: (document: GraphDocument, syncSource?: boolean) => boolean;
  addNode: (kind: GraphNode["data"]["kind"]) => boolean;
  connectNodes: (edge: GraphEdge) => boolean;
  selectNode: (id: string | null) => void;
  renameNode: (id: string, label: string) => void;
  updateNodeDetail: (id: string, detail: string) => void;
  updateNodeComponent: (id: string, component: NonNullable<GraphNode["data"]["component"]>) => void;
  updateNodeFields: (id: string, fields: NonNullable<GraphNode["data"]["fields"]>) => boolean;
  selectEdge: (id: string | null) => void;
  renameEdge: (id: string, label: string) => void;
  updateEdgeMappings: (id: string, mappings: FieldMapping[]) => boolean;
  applyProposal: (proposal: GraphProposal) => string[];
  setChatMessages: (messages: UIMessage[]) => void;
  updateStoryboardSetup: (update: Partial<StoryboardSetup>) => boolean;
  openWorkspace: (workspace: WorkspaceSnapshot) => boolean;
}

const draftError = "Apply or discard the source draft before editing the graph.";
const workspaceStorage = createJSONStorage<Pick<WorkspaceState, "document" | "source" | "committedSource" | "chatMessages" | "storyboardSetup">>(() =>
  typeof window === "undefined" ? {
    getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
  } : window.localStorage,
);

function setupForDocument(setup: StoryboardSetup, document: GraphDocument): StoryboardSetup {
  if (setup.triggerNodeId && !findStoryboardTrigger(document, setup.triggerNodeId)) return { ...setup, triggerNodeId: null };
  return setup;
}

function documentError(document: GraphDocument): string | undefined {
  const result = GraphDocumentSchema.safeParse(document);
  if (!result.success) {
    const issue = result.error.issues[0];
    return `${issue.path.join(".") || "Graph"}: ${issue.message}`;
  }
  return validateGraph(document)[0];
}

export const useWorkspace = create<WorkspaceState>()(persist((set, get) => {
  const updateNode = (id: string, data: Partial<GraphNode["data"]>) => {
    const { document, setDocument } = get();
    return setDocument({ ...document, nodes: document.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node) });
  };
  const updateEdge = (id: string, update: (edge: GraphEdge) => GraphEdge) => {
    const { document, setDocument } = get();
    return setDocument({ ...document, edges: document.edges.map((edge) => edge.id === id ? update(edge) : edge) });
  };
  return {
    document: STARTER_DOCUMENT,
    source: STARTER_SOURCE,
    committedSource: STARTER_SOURCE,
    sourceRevision: 0,
    documentRevision: 0,
    workspaceGeneration: 0,
    syncStatus: "synced",
    diagnostics: [],
    graphError: "",
    selectedNodeId: null,
    selectedEdgeId: null,
    chatMessages: [],
    storyboardSetup: DEFAULT_STORYBOARD_SETUP,
    setSource: (source) => set((state) => ({
      source, sourceRevision: state.sourceRevision + 1, syncStatus: "pending", diagnostics: [], graphError: "",
    })),
    commitSource: (revision) => {
      const state = get();
      if (revision !== state.sourceRevision || state.syncStatus === "synced") return;
      const result = parseGraphSource(state.source, state.document);
      if (!result.document) {
        set({ diagnostics: result.diagnostics, syncStatus: "invalid" });
        return;
      }
      const document = retainGraphMetadata(result.document, state.document);
      const storyboardSetup = setupForDocument(state.storyboardSetup, document);
      set({
        document, storyboardSetup, documentRevision: state.documentRevision + 1, committedSource: state.source,
        diagnostics: [], syncStatus: "synced", graphError: "",
        selectedNodeId: document.nodes.some((node) => node.id === state.selectedNodeId) ? state.selectedNodeId : null,
        selectedEdgeId: document.edges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null,
      });
      useSimulation.getState().configure(storyboardSetup);
    },
    discardDraft: () => set((state) => ({
      source: state.committedSource, sourceRevision: state.sourceRevision + 1,
      diagnostics: [], syncStatus: "synced", graphError: "",
    })),
    setDocument: (document, syncSource = true) => {
      const state = get();
      if (!syncSource) {
        set({ document });
        return true;
      }
      const error = state.syncStatus === "synced" ? documentError(document) : draftError;
      if (error) {
        set({ graphError: error });
        return false;
      }
      const source = serializeGraph(document);
      const storyboardSetup = setupForDocument(state.storyboardSetup, document);
      set({ document, storyboardSetup, source, committedSource: source, documentRevision: state.documentRevision + 1, graphError: "" });
      useSimulation.getState().configure(storyboardSetup);
      return true;
    },
    addNode: (kind) => {
      const { document, setDocument } = get();
      const prefix = kind === "service" ? "Service" : kind === "schema" ? "Schema" : "Screen";
      let index = document.nodes.filter((node) => node.data.kind === kind).length + 1;
      let id = `${prefix}${index}`;
      while (document.nodes.some((node) => node.id === id)) id = `${prefix}${++index}`;
      const node: GraphNode = {
        id, type: kind,
        position: { x: 220 + (document.nodes.length % 3) * 280, y: 170 + Math.floor(document.nodes.length / 3) * 210 },
        data: { kind, label: `${kind === "ui" ? "New screen" : `New ${kind}`} ${index}`, detail: kind === "ui" ? "Wireframe" : kind === "schema" ? "Data schema" : "Service" },
      };
      if (!setDocument({ ...document, nodes: [...document.nodes, node] })) return false;
      get().selectNode(id);
      return true;
    },
    connectNodes: (edge) => {
      const { document, setDocument } = get();
      const duplicate = document.edges.some((existing) => connectionKey(existing) === connectionKey(edge));
      if (duplicate) {
        set({ graphError: "Those endpoints are already connected. Select the existing connection to edit it." });
        return false;
      }
      return setDocument({ ...document, edges: [...document.edges, edge] });
    },
    selectNode: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null }),
    renameNode: (id, label) => updateNode(id, { label }),
    updateNodeDetail: (id, detail) => updateNode(id, { detail }),
    updateNodeComponent: (id, component) => updateNode(id, { component }),
    updateNodeFields: (id, fields) => updateNode(id, { fields }),
    selectEdge: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null }),
    renameEdge: (id, label) => updateEdge(id, (edge) => ({ ...edge, label })),
    updateEdgeMappings: (id, mappings) => updateEdge(id, (edge) => ({ ...edge, data: { ...edge.data, mappings } })),
    applyProposal: (proposal) => {
      const state = get();
      if (state.syncStatus !== "synced") return [draftError];
      const result = applyGraphProposal(state.document, proposal);
      if (!result.document) return result.errors;
      if (!state.setDocument(result.document)) return [get().graphError];
      set({ selectedNodeId: null, selectedEdgeId: null });
      return [];
    },
    setChatMessages: (chatMessages) => set({ chatMessages: chatMessages.slice(-40) }),
    updateStoryboardSetup: (update) => {
      const { document, storyboardSetup: previous } = get();
      const storyboardSetup = setupForDocument({ ...previous, ...update }, document);
      useSimulation.getState().configure(storyboardSetup);
      try {
        set({ storyboardSetup });
        return Boolean(workspaceStorage);
      } catch {
        return false;
      }
    },
    openWorkspace: (workspace) => {
      const storyboardSetup = setupForDocument(workspace.storyboardSetup ?? DEFAULT_STORYBOARD_SETUP, workspace.document);
      try {
        set((state) => ({
          ...workspace,
          storyboardSetup,
          sourceRevision: state.sourceRevision + 1,
          documentRevision: state.documentRevision + 1,
          workspaceGeneration: state.workspaceGeneration + 1,
          syncStatus: workspace.diagnostics.length ? "invalid" : "synced",
          graphError: "", selectedNodeId: null, selectedEdgeId: null, chatMessages: [],
        }));
        return Boolean(workspaceStorage);
      } catch {
        return false;
      } finally {
        useSimulation.getState().configure(storyboardSetup);
      }
    },
  };
}, {
  name: "produkt-workspace",
  version: 1,
  skipHydration: true,
  storage: workspaceStorage,
  partialize: ({ document, source, committedSource, chatMessages, storyboardSetup }) => ({ document, source, committedSource, chatMessages, storyboardSetup }),
  merge: (persisted, current) => {
    if (!persisted || typeof persisted !== "object") return current;
    const saved = persisted as { document?: unknown; source?: unknown; committedSource?: unknown; chatMessages?: unknown; storyboardSetup?: unknown };
    const parsed = GraphDocumentSchema.safeParse(saved.document);
    if (!parsed.success || validateGraph(parsed.data).length) return current;
    const committedSource = typeof saved.committedSource === "string" ? saved.committedSource : serializeGraph(parsed.data);
    const source = typeof saved.source === "string" ? saved.source : committedSource;
    const snapshot = restoreWorkspaceSources(parsed.data, committedSource, source);
    const chatMessages = Array.isArray(saved.chatMessages) ? saved.chatMessages.slice(-40).filter((message): message is UIMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as { id?: unknown; role?: unknown; parts?: unknown };
      return typeof candidate.id === "string" && ["user", "assistant"].includes(String(candidate.role)) && Array.isArray(candidate.parts) && candidate.parts.length <= 100;
    }) : [];
    const setup = StoryboardSetupSchema.safeParse(saved.storyboardSetup);
    const storyboardSetup = setupForDocument(setup.data ?? DEFAULT_STORYBOARD_SETUP, snapshot.document);
    return { ...current, ...snapshot, storyboardSetup, syncStatus: snapshot.diagnostics.length ? "invalid" : "synced", chatMessages };
  },
}));
